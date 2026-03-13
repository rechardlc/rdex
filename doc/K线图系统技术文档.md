# K 线图系统技术文档

## 系统概述

这是一个企业级的 K 线图（蜡烛图）实时数据可视化系统，专为加密货币交易平台设计。系统采用模块化架构，具备高性能、高可用性和良好的可扩展性。

**核心技术栈**：React + TypeScript + TanStack Query + lightweight-charts + WebSocket

**主要特性**：
- 📊 实时 K 线数据展示（基于 WebSocket）
- 💾 TanStack Query 智能缓存（自动去重、后台重新验证）
- 🔄 自动重连机制（指数退避算法）
- 🎨 全屏模式支持
- 🔌 可插拔数据源架构
- ⚡ 性能优化（防抖、单例模式、请求合并）
- ✨ 基于 React Hooks 的现代化 API

---

## 架构设计

### 系统架构图

#### 优化版架构（基于 TanStack Query）

```
┌─────────────────────────────────────────────────────────────┐
│              OptimizedKlineChart Component                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  UI Layer (React Component)                          │  │
│  │  - 全屏控制                                           │  │
│  │  - 加载/错误状态展示                                  │  │
│  │  - 图表渲染                                           │  │
│  └──────────────────────────────────────────────────────┘  │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│              React Hooks Layer (自定义 Hooks)                │
│  ┌──────────────────┐         ┌────────────────────────┐   │
│  │  useKlineData    │         │ useKlineSubscription   │   │
│  │  (历史数据)       │         │  (实时订阅)             │   │
│  │  - TanStack Query│         │  - WebSocket 管理      │   │
│  │  - 缓存管理       │         │  - 增量更新            │   │
│  └──────────────────┘         └────────────────────────┘   │
└───────────────────┬──────────────────┬──────────────────────┘
                    │                  │
                    ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                  TanStack Query Layer                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Query Cache (自动管理)                               │  │
│  │  - 请求去重                                           │  │
│  │  - 数据缓存                                           │  │
│  │  - 后台重新验证                                       │  │
│  │  - 过期控制                                           │  │
│  └──────────────────────────────────────────────────────┘  │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│              IKlineDataSource (抽象接口)                     │
│  - fetchHistorical(): 获取历史数据                          │
│  - subscribe(): 订阅实时推送                                │
│  - destroy(): 资源清理                                      │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│              BinanceDataSource (实现类)                      │
│  ┌──────────────┐    ┌──────────────┐    ┌─────────────┐  │
│  │   REST API   │    │  WebSocket   │    │   数据验证   │  │
│  │  历史K线数据  │    │  实时推送    │    │   错误处理   │  │
│  └──────────────┘    └──────────────┘    └─────────────┘  │
│         │                    │                              │
│         ▼                    ▼                              │
│  ┌──────────────────────────────────────────────────┐      │
│  │            单例模式基础设施层                      │      │
│  │  ┌──────────────────┐  ┌──────────────────┐     │      │
│  │  │  DataCache       │  │ WebSocketManager │     │      │
│  │  │  (数据缓存)       │  │  (连接管理器)     │     │      │
│  │  │  - LRU 策略      │  │  - 连接复用       │     │      │
│  │  │  - 过期控制      │  │  - 自动重连       │     │      │
│  │  └──────────────────┘  └──────────────────┘     │      │
│  └──────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
                    │                    │
                    ▼                    ▼
          ┌─────────────────┐  ┌─────────────────┐
          │  Binance REST   │  │ Binance WebSocket│
          │      API        │  │     Stream       │
          └─────────────────┘  └─────────────────┘
```

### 设计模式

1. **单例模式（Singleton）**
   - `WebSocketManager`: 全局 WebSocket 连接管理
   - `DataCache`: 全局数据缓存

2. **策略模式（Strategy）**
   - `IKlineDataSource`: 定义数据源接口
   - 支持切换不同交易所（Binance、OKX 等）

3. **观察者模式（Observer）**
   - WebSocket 订阅/取消订阅机制
   - 多组件共享同一数据流

4. **依赖注入（Dependency Injection）**
   - 组件接收外部数据源实例
   - 便于单元测试和扩展

