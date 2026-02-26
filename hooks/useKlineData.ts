'use client';

import { useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useRef, useMemo } from 'react';
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
 * 无限加载 K 线数据查询选项
 */
interface UseInfiniteKlineDataOptions {
  /** 交易对标识 */
  symbol: string;
  /** K 线时间周期 */
  interval: KlineInterval;
  /** 初始加载数据条数 */
  initialLimit?: number;
  /** 每页数据条数 */
  pageSize?: number;
  /** 是否启用查询 */
  enabled?: boolean;
  /** 数据新鲜度时间（毫秒） */
  staleTime?: number;
  /** 缓存时间（毫秒） */
  cacheTime?: number;
  /** 最大页数限制 */
  maxPages?: number;
}

/**
 * 使用 TanStack Query 无限加载 K 线历史数据的 Hook
 *
 * 功能特性：
 * - 📜 支持无限滚动加载历史数据
 * - 🚀 自动缓存和请求去重
 * - 📊 基于时间戳的分页
 * - 🎯 自动数据合并和去重
 * - 🔒 最大页数限制防止过度加载
 *
 * @example
 * ```tsx
 * const { data, fetchPreviousPage, hasPreviousPage, isFetchingPreviousPage } =
 *   useInfiniteKlineData({
 *     symbol: 'btcusdt',
 *     interval: '1m',
 *     pageSize: 100,
 *     maxPages: 10,
 *   });
 * ```
 */
export function useInfiniteKlineData(options: UseInfiniteKlineDataOptions) {
  const {
    symbol,
    interval,
    initialLimit = 100,
    pageSize = 100,
    enabled = true,
    staleTime = 5 * 60 * 1000,
    cacheTime = 10 * 60 * 1000,
    maxPages = 10,
  } = options;

  const dataSourceRef = useRef<BinanceDataSource | undefined>(undefined);

  // 懒加载数据源
  if (!dataSourceRef.current) {
    dataSourceRef.current = new BinanceDataSource({
      enableCache: false, // TanStack Query 会处理缓存
    });
  }

  const infiniteQuery = useInfiniteQuery<
    CandlestickData[],
    Error,
    { pages: CandlestickData[][]; pageParams: (number | undefined)[] },
    string[],
    number | undefined
  >({
    queryKey: ['kline-infinite', symbol, interval],
    queryFn: async (context) => {
      const { pageParam } = context;

      // 第一页：获取最新的数据
      if (pageParam === undefined) {
        const data = await dataSourceRef.current!.fetchHistorical(
          symbol,
          interval,
          initialLimit
        );
        return data;
      }

      // 后续页：获取指定时间之前的数据
      const data = await dataSourceRef.current!.fetchHistoricalByTimeRange(
        symbol,
        interval,
        {
          endTime: pageParam,
          limit: pageSize,
        }
      );
      return data;
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage, allPages) => {
      // 检查是否达到最大页数
      if (allPages.length >= maxPages) {
        return undefined;
      }

      // 检查是否还有更多数据
      if (!lastPage || lastPage.length === 0) {
        return undefined;
      }

      // 返回最旧的时间戳（毫秒）作为下一页的 endTime
      const oldestTime = lastPage[0].time;
      return oldestTime * 1000;
    },
    enabled,
    staleTime,
    gcTime: cacheTime,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // 扁平化所有页面的数据并去重
  const flattenedData = useMemo(() => {
    if (!infiniteQuery.data?.pages) return [];

    // 合并所有页面
    const allData: CandlestickData[] = infiniteQuery.data.pages.flat();

    // 按时间去重（使用 Map 保证唯一性）
    const uniqueData = Array.from(
      new Map(allData.map((item: CandlestickData) => [item.time, item])).values()
    );

    // 按时间排序（从旧到新）
    return uniqueData.sort((a: CandlestickData, b: CandlestickData) => a.time - b.time);
  }, [infiniteQuery.data?.pages]);

  return {
    data: flattenedData,
    isLoading: infiniteQuery.isLoading,
    isFetching: infiniteQuery.isFetching,
    isFetchingNextPage: infiniteQuery.isFetchingNextPage,
    hasNextPage: infiniteQuery.hasNextPage,
    fetchNextPage: infiniteQuery.fetchNextPage,
    error: infiniteQuery.error,
    refetch: infiniteQuery.refetch,
  };
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
