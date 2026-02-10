'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  ColorType,
  CandlestickSeries,
} from 'lightweight-charts';
import { Maximize2, Minimize2 } from 'lucide-react';
import { BinanceDataSource } from '@/lib/kline/BinanceDataSource';
import {
  IKlineDataSource,
  KlineInterval,
  KlineChartConfig,
  CandlestickData,
} from '@/lib/kline/types';

/**
 * K 线图组件入参（企业级改进版）
 *
 * - `symbol`：交易标的在 Binance 上的交易对标识（例如 `'btcusdt'`），不区分大小写，默认值为 `'btcusdt'`。
 * - `interval`：K 线时间周期（粒度），默认值为 `'1m'`。
 * - `config`：图表配置选项（可选），支持依赖注入数据源、自定义样式等。
 */
interface KlineChartProps {
  symbol?: string;
  interval?: KlineInterval;
  config?: KlineChartConfig;
}

/**
 * 企业级 K 线图组件
 *
 * 改进特性：
 * - ✅ 移除全局事件污染：使用组件内部状态管理
 * - ✅ WebSocket 连接复用：通过单例管理器避免重复连接
 * - ✅ 数据缓存：避免重复请求历史数据
 * - ✅ 自动重连：WebSocket 断开后自动尝试重连
 * - ✅ 防抖优化：窗口 resize 事件防抖处理
 * - ✅ 数据源抽象：支持依赖注入，易于切换交易所
 * - ✅ 错误处理：统一的错误处理和用户反馈
 * - ✅ 可配置化：支持自定义图表样式和行为
 * - ✅ 性能优化：避免不必要的图表重建
 */
export function KlineChart({
  symbol = 'btcusdt',
  interval = '1m',
  config = {},
}: KlineChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 使用 useMemo 创建数据源实例（避免重复创建）
  const dataSource = useMemo<IKlineDataSource>(() => {
    return (
      config.dataSource ||
      new BinanceDataSource({
        enableCache: config.enableCache ?? true,
        cacheExpiry: config.cacheExpiry,
      })
    );
  }, [config.dataSource, config.enableCache, config.cacheExpiry]);

  /**
   * 切换全屏状态
   */
  const toggleFullscreen = async () => {
    if (!wrapperRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await wrapperRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (error) {
      console.error('Error toggling fullscreen:', error);
    }
  };

  /**
   * 防抖的窗口 resize 处理函数
   */
  const handleResize = useCallback(() => {
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
    }

    resizeTimeoutRef.current = setTimeout(() => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    }, 100);
  }, []);

  /**
   * 监听浏览器全屏状态变化
   */
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);

      if (chartContainerRef.current && chartRef.current) {
        setTimeout(() => {
          chartRef.current?.applyOptions({
            width: chartContainerRef.current!.clientWidth,
            height: document.fullscreenElement ? window.innerHeight - 60 : 400,
          });
        }, 100);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  /**
   * 初始化图表并加载历史数据
   */
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // 创建图表实例
    const defaultChartOptions = {
      layout: {
        background: { type: ColorType.Solid, color: '#111827' },
        textColor: '#9CA3AF',
      },
      grid: {
        vertLines: { color: '#1F2937' },
        horzLines: { color: '#1F2937' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#374151',
      },
      rightPriceScale: {
        borderColor: '#374151',
      },
      crosshair: {
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
    };

    // 合并用户配置
    const chartOptions = config.chartOptions
      ? { ...defaultChartOptions, ...config.chartOptions }
      : defaultChartOptions;

    const chart = createChart(chartContainerRef.current, chartOptions);
    chartRef.current = chart;

    // 创建蜡烛图序列
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10B981',
      downColor: '#EF4444',
      borderVisible: false,
      wickUpColor: '#10B981',
      wickDownColor: '#EF4444',
    });
    seriesRef.current = candlestickSeries;

    // 加载历史数据
    const loadHistoricalData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const data = await dataSource.fetchHistorical(symbol, interval, 100);
        candlestickSeries.setData(data);
        chart.timeScale().fitContent();

        setIsLoading(false);
        config.onLoadingChange?.(false);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load data';
        console.error('[KlineChart] Error loading historical data:', err);
        setError(errorMessage);
        setIsLoading(false);
        config.onError?.(err as Error);
        config.onLoadingChange?.(false);
      }
    };

    loadHistoricalData();

    // 监听窗口 resize
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      chart.remove();
    };
  }, [symbol, interval, dataSource, config, handleResize]);

  /**
   * 订阅实时 K 线数据
   */
  useEffect(() => {
    if (!seriesRef.current) return;

    console.log(`[KlineChart] Subscribing to ${symbol} ${interval}`);

    // 订阅实时数据
    const unsubscribe = dataSource.subscribe(symbol, interval, (data: CandlestickData) => {
      if (seriesRef.current) {
        seriesRef.current.update(data);
      }
    });

    return () => {
      console.log(`[KlineChart] Unsubscribing from ${symbol} ${interval}`);
      unsubscribe();
    };
  }, [symbol, interval, dataSource]);

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
        </div>
        <div className="flex items-center gap-3">
          {isLoading && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs text-gray-400">Loading...</span>
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full" />
              <span className="text-xs text-red-400" title={error}>
                Error
              </span>
            </div>
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
