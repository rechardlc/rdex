/**
 * K 线图系统 - 统一导出入口
 *
 * 这是一个完全独立的 K 线图系统，可以作为独立包发布。
 *
 * ## 使用方式
 *
 * ### 基础使用
 * ```tsx
 * import { KlineChartProvider, OptimizedKlineChart } from '@/lib/kline';
 *
 * function App() {
 *   return (
 *     <KlineChartProvider>
 *       <OptimizedKlineChart symbol="btcusdt" interval="1m" />
 *     </KlineChartProvider>
 *   );
 * }
 * ```
 *
 * ### 使用 Hooks
 * ```tsx
 * import { useKlineData, useKlineSubscription } from '@/lib/kline';
 *
 * function CustomChart() {
 *   const { data, isLoading } = useKlineData({
 *     symbol: 'ethusdt',
 *     interval: '5m',
 *   });
 *
 *   useKlineSubscription({
 *     symbol: 'ethusdt',
 *     interval: '5m',
 *     onUpdate: (kline) => console.log('New data:', kline),
 *   });
 *
 *   return <div>Custom implementation</div>;
 * }
 * ```
 *
 * ### 作为独立库使用
 * ```tsx
 * import { createKlineChartSystem } from '@/lib/kline';
 *
 * const klineSystem = createKlineChartSystem();
 *
 * function App() {
 *   return (
 *     <klineSystem.Provider>
 *       <YourComponents />
 *     </klineSystem.Provider>
 *   );
 * }
 * ```
 */

// ============= 核心组件 =============
export { OptimizedKlineChart } from '@/components/OptimizedKlineChart';
export { KlineChart } from '@/components/KlineChart';

// ============= Provider 和系统工厂 =============
export { KlineChartProvider, createKlineChartSystem } from './KlineChartProvider';

// ============= Hooks =============
export {
  useKlineData,
  useKlineSubscription,
  useKlineWithSubscription,
} from '@/hooks/useKlineData';

// ============= 类型定义 =============
export type {
  CandlestickData,
  KlineInterval,
  IKlineDataSource,
  KlineChartConfig,
} from './types';

// ============= 数据源实现 =============
export { BinanceDataSource } from './BinanceDataSource';
export { WebSocketManager } from './WebSocketManager';
export { DataCache } from './DataCache';

// ============= 错误类型 =============
export { DataSourceError } from './types';
