'use client';

import { useEffect, useRef, useCallback, useSyncExternalStore } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  ColorType,
  CandlestickSeries,
} from 'lightweight-charts';
import { Maximize2, Minimize2, AlertCircle, Loader2 } from 'lucide-react';
import { useKlineData, useKlineSubscription } from '@/hooks/useKlineData';
import { useAutoLoadKlineData } from '@/hooks/useAutoLoadKlineData';
import { CandlestickData, KlineInterval } from '@/lib/kline/types';

/**
 * 根据容器宽度计算合适的 barSpacing（纯函数，无副作用）
 */
function calculateBarSpacing(width: number): number {
  if (width < 768) return 4;
  if (width < 1200) return 6;
  if (width < 1600) return 8;
  return 10;
}

/**
 * 优化版 K 线图组件（基于 TanStack Query）
 *
 * 核心优势：
 * - ✅ TanStack Query 缓存和请求优化
 * - ✅ 自动后台重新验证
 * - ✅ 请求去重
 * - ✅ 更简洁的代码结构
 * - ✅ 更好的 React 集成
 * - ✅ 自动加载历史数据（可选）
 */
interface OptimizedKlineChartProps {
  symbol?: string;
  interval?: KlineInterval;
  /** 数据新鲜度时间（毫秒） */
  staleTime?: number;
  /** 是否启用后台重新验证 */
  refetchOnWindowFocus?: boolean;
  /** 是否启用自动加载历史数据 */
  enableAutoLoad?: boolean;
  /** 自动加载配置 */
  autoLoadOptions?: {
    /** 每页数据条数 */
    pageSize?: number;
    /** 触发加载的阈值（距离边缘的 K 线数量） */
    threshold?: number;
    /** 最大页数限制 */
    maxPages?: number;
  };
}

