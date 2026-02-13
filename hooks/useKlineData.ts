'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { CandlestickData, KlineInterval } from '@/lib/kline/types';
import { BinanceDataSource } from '@/lib/kline/BinanceDataSource';
import { WebSocketManager } from '@/lib/kline/WebSocketManager';
import { UTCTimestamp } from 'lightweight-charts';

/**
 * K 线数据查询选项
 */
interface UseKlineDataOptions {
  /** 交易对标识 */
  symbol: string;
  /** K 线时间周期 */
  interval: KlineInterval;
  /** 返回的数据条数 */
  limit?: number;
  /** 是否启用查询 */
  enabled?: boolean;
  /** 数据新鲜度时间（毫秒），在此时间内不会重新请求 */
  staleTime?: number;
  /** 缓存时间（毫秒） */
  cacheTime?: number;
  /** 后台自动重新验证 */
  refetchOnWindowFocus?: boolean;
}

/**
 * 使用 TanStack Query 获取 K 线历史数据的 Hook
 *
 * 优势：
 * - 🚀 自动缓存和请求去重
 * - 🔄 后台自动重新验证
 * - ⚡ 乐观更新支持
 * - 📊 强大的 DevTools
 * - 🎯 精细的缓存控制
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useKlineData({
 *   symbol: 'btcusdt',
 *   interval: '1m',
 *   staleTime: 5 * 60 * 1000, // 5 分钟内数据被视为新鲜
 * });
 * ```
 */
export function useKlineData(options: UseKlineDataOptions) {
  const {
    symbol,
    interval,
    limit = 100,
    enabled = true,
    staleTime = 5 * 60 * 1000, // 默认 5 分钟
    cacheTime = 10 * 60 * 1000, // 默认 10 分钟
    refetchOnWindowFocus = false,
  } = options;

  const dataSourceRef = useRef<BinanceDataSource | undefined>(undefined);

  // 懒加载数据源
  if (!dataSourceRef.current) {
    dataSourceRef.current = new BinanceDataSource({
      enableCache: false, // TanStack Query 会处理缓存
    });
  }

  return useQuery({
    queryKey: ['kline', symbol, interval, limit],
    queryFn: async () => {
      const data = await dataSourceRef.current!.fetchHistorical(symbol, interval, limit);
      return data;
    },
    enabled,
    staleTime,
    gcTime: cacheTime, // TanStack Query v5 使用 gcTime 替代 cacheTime
    refetchOnWindowFocus,
    // 错误重试配置
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * 使用 WebSocket 订阅实时 K 线数据的 Hook
 *
 * 功能特性：
 * - 📡 实时数据推送
 * - 🔄 自动重连
 * - 🎯 自动更新 TanStack Query 缓存
 * - 🧹 自动清理订阅
 *
 * @example
 * ```tsx
 * const { data, isConnected } = useKlineSubscription({
 *   symbol: 'btcusdt',
 *   interval: '1m',
 *   onUpdate: (kline) => console.log('New kline:', kline),
 * });
 * ```
 */
export function useKlineSubscription(options: {
  symbol: string;
  interval: KlineInterval;
  enabled?: boolean;
  onUpdate?: (data: CandlestickData) => void;
}) {
  const { symbol, interval, enabled = true, onUpdate } = options;
  const queryClient = useQueryClient();
  const wsManager = useRef(WebSocketManager.getInstance());
  const latestDataRef = useRef<CandlestickData | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const key = `${symbol.toLowerCase()}_${interval}`;
    const url = `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_${interval}`;

    // 订阅 WebSocket
    const unsubscribe = wsManager.current.subscribe(
      key,
      url,
      (message: any) => {
        try {
          const kline = message.k;
          if (!kline) return;

          const data: CandlestickData = {
            time: Math.floor(kline.t / 1000) as UTCTimestamp,
            open: parseFloat(kline.o),
            high: parseFloat(kline.h),
            low: parseFloat(kline.l),
            close: parseFloat(kline.c),
          };

          // 保存最新数据
          latestDataRef.current = data;

          // 调用用户回调
          onUpdate?.(data);

          // 乐观更新 TanStack Query 缓存
          queryClient.setQueryData(
            ['kline', symbol, interval, 100],
            (oldData: CandlestickData[] | undefined) => {
              if (!oldData) return oldData;

              // 检查是否是同一根 K 线的更新
              const lastCandle = oldData[oldData.length - 1];
              if (lastCandle && lastCandle.time === data.time) {
                // 更新最后一根 K 线
                return [...oldData.slice(0, -1), data];
              } else {
                // 添加新的 K 线
                return [...oldData, data];
              }
            }
          );
        } catch (error) {
          console.error('[useKlineSubscription] Error processing message:', error);
        }
      },
      5 // 最大重连次数
    );

    return () => {
      unsubscribe();
    };
  }, [symbol, interval, enabled, onUpdate, queryClient]);

  return {
    data: latestDataRef.current,
    isConnected: wsManager.current.getState(`${symbol.toLowerCase()}_${interval}`) === 'CONNECTED',
  };
}

/**
 * 组合 Hook：同时获取历史数据和订阅实时更新
 *
 * @example
 * ```tsx
 * const { data, isLoading, error, latestUpdate } = useKlineWithSubscription({
 *   symbol: 'btcusdt',
 *   interval: '1m',
 * });
 * ```
 */
export function useKlineWithSubscription(options: UseKlineDataOptions) {
  const { data, isLoading, error, refetch } = useKlineData(options);
  const { data: latestUpdate } = useKlineSubscription({
    symbol: options.symbol,
    interval: options.interval,
    enabled: options.enabled,
  });

  return {
    data,
    isLoading,
    error,
    latestUpdate,
    refetch,
  };
}