---

## 核心模块详解

### 1. 类型定义 ([lib/kline/types.ts](lib/kline/types.ts))

#### 1.1 K 线数据结构

```typescript
interface CandlestickData {
  time: UTCTimestamp;  // 时间戳（秒级）
  open: number;        // 开盘价
  high: number;        // 最高价
  low: number;         // 最低价
  close: number;       // 收盘价
}
```

#### 1.2 时间周期类型

```typescript
type KlineInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
```

支持的时间周期：1分钟、5分钟、15分钟、1小时、4小时、1天

#### 1.3 数据源接口

```typescript
interface IKlineDataSource {
  fetchHistorical(symbol: string, interval: KlineInterval, limit?: number): Promise<CandlestickData[]>;
  subscribe(symbol: string, interval: KlineInterval, callback: (data: CandlestickData) => void): () => void;
  destroy(): void;
}
```

**设计理念**：通过接口抽象实现数据源解耦，方便接入不同交易所。

#### 1.4 WebSocket 状态

```typescript
enum WebSocketState {
  CONNECTING = 'CONNECTING',      // 连接中
  CONNECTED = 'CONNECTED',        // 已连接
  DISCONNECTED = 'DISCONNECTED',  // 已断开
  RECONNECTING = 'RECONNECTING',  // 重连中
  FAILED = 'FAILED',              // 连接失败
}
```

---

### 2. 数据缓存 ([lib/kline/DataCache.ts](lib/kline/DataCache.ts))

#### 2.1 缓存策略

采用 **LRU（Least Recently Used）** 策略：
- 最大缓存 50 条记录
- 默认过期时间 5 分钟
- 访问时自动刷新顺序

#### 2.2 核心方法

