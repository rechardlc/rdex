'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { IChartApi } from 'lightweight-charts';
import { CandlestickData, KlineInterval } from '@/lib/kline/types';
import { useInfiniteKlineData } from './useKlineData';

/**
 * 自动加载 K 线数据的配置选项
 */
interface UseAutoLoadKlineDataOptions {
  /** 交易对标识 */
  symbol: string;
  /** K 线时间周期 */
  interval: KlineInterval;
  /** 图表实例引用 */
  chartRef: IChartApi | null;
  /** 是否启用自动加载 */
  autoLoad?: boolean;
  /** 初始加载数据条数 */
  initialLimit?: number;
  /** 每页数据条数 */
  pageSize?: number;
  /** 触发加载的阈值（距离边缘的 K 线数量） */
  threshold?: number;
  /** 防抖延迟（毫秒） */
  debounceMs?: number;
  /** 最大页数限制 */
  maxPages?: number;
  /** 数据新鲜度时间（毫秒） */
  staleTime?: number;
}

/**
 * 自动加载 K 线数据的 Hook
 *
 * 功能特性：
 * - 📊 监控图表可见范围
 * - 🔄 自动加载历史数据
 * - ⚡ 防抖优化性能
 * - 🎯 智能触发条件
 * - 🔒 防止重复请求
 *
 * @example
 * ```tsx
 * const { data, isLoading, isFetchingPrevious, hasMore } = useAutoLoadKlineData({
 *   symbol: 'btcusdt',
 *   interval: '1m',
 *   chartRef: chartRef.current,
 *   autoLoad: true,
 * });
 * ```
 */
export function useAutoLoadKlineData(options: UseAutoLoadKlineDataOptions) {
  const {
    symbol,
    interval,
    chartRef,
    autoLoad = true,
    initialLimit = 100,
    pageSize = 100,
    threshold = 20,
    debounceMs = 300,
    maxPages = 10,
    staleTime = 5 * 60 * 1000,
  } = options;

  // 使用无限查询获取数据
  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
    refetch,
  } = useInfiniteKlineData({
    symbol,
    interval,
    initialLimit,
    pageSize,
    enabled: true,
    staleTime,
    maxPages,
  });

  // 跟踪触发次数（用于指数退避）
  const triggerCountRef = useRef(0);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const isLoadingRef = useRef(false);

  /**
   * 检查是否需要加载更多数据
   */
  const checkNeedMoreData = useCallback(() => {
    if (!chartRef || !autoLoad || !data || data.length === 0) {
      return false;
    }

    // 如果正在加载或没有更多数据，跳过
    if (isLoadingRef.current || !hasNextPage) {
      return false;
    }

    try {
      const timeScale = chartRef.timeScale();
      const visibleRange = timeScale.getVisibleLogicalRange();

      if (!visibleRange) {
        return false;
      }

      const { from, to } = visibleRange;
      const visibleCandles = to - from;
      const totalCandles = data.length;

      // 条件 1: 接近左边缘（历史数据）
      const nearLeftEdge = from < threshold;

      // 条件 2: 视口大部分为空
      const viewportMostlyEmpty = visibleCandles < totalCandles * 0.5;

      // 条件 3: 放大后视口占据大部分数据
      const zoomedOutSignificantly = visibleCandles > totalCandles * 0.8;

      return nearLeftEdge || viewportMostlyEmpty || zoomedOutSignificantly;
    } catch (error) {
      console.error('[useAutoLoadKlineData] Error checking need for more data:', error);
      return false;
    }
  }, [chartRef, autoLoad, data, hasNextPage, threshold]);

  /**
   * 触发加载更多数据（带防抖）
   */
  const triggerLoadMore = useCallback(() => {
    if (!autoLoad || !hasNextPage || isLoadingRef.current) {
      return;
    }

    // 清除之前的定时器
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // 计算防抖延迟（指数退避）
    const delay = Math.min(debounceMs * Math.pow(1.5, triggerCountRef.current), 2000);

    debounceTimerRef.current = setTimeout(() => {
      if (checkNeedMoreData()) {
        isLoadingRef.current = true;
        triggerCountRef.current += 1;

        fetchNextPage().finally(() => {
          isLoadingRef.current = false;
          // 重置触发计数（成功加载后）
          setTimeout(() => {
            triggerCountRef.current = 0;
          }, 5000);
        });
      }
    }, delay);
  }, [autoLoad, hasNextPage, debounceMs, checkNeedMoreData, fetchNextPage]);

  /**
   * 监控可见范围变化
   */
  useEffect(() => {
    if (!chartRef || !autoLoad || !data || data.length === 0) {
      return;
    }

    let isSubscribed = true;

    // 使用 RAF 优化性能
    const handleVisibleRangeChange = () => {
      if (!isSubscribed) return;

      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }

      rafIdRef.current = requestAnimationFrame(() => {
        if (isSubscribed) {
          triggerLoadMore();
        }
        rafIdRef.current = null;
      });
    };

    // 订阅可见范围变化
    const timeScale = chartRef.timeScale();
    const unsubscribe = timeScale.subscribeVisibleLogicalRangeChange(
      handleVisibleRangeChange
    );

    // 初始检查
    handleVisibleRangeChange();

    return () => {
      isSubscribed = false;
      unsubscribe();

      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [chartRef, autoLoad, data, triggerLoadMore]);

  // 手动加载更多
  const loadMore = useCallback(() => {
    if (hasNextPage && !isLoadingRef.current) {
      isLoadingRef.current = true;
      fetchNextPage().finally(() => {
        isLoadingRef.current = false;
      });
    }
  }, [hasNextPage, fetchNextPage]);

  return {
    data,
    isLoading,
    isFetching,
    isFetchingPrevious: isFetchingNextPage,
    hasMore: hasNextPage ?? false,
    error,
    loadMore,
    refetch,
  };
}