export function OptimizedKlineChart({
  symbol = 'btcusdt',
  interval = '1m',
  staleTime = 5 * 60 * 1000,
  refetchOnWindowFocus = false,
  enableAutoLoad = false,
  autoLoadOptions = {},
}: OptimizedKlineChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * 使用 useSyncExternalStore 订阅全屏状态，消除 isFullscreen 冗余 state
   * 全屏变化时同时触发图表 resize
   */
  const isFullscreen = useSyncExternalStore(
    useCallback((onStoreChange: () => void) => {
      const handleFullscreenChange = () => {
        onStoreChange();
        // 延迟执行 resize，等待浏览器完成全屏过渡
        setTimeout(() => {
          if (chartContainerRef.current && chartRef.current) {
            const width = chartContainerRef.current.clientWidth;
            chartRef.current.applyOptions({
              width,
              height: document.fullscreenElement ? window.innerHeight - 60 : 400,
            });
            chartRef.current.timeScale().applyOptions({
              barSpacing: calculateBarSpacing(width),
            });
          }
        }, 100);
      };
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []),
    () => !!document.fullscreenElement,
    () => false
  );

  // 根据配置选择使用普通加载或自动加载
  const normalData = useKlineData({
    symbol,
    interval,
    staleTime,
    refetchOnWindowFocus,
    enabled: !enableAutoLoad,
  });

  const autoLoadData = useAutoLoadKlineData({
    symbol,
    interval,
    chartRef: chartRef.current,
    autoLoad: enableAutoLoad,
    staleTime,
    ...autoLoadOptions,
  });

  // 根据模式选择数据源
  const { data, isLoading, error, refetch } = enableAutoLoad ? autoLoadData : normalData;
  const isFetchingPrevious = enableAutoLoad ? autoLoadData.isFetchingPrevious : false;
  const hasMore = enableAutoLoad ? autoLoadData.hasMore : false;

  /**
   * 稳定的 onUpdate 回调，避免 useKlineSubscription 因回调变化而重复订阅
   * 使用 ref 获取 seriesRef.current，保证始终拿到最新实例
   */
  const handleKlineUpdate = useCallback((klineData: CandlestickData) => {
    seriesRef.current?.update(klineData);
  }, []);

  useKlineSubscription({
    symbol,
    interval,
    enabled: !!data && !isLoading,
    onUpdate: handleKlineUpdate,
  });

  /**
   * 切换全屏（事件处理函数，无 Effect）
   * 全屏状态由 useSyncExternalStore 订阅 fullscreenchange 自动同步
   */
  const toggleFullscreen = useCallback(async () => {
    if (!wrapperRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await wrapperRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error('Error toggling fullscreen:', error);
    }
  }, []);

  /**
   * 防抖 resize 处理（事件处理函数）
   */
  const handleResize = useCallback(() => {
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
    }
    resizeTimeoutRef.current = setTimeout(() => {
      if (chartContainerRef.current && chartRef.current) {
        const width = chartContainerRef.current.clientWidth;
        chartRef.current.applyOptions({ width });
        chartRef.current.timeScale().applyOptions({
          barSpacing: calculateBarSpacing(width),
        });
      }
    }, 100);
  }, []);

  /**
   * 初始化图表（与 DOM + lightweight-charts 外部系统同步，必须保留 Effect）
   */
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const width = chartContainerRef.current.clientWidth;
    const barSpacing = calculateBarSpacing(width);

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#111827' },
        textColor: '#9CA3AF',
      },
      grid: {
        vertLines: { color: '#1F2937' },
        horzLines: { color: '#1F2937' },
      },
      width,
      height: 400,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#374151',
        barSpacing,
      },
      rightPriceScale: {
        borderColor: '#374151',
      },
      crosshair: {
        mode: 0, // 0 = Normal, 1 = Magnet
        vertLine: {
          color: '#6B7280',
          width: 1 as const,
          style: 2,
          labelBackgroundColor: '#374151',
        },
        horzLine: {
          color: '#6B7280',
          width: 1 as const,
          style: 2,
          labelBackgroundColor: '#374151',
        },
      },
    });

    chartRef.current = chart;

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10B981',
      downColor: '#EF4444',
      borderVisible: false,
      wickUpColor: '#10B981',
      wickDownColor: '#EF4444',
    });

    seriesRef.current = candlestickSeries;

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      chart.remove();
    };
  }, [handleResize]);

  /**
   * 当数据加载完成后更新图表
   */
  useEffect(() => {
    if (data && seriesRef.current) {
      seriesRef.current.setData(data);
    }
  }, [data]);

  return (
    <div
      ref={wrapperRef}
      className="w-full bg-gray-900 rounded-lg overflow-hidden border border-gray-800"
    >
      {/* Header */}
      <div className="bg-gray-800 px-4 py-2 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-sm font-semibold text-white">
            {symbol.toUpperCase()} / USDT
          </h2>
          <span className="text-xs text-gray-400">{interval}</span>
          {staleTime && (
            <span className="text-xs text-gray-500" title="Cache stale time">
              🚀 {staleTime / 1000}s cache
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isLoading && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              <span className="text-xs text-gray-400">Loading...</span>
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span className="text-xs text-red-400" title={(error as Error).message}>
                Error
              </span>
              <button
                onClick={() => refetch()}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                Retry
              </button>
            </div>
          )}
          {enableAutoLoad && isFetchingPrevious && (
            <div className="flex items-center gap-2">
              <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
              <span className="text-xs text-gray-400">Loading history...</span>
            </div>
          )}
          {enableAutoLoad && !hasMore && data && data.length > 100 && (
            <span className="text-xs text-gray-500" title="No more historical data available">
              📊 All data loaded
            </span>
          )}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 hover:bg-gray-700 rounded transition-colors"
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4 text-gray-400" />
            ) : (
              <Maximize2 className="w-4 h-4 text-gray-400" />
            )}
          </button>
        </div>
      </div>

      {/* Chart */}
      <div ref={chartContainerRef} className="w-full" />
    </div>
  );
}
