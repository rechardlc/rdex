import { WebSocketState, WebSocketSubscription } from './types';

/**
 * WebSocket 连接管理器（单例模式）
 *
 * 功能特性：
 * - 连接复用：同一 URL 只创建一个 WebSocket 实例
 * - 自动重连：连接断开后自动尝试重连（指数退避策略）
 * - 订阅管理：支持多个组件订阅同一个连接
 * - 状态追踪：实时追踪每个连接的状态
 * - 资源清理：组件卸载时自动清理无用连接
 */
export class WebSocketManager {
  // 单例实例
  private static instance: WebSocketManager;
  // WebSocket 连接池
  private connections = new Map<string, WebSocket>();
  // 订阅者管理
  private subscriptions = new Map<string, WebSocketSubscription>();
  // 重连定时器
  private reconnectTimers = new Map<string, NodeJS.Timeout>();

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  /**
   * 订阅 WebSocket 数据流
   *
   * @param key 订阅唯一标识（用于区分不同的数据流）
   * @param url WebSocket 连接地址
   * @param callback 数据回调函数
   * @param maxReconnectAttempts 最大重连次数（默认 5）
   * @returns unsubscribe 取消订阅函数
   */
  subscribe(
    key: string,
    url: string,
    callback: (data: any) => void,
    maxReconnectAttempts = 5
  ): () => void {
    // 如果订阅已存在，直接添加回调
    if (this.subscriptions.has(key)) {
      const subscription = this.subscriptions.get(key)!;
      subscription.callbacks.add(callback);
      console.log(`[WebSocketManager] Added callback to existing subscription: ${key}`);
    } else {
      // 创建新订阅
      const subscription: WebSocketSubscription = {
        key,
        url,
        callbacks: new Set([callback]),
        state: WebSocketState.CONNECTING,
        reconnectAttempts: 0,
        maxReconnectAttempts,
      };
      this.subscriptions.set(key, subscription);
      this.connect(key);
      console.log(`[WebSocketManager] Created new subscription: ${key}`);
    }

    // 返回取消订阅函数
    return () => this.unsubscribe(key, callback);
  }

  /**
   * 取消订阅
   */
  private unsubscribe(key: string, callback: (data: any) => void): void {
    const subscription = this.subscriptions.get(key);
    if (!subscription) return;

    subscription.callbacks.delete(callback);
    console.log(
      `[WebSocketManager] Removed callback from ${key}, remaining: ${subscription.callbacks.size}`
    );

    // 如果没有剩余回调，关闭连接
    if (subscription.callbacks.size === 0) {
      this.closeConnection(key);
    }
  }

  /**
   * 建立 WebSocket 连接
   */
  private connect(key: string): void {
    const subscription = this.subscriptions.get(key);
    if (!subscription) return;

    try {
      const ws = new WebSocket(subscription.url);
      this.connections.set(key, ws);
      subscription.state = WebSocketState.CONNECTING;

      ws.onopen = () => {
        console.log(`[WebSocketManager] Connected: ${key}`);
        subscription.state = WebSocketState.CONNECTED;
        subscription.reconnectAttempts = 0; // 重置重连计数
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // 将数据分发给所有订阅者
          subscription.callbacks.forEach((callback) => {
            try {
              callback(data);
            } catch (error) {
              console.error(`[WebSocketManager] Callback error for ${key}:`, error);
            }
          });
        } catch (error) {
          console.error(`[WebSocketManager] Parse error for ${key}:`, error);
        }
      };

      ws.onerror = (error) => {
        console.error(`[WebSocketManager] Error for ${key}:`, error);
        subscription.state = WebSocketState.FAILED;
      };

      ws.onclose = (event) => {
        console.log(`[WebSocketManager] Closed: ${key}, code: ${event.code}`);
        subscription.state = WebSocketState.DISCONNECTED;
        this.connections.delete(key);

        // 如果还有订阅者，尝试重连
        if (subscription.callbacks.size > 0) {
          this.scheduleReconnect(key);
        }
      };
    } catch (error) {
      console.error(`[WebSocketManager] Connection error for ${key}:`, error);
      subscription.state = WebSocketState.FAILED;
      this.scheduleReconnect(key);
    }
  }

  /**
   * 安排重连（指数退避策略）
   */
  private scheduleReconnect(key: string): void {
    const subscription = this.subscriptions.get(key);
    if (!subscription) return;

    // 检查是否超过最大重连次数
    if (subscription.reconnectAttempts >= subscription.maxReconnectAttempts) {
      console.error(
        `[WebSocketManager] Max reconnect attempts reached for ${key}, giving up`
      );
      subscription.state = WebSocketState.FAILED;
      return;
    }

    // 清除之前的重连定时器
    const existingTimer = this.reconnectTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    subscription.reconnectAttempts++;
    subscription.state = WebSocketState.RECONNECTING;

    // 指数退避：1s, 2s, 4s, 8s, 16s
    // 作用：避免频繁重连导致服务器压力
    const delay = Math.min(1000 * Math.pow(2, subscription.reconnectAttempts - 1), 16000);
    console.log(
      `[WebSocketManager] Scheduling reconnect for ${key} in ${delay}ms (attempt ${subscription.reconnectAttempts}/${subscription.maxReconnectAttempts})`
    );

    const timer = setTimeout(() => {
      this.reconnectTimers.delete(key);
      this.connect(key);
    }, delay);

    this.reconnectTimers.set(key, timer);
  }

  /**
   * 关闭指定连接
   */
  private closeConnection(key: string): void {
    const ws = this.connections.get(key);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }

    // 清理资源
    this.connections.delete(key);
    this.subscriptions.delete(key);

    const timer = this.reconnectTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(key);
    }

    console.log(`[WebSocketManager] Closed and cleaned up: ${key}`);
  }

  /**
   * 获取订阅状态
   */
  getState(key: string): WebSocketState | undefined {
    return this.subscriptions.get(key)?.state;
  }

  /**
   * 销毁所有连接（用于应用卸载时清理）
   */
  destroy(): void {
    console.log('[WebSocketManager] Destroying all connections');

    // 关闭所有连接
    this.connections.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

    // 清理所有定时器
    this.reconnectTimers.forEach((timer) => clearTimeout(timer));

    // 清空所有 Map
    this.connections.clear();
    this.subscriptions.clear();
    this.reconnectTimers.clear();
  }
}