**存储数据** ([DataCache.ts:37](lib/kline/DataCache.ts#L37))
```typescript
set<T>(key: string, data: T, expiry?: number): void
```
- 自动淘汰最旧条目
- 支持自定义过期时间

**获取数据** ([DataCache.ts:61](lib/kline/DataCache.ts#L61))
```typescript
get<T>(key: string): T | null
```
- 自动检查过期时间
- 实现 LRU 顺序更新

#### 2.3 使用示例

```typescript
const cache = DataCache.getInstance();
cache.set('btcusdt_1m_100', klineData, 300000); // 缓存 5 分钟
const cached = cache.get<CandlestickData[]>('btcusdt_1m_100');
```

---

### 3. WebSocket 管理器 ([lib/kline/WebSocketManager.ts](lib/kline/WebSocketManager.ts))

#### 3.1 连接复用机制

**核心原理**：同一个 WebSocket URL 只创建一个连接实例，多个组件共享。

```typescript
// 组件 A 订阅
wsManager.subscribe('btcusdt_1m', url, callbackA);

// 组件 B 订阅同一数据流（复用连接）
wsManager.subscribe('btcusdt_1m', url, callbackB);
```

#### 3.2 自动重连策略

**指数退避算法** ([WebSocketManager.ts:170](lib/kline/WebSocketManager.ts#L170))：
- 第 1 次重连：延迟 1 秒
- 第 2 次重连：延迟 2 秒
- 第 3 次重连：延迟 4 秒
- 第 4 次重连：延迟 8 秒
- 第 5 次重连：延迟 16 秒（最大）
- 超过 5 次后标记为 FAILED

```typescript
const delay = Math.min(1000 * Math.pow(2, attempts - 1), 16000);
```

#### 3.3 订阅管理

**订阅结构** ([WebSocketManager.ts:40-68](lib/kline/WebSocketManager.ts#L40-L68))：
```typescript
interface WebSocketSubscription {
  key: string;                          // 唯一标识
  url: string;                          // WebSocket 地址
  callbacks: Set<(data: any) => void>;  // 回调函数集合
  state: WebSocketState;                // 连接状态
  reconnectAttempts: number;            // 重连次数
  maxReconnectAttempts: number;         // 最大重连次数
}
```

**自动清理机制** ([WebSocketManager.ts:83](lib/kline/WebSocketManager.ts#L83))：
- 当所有回调函数被移除时，自动关闭连接
- 避免资源泄漏

---

### 4. Binance 数据源 ([lib/kline/BinanceDataSource.ts](lib/kline/BinanceDataSource.ts))

#### 4.1 REST API 集成

**端点配置**：
- REST API: `https://api.binance.com/api/v3`
- WebSocket: `wss://stream.binance.com:9443/ws`

**获取历史数据** ([BinanceDataSource.ts:46-92](lib/kline/BinanceDataSource.ts#L46-L92))：
```typescript
async fetchHistorical(symbol: string, interval: KlineInterval, limit = 100): Promise<CandlestickData[]>
```

**流程**：
1. 检查缓存（命中则直接返回）
2. 发起 REST API 请求
3. 失败时自动重试（最多 3 次）
4. 解析并验证数据
5. 存入缓存

**重试策略**：
- 最大重试次数：3 次
- 重试延迟：1 秒 × 当前次数

#### 4.2 数据解析与验证

**解析 Binance K 线格式** ([BinanceDataSource.ts:127-158](lib/kline/BinanceDataSource.ts#L127-L158))：
```typescript
private parseKlineData(kline: string[]): CandlestickData {
  const [openTime, open, high, low, close] = kline;

  // 时间戳转换（毫秒 → 秒）
  const time = Math.floor(Number(openTime) / 1000) as UTCTimestamp;

  // 数值验证
  if (isNaN(time) || isNaN(openPrice) || ...) {
    throw new DataSourceError('Invalid numeric values');
  }

  return { time, open, high, low, close };
}
```

#### 4.3 WebSocket 实时订阅

**订阅流程** ([BinanceDataSource.ts:163-215](lib/kline/BinanceDataSource.ts#L163-L215))：
```typescript
subscribe(symbol: string, interval: KlineInterval, callback: (data: CandlestickData) => void): () => void
```

1. 构造 WebSocket 地址：`wss://stream.binance.com:9443/ws/btcusdt@kline_1m`
2. 调用 `WebSocketManager.subscribe()`
3. 解析 Binance 消息格式
4. 验证数据有效性
5. 调用回调函数

**Binance WebSocket 消息格式**：
```json
{
  "k": {
    "t": 1672531200000,  // 开盘时间（毫秒）
    "o": "16500.00",     // 开盘价
    "h": "16600.00",     // 最高价
    "l": "16400.00",     // 最低价
    "c": "16550.00"      // 收盘价
  }
}
```

---

### 5. K 线图组件 ([components/KlineChart.tsx](components/KlineChart.tsx))

#### 5.1 组件 Props

```typescript
interface KlineChartProps {
  symbol?: string;           // 交易对，默认 'btcusdt'
  interval?: KlineInterval;  // 时间周期，默认 '1m'
  config?: KlineChartConfig; // 可选配置
}

interface KlineChartConfig {
  dataSource?: IKlineDataSource;      // 自定义数据源
  chartOptions?: DeepPartial<ChartOptions>; // 图表样式
  onError?: (error: Error) => void;   // 错误回调
  onLoadingChange?: (loading: boolean) => void; // 加载状态回调
  enableCache?: boolean;              // 启用缓存，默认 true
  cacheExpiry?: number;               // 缓存过期时间（毫秒）
}
```

#### 5.2 状态管理

**内部状态**：
- `isLoading`: 历史数据加载状态
- `isFullscreen`: 全屏模式标志
- `error`: 错误信息

**Refs 引用**：
- `chartContainerRef`: 图表容器 DOM
- `wrapperRef`: 全屏包装器 DOM
- `chartRef`: lightweight-charts 实例
- `seriesRef`: 蜡烛图序列实例
- `resizeTimeoutRef`: 防抖定时器

#### 5.3 生命周期管理

**图表初始化** ([KlineChart.tsx:135-226](components/KlineChart.tsx#L135-L226))：
```typescript
useEffect(() => {
  // 1. 创建图表实例
  const chart = createChart(chartContainerRef.current, chartOptions);

  // 2. 添加蜡烛图序列
  const candlestickSeries = chart.addSeries(CandlestickSeries, {...});

  // 3. 加载历史数据
  const data = await dataSource.fetchHistorical(symbol, interval, 100);
  candlestickSeries.setData(data);

  // 4. 监听窗口 resize
  window.addEventListener('resize', handleResize);

  // 5. 清理
  return () => {
    chart.remove();
    window.removeEventListener('resize', handleResize);
  };
}, [symbol, interval, dataSource]);
```

**实时数据订阅** ([KlineChart.tsx:231-247](components/KlineChart.tsx#L231-L247))：
```typescript
useEffect(() => {
  const unsubscribe = dataSource.subscribe(symbol, interval, (data) => {
    seriesRef.current?.update(data);
  });

  return () => unsubscribe();
}, [symbol, interval, dataSource]);
```

#### 5.4 全屏功能

**切换全屏** ([KlineChart.tsx:76-90](components/KlineChart.tsx#L76-L90))：
```typescript
const toggleFullscreen = async () => {
  if (!document.fullscreenElement) {
    await wrapperRef.current.requestFullscreen();
  } else {
    await document.exitFullscreen();
  }
};
```

**监听全屏状态变化** ([KlineChart.tsx:112-130](components/KlineChart.tsx#L112-L130))：
- 监听 `fullscreenchange` 事件
- 自动调整图表尺寸
  - 全屏模式：`window.innerHeight - 60`
  - 普通模式：`400px`

#### 5.5 性能优化

**防抖处理** ([KlineChart.tsx:95-107](components/KlineChart.tsx#L95-L107))：
```typescript
const handleResize = useCallback(() => {
  if (resizeTimeoutRef.current) {
    clearTimeout(resizeTimeoutRef.current);
  }

  resizeTimeoutRef.current = setTimeout(() => {
    chartRef.current?.applyOptions({
      width: chartContainerRef.current.clientWidth,
    });
  }, 100); // 100ms 防抖
}, []);
```

**数据源实例缓存** ([KlineChart.tsx:63-71](components/KlineChart.tsx#L63-L71))：
```typescript
const dataSource = useMemo<IKlineDataSource>(() => {
  return config.dataSource || new BinanceDataSource({...});
}, [config.dataSource, config.enableCache, config.cacheExpiry]);
```

---

## 使用指南

### 基础用法

```tsx
import { KlineChart } from '@/components/KlineChart';

function TradingPage() {
  return <KlineChart symbol="btcusdt" interval="1m" />;
}
```

### 高级配置

```tsx
<KlineChart
  symbol="ethusdt"
  interval="15m"
  config={{
    enableCache: true,
    cacheExpiry: 300000, // 5 分钟
    onLoadingChange: (loading) => {
      console.log('加载状态:', loading);
    },
    onError: (err) => {
      console.error('图表错误:', err);
    },
    chartOptions: {
      layout: {
        background: { color: '#000000' },
        textColor: '#ffffff',
      },
      grid: {
        vertLines: { color: '#1a1a1a' },
        horzLines: { color: '#1a1a1a' },
      },
    },
  }}
/>
```

### 自定义数据源

```typescript
import { IKlineDataSource, CandlestickData, KlineInterval } from '@/lib/kline/types';

class OKXDataSource implements IKlineDataSource {
  async fetchHistorical(symbol: string, interval: KlineInterval, limit?: number): Promise<CandlestickData[]> {
    // 实现 OKX REST API 调用
    const response = await fetch(`https://www.okx.com/api/v5/market/candles?instId=${symbol}&bar=${interval}`);
    const data = await response.json();
    return this.parseOKXData(data);
  }

  subscribe(symbol: string, interval: KlineInterval, callback: (data: CandlestickData) => void): () => void {
    // 实现 OKX WebSocket 订阅
    const ws = new WebSocket(`wss://ws.okx.com:8443/ws/v5/public`);
    ws.send(JSON.stringify({
      op: 'subscribe',
      args: [{ channel: 'candle' + interval, instId: symbol }]
    }));
    ws.onmessage = (event) => {
      const data = this.parseOKXMessage(event.data);
      callback(data);
    };
    return () => ws.close();
  }

  destroy(): void {
    // 清理资源
  }
}

// 使用自定义数据源
<KlineChart
  symbol="BTC-USDT"
  interval="1m"
  config={{
    dataSource: new OKXDataSource(),
  }}
/>
```

---

## 样式配置

### 默认主题（深色模式）

```typescript
const defaultChartOptions = {
  layout: {
    background: { color: '#111827' },  // 背景色（灰-900）
    textColor: '#9CA3AF',             // 文字颜色（灰-400）
  },
  grid: {
    vertLines: { color: '#1F2937' },   // 垂直网格线（灰-800）
    horzLines: { color: '#1F2937' },   // 水平网格线（灰-800）
  },
  timeScale: {
    borderColor: '#374151',            // 时间轴边框（灰-700）
  },
  rightPriceScale: {
    borderColor: '#374151',            // 价格轴边框（灰-700）
  },
  crosshair: {
    vertLine: { color: '#6B7280' },    // 十字线（灰-500）
    horzLine: { color: '#6B7280' },
  },
};
```

### 蜡烛图颜色

```typescript
const candlestickSeries = chart.addSeries(CandlestickSeries, {
  upColor: '#10B981',        // 上涨蜡烛（绿-500）
  downColor: '#EF4444',      // 下跌蜡烛（红-500）
  wickUpColor: '#10B981',    // 上涨灯芯
  wickDownColor: '#EF4444',  // 下跌灯芯
  borderVisible: false,
});
```

---

## 错误处理

### 错误类型

```typescript
class DataSourceError extends Error {
  code: string;           // 错误代码
  originalError?: unknown; // 原始错误对象
}
```

### 常见错误代码

| 错误代码 | 说明 | 处理方式 |
|---------|------|----------|
| `FETCH_FAILED` | REST API 请求失败 | 自动重试 3 次 |
| `HTTP_ERROR` | HTTP 状态码错误 | 展示错误提示 |
| `INVALID_FORMAT` | 数据格式错误 | 抛出异常 |
| `PARSE_ERROR` | 数据解析失败 | 跳过该条数据 |
| `WS_FAILED` | WebSocket 连接失败 | 自动重连（最多 5 次）|

### 错误监听

```tsx
<KlineChart
  config={{
    onError: (error) => {
      if (error instanceof DataSourceError) {
        console.error(`[${error.code}] ${error.message}`);

        switch (error.code) {
          case 'FETCH_FAILED':
            // 提示用户网络错误
            break;
          case 'INVALID_FORMAT':
            // 联系技术支持
            break;
        }
      }
    },
  }}
/>
```

---

## 性能优化建议

### 1. 缓存配置

```tsx
// 推荐：启用缓存，减少 API 调用
<KlineChart
  config={{
    enableCache: true,
    cacheExpiry: 300000, // 5 分钟
  }}
/>
```

### 2. 限制历史数据条数

```typescript
// 默认加载 100 条，可根据需求调整
dataSource.fetchHistorical(symbol, interval, 50); // 减少到 50 条
```

### 3. 避免频繁切换交易对

```tsx
// ❌ 不推荐：频繁切换
const [symbol, setSymbol] = useState('btcusdt');
setInterval(() => setSymbol(Math.random() > 0.5 ? 'btcusdt' : 'ethusdt'), 1000);

// ✅ 推荐：稳定的交易对
const [symbol, setSymbol] = useState('btcusdt');
```

### 4. 合理设置重连次数

```typescript
// WebSocket 订阅时指定最大重连次数
wsManager.subscribe(key, url, callback, 3); // 最多重连 3 次（默认 5 次）
```

---

## 浏览器兼容性

| 功能 | Chrome | Firefox | Safari | Edge |
|------|--------|---------|--------|------|
| 图表渲染 | ✅ | ✅ | ✅ | ✅ |
| WebSocket | ✅ | ✅ | ✅ | ✅ |
| 全屏 API | 71+ | 64+ | 16.4+ | 79+ |
| Canvas | ✅ | ✅ | ✅ | ✅ |

**最低版本要求**：
- Chrome 71+
- Firefox 64+
- Safari 16.4+
- Edge 79+

---

## 常见问题（FAQ）

### Q1: 图表不显示数据？

**排查步骤**：
1. 检查网络请求是否成功（开发者工具 → Network）
2. 查看控制台是否有错误日志
3. 确认交易对和时间周期参数是否正确
4. 检查 Binance API 是否可访问（可能需要 VPN）

### Q2: WebSocket 频繁断开？

**可能原因**：
- 网络不稳定
- Binance 服务限流
- 浏览器标签页被挂起

**解决方案**：
- 启用自动重连（默认已启用）
- 减少订阅数量
- 使用 Page Visibility API 检测标签页状态

### Q3: 如何切换到其他交易所？

**步骤**：
1. 实现 `IKlineDataSource` 接口
2. 适配对应交易所的 REST API 和 WebSocket 协议
3. 通过 `config.dataSource` 注入自定义实现

示例参考：[自定义数据源](#自定义数据源)

### Q4: 内存占用过高？

**优化措施**：
- 减少缓存条目数：`cache.setMaxSize(20)`
- 降低缓存过期时间：`cacheExpiry: 60000` (1 分钟)
- 限制历史数据条数：`fetchHistorical(symbol, interval, 50)`
- 及时清理不用的订阅

---

## 开发调试

### 启用日志

组件内置了详细的控制台日志：

```
[KlineChart] Subscribing to btcusdt 1m
[BinanceDataSource] Using cached data for btcusdt_1m_100
[WebSocketManager] Connected: btcusdt_1m
[DataCache] Cache hit: btcusdt_1m_100 (age: 12345ms)
```

### 测试数据源

```typescript
import { BinanceDataSource } from '@/lib/kline/BinanceDataSource';

const dataSource = new BinanceDataSource();

// 测试历史数据获取
const data = await dataSource.fetchHistorical('btcusdt', '1m', 10);
console.log('历史数据:', data);

// 测试实时订阅
const unsubscribe = dataSource.subscribe('btcusdt', '1m', (data) => {
  console.log('实时数据:', data);
});

// 取消订阅
setTimeout(() => unsubscribe(), 10000);
```

---

## 相关文档

- **[OptimizedKlineChart React 重构文档](./OptimizedKlineChart-React-Refactoring.md)**：基于 React 最佳实践的 useEffect 重构、useSyncExternalStore 全屏订阅、性能优化说明

---

## 项目结构

```
components/
  ├── KlineChart.tsx          # 经典 K 线图组件
  └── OptimizedKlineChart.tsx # 优化版 K 线图（TanStack Query + React 最佳实践）

lib/kline/
  ├── types.ts                # TypeScript 类型定义
  ├── BinanceDataSource.ts    # Binance 数据源实现
  ├── WebSocketManager.ts     # WebSocket 连接管理器（单例）
  ├── DataCache.ts            # 数据缓存管理器（单例）
  ├── KlineChartProvider.tsx  # React Context Provider（可选）
  ├── index.ts                # 统一导出入口
  └── README.md               # 模块文档
```

---

## 未来规划

### 短期目标（v1.1）
- [ ] 支持更多技术指标（MA、MACD、RSI）
- [ ] 添加成交量柱状图
- [ ] 绘图工具（趋势线、水平线）
- [ ] 订单簿集成

### 中期目标（v2.0）
- [ ] 多时间周期联动分析
- [ ] 图表截图和分享功能
- [ ] 自定义指标插件系统
- [ ] 移动端适配优化

### 长期目标（v3.0）
- [ ] AI 辅助分析
- [ ] 回测系统集成
- [ ] 社区指标分享平台

---

## 贡献指南

欢迎提交 Issue 和 Pull Request！

### 提交代码规范

1. 遵循 TypeScript 严格模式
2. 所有公开接口必须包含 JSDoc 注释
3. 单元测试覆盖率 > 80%
4. 使用 ESLint 和 Prettier 格式化代码

---

**文档版本**: v1.1.0  
**最后更新**: 2026-03-13  
**技术栈**: React 19 + TypeScript 5 + lightweight-charts 5.x + TanStack Query + WebSocket API
