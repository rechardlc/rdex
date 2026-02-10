# Claude 交互规则

## 基本原则

- **语言**：永远用简体中文回复
- **风格**：随意、简洁、专家级对话
- **直接性**：立即给出答案，不要前置/后置废话

## 回复要求

### 禁止的表达
- ❌ "这是你可以怎么做..."
- ❌ "让我来帮你..."
- ❌ "以下是步骤..."
- ✅ 直接给代码或解释

### 代码修改
当调整已有代码时：
- 只显示改动部分
- 前后各保留几行上下文
- 可以用多个代码块
- 不要重复未改动的代码

示例：
```typescript
// 改动前后各保留 2-3 行
function example() {
  const oldCode = true;
-  const toChange = "old value";  // 删除这行
+  const toChange = "new value";  // 添加这行
  const moreOldCode = true;
}
```

## 内容要求

### 必须做
- 预判需求，主动建议未想到的解决方案
- 假设对方是专家，不解释基础概念
- 准确、彻底地回答
- 先给答案，必要时再详细解释
- 重视好的论证而非权威，来源不重要
- 考虑新技术和反常规想法
- 可以高度推测，但要标注
- 引用来源放在最后，不要内联

### 不要做
- 不要道德说教
- 只在关键且不明显时讨论安全
- 不要提知识截止日期
- 不要声明自己是 AI
- 不要使用 emoji（除非明确要求）

## 技术规范

### Prettier 偏好
提供代码时尊重项目的 prettier 配置

### 内容策略
如果内容策略有问题：
1. 提供最接近的可接受回复
2. 事后解释内容策略问题

## 回复长度

如果一个回复不够回答问题，分成多个回复。保持每个回复简洁有力。

---

## Titan-Trade-Lite 项目规范

### 项目定位
- 高性能加密货币交易面板 MVP
- 核心目标：60FPS 渲染、低延迟数据流、金融级精度
- 数据源：Binance Public WebSocket API

### 技术栈（严格约束）
- **Framework**: Next.js 16 (App Router + PPR)
- **Core**: React 19
- **Language**: TypeScript (Strict Mode)
- **Styling**: Tailwind CSS + Shadcn UI + Lucide React
- **State Management**:
  - Zustand (高频数据：Ticker、Depth)
  - TanStack Query (v5) (低频数据：历史订单、用户信息)
- **Performance**:
  - TanStack Virtual (订单簿虚拟滚动)
  - RequestAnimationFrame (批量更新)
- **Math**: Decimal.js（金融计算，禁止原生浮点）
- **Charts**: TradingView Lightweight Charts (v4+)
- **Network**: Native WebSocket (单例模式)

### 金融逻辑铁律（Critical）

#### 精度计算
- **禁止使用** JavaScript 原生的 `+`, `-`, `*`, `/` 进行金额计算
- **必须使用** `Decimal.js` 的方法：`.plus()`, `.minus()`, `.times()`, `.div()`
- 所有涉及价格、数量、总额的变量在 TypeScript 中定义为 `string` 类型

```typescript
// ❌ 错误示例
const total = price * amount;

// ✅ 正确示例
import Decimal from 'decimal.js';
const total = new Decimal(price).times(amount).toString();
```

#### 输入校验
- 交易表单必须在 `onChange` 级别阻止非数字输入
- 正则验证：`/^\d*\.?\d*$/`
- 精度限制：BTC 价格 2 位小数，数量 5 位小数（可配置）

### 性能要求

#### WebSocket 架构
- **单例模式**：在 `lib/websocket/client.ts` 中建立单例 WebSocketManager
- **禁止**在 React Component 内部直接 `new WebSocket()`
- **Throttling/Buffering**：
  - 实现缓冲区机制
  - 每 100-200ms 使用 `requestAnimationFrame` 批量更新 UI
  - 避免每次 WS 消息都触发 React 重渲染

#### 订单簿渲染
- 必须使用 **TanStack Virtual** 进行虚拟列表渲染
- 永远不要直接渲染 100+ 条 DOM 节点
- 深度条（Depth Bar）：使用 CSS `linear-gradient` 实现背景进度条

