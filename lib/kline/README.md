# K 线图系统 - TanStack Query 优化对比

## 📊 优化总结

### 原版 vs TanStack Query 优化版

| 特性 | 原版 | TanStack Query 优化版 |
|------|------|----------------------|
| **请求管理** | 手动 fetch + 自定义缓存 | TanStack Query 自动管理 ✅ |
| **请求去重** | 需手动实现 | 自动去重 ✅ |
| **缓存策略** | 简单 LRU | 完整缓存生命周期管理 ✅ |
| **后台重新验证** | ❌ 不支持 | 支持 staleTime/refetchInterval ✅ |
| **乐观更新** | 需手动实现 | 内置支持 ✅ |
| **DevTools** | ❌ 无 | React Query DevTools ✅ |
| **代码复杂度** | 较高 | 更简洁 ✅ |
| **React 集成** | useEffect 手动管理 | 完美集成 React 生命周期 ✅ |
| **错误重试** | 手动实现指数退避 | 内置配置 ✅ |
| **独立封装** | 部分独立 | 完全独立，可发布为 npm 包 ✅ |

---

## 🚀 使用示例

### 方式 1：直接使用优化版组件

```tsx
import { KlineChartProvider, OptimizedKlineChart } from '@/lib/kline';

export default function TradingPage() {
  return (
    <KlineChartProvider>
      <div className="grid grid-cols-2 gap-4">
        {/* 多个图表自动共享缓存和 WebSocket 连接 */}
        <OptimizedKlineChart symbol="btcusdt" interval="1m" />
        <OptimizedKlineChart symbol="ethusdt" interval="5m" />
      </div>
    </KlineChartProvider>
  );
}
```

### 方式 2：使用 Hooks 自定义实现

```tsx
import { useKlineData, useKlineSubscription } from '@/lib/kline';

function CustomChart() {
  // 使用 TanStack Query 获取数据
  const { data, isLoading, error, refetch } = useKlineData({
    symbol: 'btcusdt',
    interval: '1m',
    staleTime: 5 * 60 * 1000, // 5 分钟内不重新请求
  });

  // 订阅实时更新（自动更新 TanStack Query 缓存）
  useKlineSubscription({
    symbol: 'btcusdt',
    interval: '1m',
    onUpdate: (kline) => {
      console.log('New kline:', kline);
    },
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message} <button onClick={() => refetch()}>Retry</button></div>;

  return (
    <div>
      <h3>Custom Chart Implementation</h3>
      <p>Latest price: {data?.[data.length - 1]?.close}</p>
      {/* 使用 data 渲染自定义图表 */}
    </div>
  );
}
```

### 方式 3：作为独立库使用

```tsx
import { createKlineChartSystem } from '@/lib/kline';

// 创建独立的 K 线图系统实例
const klineSystem = createKlineChartSystem();

function App() {
  return (
    <div>
      <h1>My Trading App</h1>

      {/* K 线图系统完全独立，不影响应用的其他部分 */}
      <klineSystem.Provider>
        <TradingDashboard />
      </klineSystem.Provider>
    </div>
  );
}
```

---

## 🎯 核心优势详解

### 1. 自动缓存和请求去重

**原版：**
```tsx
// 3 个相同配置的图表 = 3 次 API 请求
<KlineChart symbol="btcusdt" interval="1m" />
<KlineChart symbol="btcusdt" interval="1m" />
<KlineChart symbol="btcusdt" interval="1m" />
```

**优化版：**
```tsx
// 3 个相同配置的图表 = 1 次 API 请求（自动去重）
<OptimizedKlineChart symbol="btcusdt" interval="1m" />
<OptimizedKlineChart symbol="btcusdt" interval="1m" />
<OptimizedKlineChart symbol="btcusdt" interval="1m" />
```

### 2. 智能缓存策略

```tsx
<OptimizedKlineChart
  symbol="btcusdt"
  interval="1m"
  staleTime={5 * 60 * 1000}      // 5 分钟内数据视为新鲜，不重新请求
  refetchOnWindowFocus={false}    // 窗口焦点切换时不重新请求
/>
```

### 3. 后台自动重新验证

```tsx
import { useKlineData } from '@/lib/kline';

function Chart() {
  const { data } = useKlineData({
    symbol: 'btcusdt',
    interval: '1m',
    staleTime: 1000,              // 1 秒后数据过期
    refetchOnWindowFocus: true,   // 窗口焦点时重新验证
  });

  // TanStack Query 会在数据过期时自动后台重新获取
  return <div>...</div>;
}
```

### 4. 乐观更新

```tsx
// WebSocket 推送的数据会自动更新 TanStack Query 缓存
useKlineSubscription({
  symbol: 'btcusdt',
  interval: '1m',
  // 新数据会自动更新所有使用相同 queryKey 的组件
});
```

### 5. 强大的 DevTools

```tsx
<KlineChartProvider showDevTools={true}>
  <OptimizedKlineChart symbol="btcusdt" interval="1m" />
</KlineChartProvider>

// 自动显示 React Query DevTools
// - 查看所有查询状态
// - 实时监控缓存
// - 手动触发重新获取
// - 查看网络请求时间线
```

---

## 📦 独立封装

### 作为 npm 包发布

K 线图系统现在完全独立，可以轻松发布为 npm 包：

