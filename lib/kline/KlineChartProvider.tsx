'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ReactNode } from 'react';

/**
 * K 线图系统的独立 Provider
 *
 * 特性：
 * - 🎯 完全独立，不依赖应用的 QueryClient
 * - 📊 内置 React Query DevTools
 * - ⚙️ 针对 K 线数据优化的缓存配置
 * - 🔧 可配置的查询选项
 */
interface KlineChartProviderProps {
  children: ReactNode;
  /** 自定义 QueryClient（可选） */
  queryClient?: QueryClient;
  /** 是否显示 DevTools */
  showDevTools?: boolean;
}

// 创建专门用于 K 线图的 QueryClient
const createKlineQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        // K 线数据在 5 分钟内视为新鲜
        staleTime: 5 * 60 * 1000,
        // 缓存数据保留 10 分钟
        gcTime: 10 * 60 * 1000,
        // 错误重试
        retry: 3,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        // 不在窗口焦点时自动重新获取（金融数据通常不需要）
        refetchOnWindowFocus: false,
        // 不在重新连接时自动重新获取
        refetchOnReconnect: false,
      },
    },
  });

/**
 * K 线图系统的 Provider 组件
 *
 * 使用方式：
 *
 * @example
 * ```tsx
 * // 方式 1：独立使用（推荐用于独立封装）
 * <KlineChartProvider>
 *   <OptimizedKlineChart symbol="btcusdt" interval="1m" />
 * </KlineChartProvider>
 *
 * // 方式 2：使用自定义 QueryClient
 * const myQueryClient = new QueryClient();
 * <KlineChartProvider queryClient={myQueryClient}>
 *   <OptimizedKlineChart symbol="btcusdt" interval="1m" />
 * </KlineChartProvider>
 * ```
 */
export function KlineChartProvider({
  children,
  queryClient,
  showDevTools = process.env.NODE_ENV === 'development',
}: KlineChartProviderProps) {
  // 使用提供的 QueryClient 或创建新的
  const client = queryClient || createKlineQueryClient();

  return (
    <QueryClientProvider client={client}>
      {children}
      {showDevTools && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}

/**
 * 导出工厂函数，用于创建独立的 K 线图系统实例
 */
export const createKlineChartSystem = () => {
  const queryClient = createKlineQueryClient();

  return {
    queryClient,
    Provider: ({ children }: { children: ReactNode }) => (
      <KlineChartProvider queryClient={queryClient}>{children}</KlineChartProvider>
    ),
  };
};