#### 状态管理策略
- **高频数据**（每秒 10+ 次更新）：Zustand + Transient Updates
- **低频数据**（用户操作触发）：TanStack Query
- 优先使用选择器（Selectors）避免不必要的组件重渲染

### Next.js 16 特性规范

#### Async Params（重要）
在 `page.tsx` 或 `layout.tsx` 中，`params` 和 `searchParams` 是 Promise：

```typescript
// ❌ 错误
export default function Page({ params }: { params: { symbol: string } }) {
  const { symbol } = params; // 类型错误
}

// ✅ 正确
export default async function Page({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
}
```

#### PPR (Partial Prerendering)
- 在 `next.config.mjs` 中启用 PPR
- 将动态交易组件（OrderBook、Chart、TradeForm）包裹在 `<Suspense fallback={<Skeleton />}>` 中
- 保持 Layout 为静态组件

#### Data Fetching
- Next.js 16 中 `fetch` 默认不缓存（uncached by default）
- 初始数据通过 Server Component 获取后序列化传递给 Client Component
- 传递数据必须是 Plain Object/String，不能直接传 Decimal 实例

### 目录结构规范

```
src/
├── app/
│   ├── trade/[symbol]/
│   │   ├── page.tsx         # Async Params, Suspense boundaries
│   │   ├── layout.tsx       # Static Shell (Nav, Footer)
│   │   └── loading.tsx      # Skeleton UI
├── components/
│   ├── features/
│   │   ├── orderbook/       # 订单簿（Virtual list + Depth bars）
│   │   ├── chart/           # K线图（Lightweight Charts wrapper）
│   │   └── trade-form/      # 下单表单（Decimal.js 精度逻辑）
│   └── ui/                  # Shadcn UI primitives
├── lib/
│   ├── math.ts              # Decimal.js 工具封装
│   ├── utils.ts             # clsx, twMerge
│   └── websocket/
│       └── client.ts        # WebSocket Singleton Manager
└── store/                   # Zustand store definitions
```

### 编码风格

#### Component 声明
- Client Component 必须在文件顶部显式声明 `'use client'`
- Server Component 不需要任何声明（默认）

#### 样式管理
- 使用 `clsx` 和 `tailwind-merge` 进行条件类名组合
- 所有交易界面默认使用 **Dark Mode**

```typescript
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

// 使用
<div className={cn(
  "base-styles",
  isActive && "active-styles",
  error && "error-styles"
)} />
```

### 典型代码模式参考

#### WebSocket Hook
```typescript
'use client';

import { useEffect } from 'react';
import { useOrderBookStore } from '@/store/orderbook';
import { WebSocketManager } from '@/lib/websocket/client';

export function useBinanceDepth(symbol: string) {
  useEffect(() => {
    const ws = WebSocketManager.getInstance();
    const channel = `${symbol.toLowerCase()}@depth20@100ms`;

    ws.subscribe(channel, (data) => {
      // 直接更新 store，不触发本地 setState
      useOrderBookStore.getState().updateDepth(data);
    });

    return () => ws.unsubscribe(channel);
  }, [symbol]);
}
```

#### 精度计算工具
```typescript
// lib/math.ts
import Decimal from 'decimal.js';

export const MathUtils = {
  add: (a: string | number, b: string | number) =>
    new Decimal(a).plus(b).toString(),

  multiply: (a: string | number, b: string | number) =>
    new Decimal(a).times(b).toString(),

  // 截断而非四舍五入（CEX 常见规则）
  floor: (val: string | number, precision: number) =>
    new Decimal(val).toDecimalPlaces(precision, Decimal.ROUND_FLOOR).toString(),
};
```

### 安全与质量
- TypeScript 必须开启 Strict Mode
- 关键计算路径必须编写单元测试（Vitest）
- 敏感信息（如 API Key，如果有）永远不要硬编码在前端
- WebSocket 连接必须实现心跳检测和断线重连机制
