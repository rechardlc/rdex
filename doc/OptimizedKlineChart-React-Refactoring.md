# OptimizedKlineChart React 最佳实践重构文档

## 文档概述

本文档记录 `OptimizedKlineChart` 组件的 React Effect 重构过程，遵循 [React.dev Escape Hatches](https://react.dev/reference/react/useEffect) 官方指南，减少不必要的 Effect、简化数据流、提升组件性能。

**重构日期**：2026-03-13  
**涉及文件**：`components/OptimizedKlineChart.tsx`  
**技术栈**：React 19 + TypeScript + lightweight-charts + TanStack Query

---

## 一、重构准则

| 准则 | 说明 |
|------|------|
| **计算逻辑上移** | 若 Effect 仅根据 props/state 计算另一值，改为渲染期间直接计算或 `useMemo` |
| **移至事件处理函数** | 若 Effect 由用户交互（点击、提交）触发，移入对应 Event Handler |
| **消除状态冗余** | 若 B 状态仅为同步 A 状态而存在，且 B 可从 A 推导，则删除 B 及相关 Effect |
| **保持纯粹** | 渲染过程不含副作用，仅与外部系统同步（API、订阅、DOM 操作）的逻辑保留在 Effect |

---

## 二、useEffect 变更清单

### 2.1 已移除：全屏监听 Effect

**原实现**：
```typescript
const [isFullscreen, setIsFullscreen] = useState(false);

useEffect(() => {
  const handleFullscreenChange = () => {
    setIsFullscreen(!!document.fullscreenElement);
    if (chartContainerRef.current && chartRef.current) {
      setTimeout(() => { /* resize chart */ }, 100);
    }
  };
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
}, [calculateBarSpacing]);
```

**问题**：
- `isFullscreen` 可从 `document.fullscreenElement` 推导，属于**冗余 state**
- 为同步 DOM 状态而维护 React state，违反「消除状态冗余」准则

**重构方案**：使用 `useSyncExternalStore` 订阅全屏状态

```typescript
const isFullscreen = useSyncExternalStore(
  useCallback((onStoreChange: () => void) => {
    const handleFullscreenChange = () => {
      onStoreChange();
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
```

**效果**：消除 1 个 Effect、1 个 state，全屏状态由 React 官方推荐方式订阅外部 store。

---

### 2.2 保留：图表初始化 Effect

**实现**：
```typescript
useEffect(() => {
  if (!chartContainerRef.current) return;

  const chart = createChart(chartContainerRef.current, chartOptions);
  chartRef.current = chart;
  seriesRef.current = chart.addSeries(CandlestickSeries, {...});

  window.addEventListener('resize', handleResize);

  return () => {
    window.removeEventListener('resize', handleResize);
    chart.remove();
  };
}, [handleResize]);
```

**保留原因**：与 **DOM** 和 **lightweight-charts** 外部系统同步，属于 Effect 正确使用场景。

---

### 2.3 保留：数据更新 Effect

**实现**：
```typescript
useEffect(() => {
  if (data && seriesRef.current) {
    seriesRef.current.setData(data);
  }
}, [data]);
```

**保留原因**：将 React 数据同步到 lightweight-charts 命令式 API，属于与外部系统同步。

---

## 三、其他优化

### 3.1 纯函数上移：calculateBarSpacing

**原实现**：组件内 `useCallback`
```typescript
const calculateBarSpacing = useCallback((width: number): number => {
  if (width < 768) return 4;
  // ...
}, []);
```

**重构**：模块级纯函数
```typescript
function calculateBarSpacing(width: number): number {
  if (width < 768) return 4;
  if (width < 1200) return 6;
  if (width < 1600) return 8;
  return 10;
}
```

**效果**：无依赖、可复用、渲染期间可安全调用。

---

### 3.2 事件处理函数精简：toggleFullscreen

**原实现**：内部调用 `setIsFullscreen`
```typescript
const toggleFullscreen = async () => {
  if (!document.fullscreenElement) {
    await wrapperRef.current.requestFullscreen();
    setIsFullscreen(true);
  } else {
    await document.exitFullscreen();
    setIsFullscreen(false);
  }
};
```

**重构**：纯事件处理，无 setState
```typescript
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
```

**效果**：全屏状态由 `fullscreenchange` 事件 + `useSyncExternalStore` 自动同步，事件处理函数保持纯粹。

---

### 3.3 稳定回调：handleKlineUpdate

**原实现**：内联函数，每次渲染创建新引用
```typescript
useKlineSubscription({
  onUpdate: (klineData) => {
    if (seriesRef.current) {
      seriesRef.current.update(klineData);
    }
  },
});
```

**问题**：`useKlineSubscription` 的 Effect 依赖 `onUpdate`，回调变化导致 WebSocket 频繁取消/重新订阅。

**重构**：`useCallback` 稳定引用
```typescript
const handleKlineUpdate = useCallback((klineData: CandlestickData) => {
  seriesRef.current?.update(klineData);
}, []);

useKlineSubscription({
  onUpdate: handleKlineUpdate,
});
```

**效果**：避免 WebSocket 重复订阅，降低连接开销。

---

## 四、重构后组件结构

```
OptimizedKlineChart.tsx
├── calculateBarSpacing()          # 模块级纯函数
├── useSyncExternalStore(...)      # 全屏状态订阅（替代 state + Effect）
├── handleKlineUpdate              # useCallback 稳定回调
├── toggleFullscreen               # 纯事件处理
├── handleResize                   # 防抖事件处理
├── useEffect (图表初始化)         # 保留：DOM + lightweight-charts 同步
└── useEffect (数据更新)           # 保留：data → series.setData 同步
```

---

## 五、依赖关系

```
OptimizedKlineChart
├── useKlineData           # TanStack Query，无内部 Effect 变更
├── useAutoLoadKlineData   # 1 个 Effect（监听图表可见范围，外部系统同步）
├── useKlineSubscription  # 1 个 Effect（WebSocket 订阅，外部系统同步）
└── lightweight-charts    # 命令式 API，需 Effect 同步
```

---

## 六、性能与可维护性改进

| 指标 | 重构前 | 重构后 |
|------|--------|--------|
| useEffect 数量 | 3 | 2 |
| useState 数量 | 1 | 0 |
| WebSocket 订阅稳定性 | 回调变化导致重连 | 稳定，无多余重连 |
| 数据流 | state 与 DOM 双向同步 | 单向：DOM → useSyncExternalStore |
| 渲染纯粹性 | 含 setState 副作用 | 计算与事件分离 |

---

## 七、参考资源

- [React Docs: useEffect](https://react.dev/reference/react/useEffect)
- [React Docs: useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore)
- [React Docs: You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)

---

**文档版本**：v1.0.0  
**最后更新**：2026-03-13