```json
// package.json
{
  "name": "@your-org/kline-chart",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "peerDependencies": {
    "react": "^18.0.0 || ^19.0.0",
    "@tanstack/react-query": "^5.0.0",
    "lightweight-charts": "^5.0.0"
  }
}
```

### 使用发布的包

```bash
npm install @your-org/kline-chart
```

```tsx
import { KlineChartProvider, OptimizedKlineChart } from '@your-org/kline-chart';

function App() {
  return (
    <KlineChartProvider>
      <OptimizedKlineChart symbol="btcusdt" interval="1m" />
    </KlineChartProvider>
  );
}
```

---

## 🔧 高级配置

### 自定义 QueryClient

```tsx
import { QueryClient } from '@tanstack/react-query';
import { KlineChartProvider } from '@/lib/kline';

const customQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 60 * 1000,  // 10 分钟
      gcTime: 30 * 60 * 1000,     // 30 分钟
      retry: 5,                    // 重试 5 次
    },
  },
});

function App() {
  return (
    <KlineChartProvider queryClient={customQueryClient}>
      <OptimizedKlineChart symbol="btcusdt" interval="1m" />
    </KlineChartProvider>
  );
}
```

### 自定义数据源

```tsx
import { IKlineDataSource } from '@/lib/kline';

class CustomExchangeDataSource implements IKlineDataSource {
  async fetchHistorical(symbol, interval, limit) {
    // 实现自定义交易所的数据获取逻辑
  }

  subscribe(symbol, interval, callback) {
    // 实现自定义交易所的 WebSocket 订阅
  }

  destroy() {
    // 清理资源
  }
}

// 然后使用自定义数据源创建 Hook
// （需要修改 useKlineData 支持自定义数据源）
```

---

## 📈 性能对比

### 场景 1：3 个相同配置的图表

**原版：**
- ❌ 3 次 REST API 请求
- ❌ 3 个 WebSocket 连接
- ❌ 3 份相同的内存数据

**优化版：**
- ✅ 1 次 REST API 请求（自动去重）
- ✅ 1 个 WebSocket 连接（连接复用）
- ✅ 1 份共享的缓存数据

### 场景 2：快速切换交易对

**原版：**
- ❌ 每次切换都重新请求
- ❌ 无缓存，重复加载

**优化版：**
- ✅ 切换回之前的交易对时使用缓存（5 分钟内）
- ✅ 后台自动验证数据新鲜度
- ✅ 更快的响应速度

### 场景 3：页面刷新

**原版：**
- ❌ 完全重新加载
- ❌ 丢失所有数据

**优化版：**
- ✅ TanStack Query 可以配置持久化到 localStorage
- ✅ 刷新后立即显示缓存数据
- ✅ 后台自动验证并更新

---

## 🎓 最佳实践

### 1. 合理设置 staleTime

```tsx
// K 线数据更新频率较低，可以设置较长的 staleTime
<OptimizedKlineChart
  symbol="btcusdt"
  interval="1d"  // 日线
  staleTime={60 * 60 * 1000}  // 1 小时
/>

<OptimizedKlineChart
  symbol="btcusdt"
  interval="1m"  // 分钟线
  staleTime={1 * 60 * 1000}   // 1 分钟
/>
```

### 2. 使用 Provider 包裹整个应用

```tsx
// app/layout.tsx
import { KlineChartProvider } from '@/lib/kline';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <KlineChartProvider>
          {children}
        </KlineChartProvider>
      </body>
    </html>
  );
}
```

### 3. 配合 Suspense 使用

```tsx
import { Suspense } from 'react';

function App() {
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <OptimizedKlineChart symbol="btcusdt" interval="1m" />
    </Suspense>
  );
}
```

---

## 🔄 迁移指南

### 从原版迁移到优化版

**步骤 1：包裹 Provider**
```tsx
import { KlineChartProvider } from '@/lib/kline';

// 在应用顶层添加 Provider
<KlineChartProvider>
  <App />
</KlineChartProvider>
```

**步骤 2：替换组件**
```tsx
// 原版
import { KlineChart } from '@/components/KlineChart';
<KlineChart symbol="btcusdt" interval="1m" />

// 优化版
import { OptimizedKlineChart } from '@/lib/kline';
<OptimizedKlineChart symbol="btcusdt" interval="1m" />
```

**步骤 3：（可选）添加配置**
```tsx
<OptimizedKlineChart
  symbol="btcusdt"
  interval="1m"
  staleTime={5 * 60 * 1000}
  refetchOnWindowFocus={false}
/>
```

---

## 📝 总结

### 何时使用原版？
- 简单的单页应用
- 不需要复杂缓存策略
- 只有一个图表实例

### 何时使用 TanStack Query 优化版？
- ✅ 多个图表实例
- ✅ 需要智能缓存
- ✅ 需要后台重新验证
- ✅ 需要请求去重
- ✅ 需要 DevTools 调试
- ✅ 需要作为独立库发布
- ✅ **企业级生产环境（强烈推荐）**

---

## 🚀 立即开始

```bash
# 在你的项目中使用
import { KlineChartProvider, OptimizedKlineChart } from '@/lib/kline';

function App() {
  return (
    <KlineChartProvider>
      <OptimizedKlineChart symbol="btcusdt" interval="1m" />
    </KlineChartProvider>
  );
}
```

**享受企业级的 K 线图体验！** 🎉
