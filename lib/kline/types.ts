import { ChartOptions, DeepPartial, UTCTimestamp } from 'lightweight-charts';

/**
 * K 线数据点接口
 */
export interface CandlestickData {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
}

/**
 * K 线时间周期类型
 */
export type KlineInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

/**
 * K 线数据源抽象接口
 *
 * 设计目标：
 * - 解耦数据获取与图表渲染
 * - 支持多种交易所数据源
 * - 统一错误处理和重试机制
 */
export interface IKlineDataSource {
  /**
   * 获取历史 K 线数据
   *
   * @param symbol 交易对标识（例如 'btcusdt'）
   * @param interval K 线时间周期
   * @param limit 返回的数据条数（默认 100）
   * @returns Promise<CandlestickData[]> 历史 K 线数据数组
   * @throws {DataSourceError} 当数据获取失败时
   */
  fetchHistorical(
    symbol: string,
    interval: KlineInterval,
    limit?: number
  ): Promise<CandlestickData[]>;

  /**
   * 订阅实时 K 线数据推送
   *
   * @param symbol 交易对标识
   * @param interval K 线时间周期
   * @param callback 接收实时数据的回调函数
   * @returns unsubscribe 取消订阅的函数
   */
  subscribe(
    symbol: string,
    interval: KlineInterval,
    callback: (data: CandlestickData) => void
  ): () => void;

  /**
   * 资源清理方法
   */
  destroy(): void;
}

/**
 * 数据源错误类型
 */
export class DataSourceError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'DataSourceError';
  }
}

/**
 * WebSocket 连接状态
 */
export enum WebSocketState {
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  RECONNECTING = 'RECONNECTING',
  FAILED = 'FAILED',
}

/**
 * WebSocket 订阅配置
 */
export interface WebSocketSubscription {
  key: string;
  url: string;
  callbacks: Set<(data: any) => void>;
  state: WebSocketState;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
}

/**
 * K 线图表组件配置
 */
export interface KlineChartConfig {
  /** 数据源实例（支持依赖注入） */
  dataSource?: IKlineDataSource;

  /** 图表样式配置 */
  chartOptions?: DeepPartial<ChartOptions>;

  /** 错误回调 */
  onError?: (error: Error) => void;

  /** 加载状态回调 */
  onLoadingChange?: (isLoading: boolean) => void;

  /** 是否启用数据缓存 */
  enableCache?: boolean;

  /** 缓存过期时间（毫秒，默认 5 分钟） */
  cacheExpiry?: number;
}

/**
 * 缓存项接口
 */
export interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiry: number;
}
