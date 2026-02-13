import {
  IKlineDataSource,
  CandlestickData,
  KlineInterval,
  DataSourceError,
} from './types';
import { WebSocketManager } from './WebSocketManager';
import { DataCache } from './DataCache';
import { UTCTimestamp } from 'lightweight-charts';

/**
 * Binance 数据源实现
 *
 * 功能特性：
 * - REST API：获取历史 K 线数据
 * - WebSocket：订阅实时 K 线推送
 * - 数据缓存：避免重复请求
 * - 错误处理：统一的错误封装和重试机制
 * - 数据验证：确保数据格式正确
 */
export class BinanceDataSource implements IKlineDataSource {
  private wsManager: WebSocketManager;
  private cache: DataCache;
  private enableCache: boolean;
  private cacheExpiry: number;

  private readonly REST_API_BASE = 'https://api.binance.com/api/v3';
  private readonly WS_BASE = 'wss://stream.binance.com:9443/ws';
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000;

  constructor(options: { enableCache?: boolean; cacheExpiry?: number } = {}) {
    // WebSocket 管理器单例
    this.wsManager = WebSocketManager.getInstance();
    // 数据缓存单例
    this.cache = DataCache.getInstance();
    this.enableCache = options.enableCache ?? true;
    this.cacheExpiry = options.cacheExpiry ?? 5 * 60 * 1000; // 默认 5 分钟

    if (this.cacheExpiry) {
      this.cache.setDefaultExpiry(this.cacheExpiry);
    }
  }

  /**
   * 获取历史 K 线数据（带缓存和重试）
   */
  async fetchHistorical(
    symbol: string,
    interval: KlineInterval,
    limit = 100
  ): Promise<CandlestickData[]> {
    const cacheKey = `${symbol.toLowerCase()}_${interval}_${limit}`;

    // 检查缓存
    if (this.enableCache) {
      const cached = this.cache.get<CandlestickData[]>(cacheKey);
      if (cached) return cached;
    }

    // 带重试的请求
    let lastError: unknown;
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const data = await this.fetchHistoricalInternal(symbol, interval, limit);

        // 存入缓存
        if (this.enableCache) {
          this.cache.set(cacheKey, data, this.cacheExpiry);
        }

        return data;
      } catch (error) {
        lastError = error;
        console.error(
          `[BinanceDataSource] Fetch attempt ${attempt}/${this.MAX_RETRIES} failed:`,
          error
        );

        if (attempt < this.MAX_RETRIES) {
          await this.delay(this.RETRY_DELAY * attempt);
        }
      }
    }

    throw new DataSourceError(
      `Failed to fetch historical data after ${this.MAX_RETRIES} attempts`,
      'FETCH_FAILED',
      lastError
    );
  }

  /**
   * 实际的 REST API 请求
   */
  private async fetchHistoricalInternal(
    symbol: string,
    interval: KlineInterval,
    limit: number
  ): Promise<CandlestickData[]> {
    const url = `${this.REST_API_BASE}/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=${limit}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new DataSourceError(
        `HTTP ${response.status}: ${response.statusText}`,
        'HTTP_ERROR'
      );
    }

    const data = await response.json();

    // 验证响应数据
    if (!Array.isArray(data)) {
      throw new DataSourceError('Invalid response format: expected array', 'INVALID_FORMAT');
    }

    // 转换为标准格式
    return data.map((kline: string[]) => this.parseKlineData(kline));
  }

  /**
   * 解析并验证 K 线数据
   */
  private parseKlineData(kline: string[]): CandlestickData {
    if (!Array.isArray(kline) || kline.length < 6) {
      throw new DataSourceError('Invalid kline data format', 'PARSE_ERROR');
    }

    const [openTime, open, high, low, close] = kline;

    const time = Math.floor(Number(openTime) / 1000) as UTCTimestamp;
    const openPrice = Number(open);
    const highPrice = Number(high);
    const lowPrice = Number(low);
    const closePrice = Number(close);

    // 验证数值是否有效
    if (
      isNaN(time) ||
      isNaN(openPrice) ||
      isNaN(highPrice) ||
      isNaN(lowPrice) ||
      isNaN(closePrice)
    ) {
      throw new DataSourceError('Invalid numeric values in kline data', 'PARSE_ERROR');
    }

    return {
      time,
      open: openPrice,
      high: highPrice,
      low: lowPrice,
      close: closePrice,
    };
  }

  /**
   * 订阅实时 K 线数据（使用 RAF 节流优化性能）
   */
  subscribe(
    symbol: string,
    interval: KlineInterval,
    callback: (data: CandlestickData) => void
  ): () => void {
    const key = `${symbol.toLowerCase()}_${interval}`;
    const url = `${this.WS_BASE}/${symbol.toLowerCase()}@kline_${interval}`;

    console.log(`[BinanceDataSource] Subscribing to ${key}`);

    // RAF 节流状态
    let latestData: CandlestickData | null = null;
    let rafId: number | null = null;

    // 在下一帧发送最新数据
    const emitLatest = () => {
      if (latestData) {
        callback(latestData);
        latestData = null;
      }
      rafId = null;
    };

    // 使用 WebSocket 管理器订阅
    const unsubscribe = this.wsManager.subscribe(
      key,
      url,
      (message: any) => {
        try {
          // 解析 Binance WebSocket 消息格式
          const kline = message.k;
          if (!kline) {
            console.warn('[BinanceDataSource] Invalid message format:', message);
            return;
          }

          const data: CandlestickData = {
            time: Math.floor(kline.t / 1000) as UTCTimestamp,
            open: parseFloat(kline.o),
            high: parseFloat(kline.h),
            low: parseFloat(kline.l),
            close: parseFloat(kline.c),
          };

          // 验证数据
          if (
            isNaN(data.time) ||
            isNaN(data.open) ||
            isNaN(data.high) ||
            isNaN(data.low) ||
            isNaN(data.close)
          ) {
            console.warn('[BinanceDataSource] Invalid numeric values:', data);
            return;
          }

          // 更新最新数据
          latestData = data;

          // 如果没有待处理的 RAF，安排在下一帧发送
          if (!rafId) {
            rafId = requestAnimationFrame(emitLatest);
          }
        } catch (error) {
          console.error('[BinanceDataSource] Error processing WebSocket message:', error);
        }
      },
      5 // 最大重连次数
    );

    // 返回取消订阅函数，确保清理 RAF
    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      unsubscribe();
    };
  }

  /**
   * 清理资源
   */
  destroy(): void {
    console.log('[BinanceDataSource] Destroying data source');
    // WebSocket 管理器是单例，不需要销毁
    // 只清理缓存
    if (this.enableCache) {
      this.cache.clear();
    }
  }

  /**
   * 延迟工具函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
