import { CacheItem } from './types';

/**
 * 数据缓存管理器（单例模式）
 *
 * 功能特性：
 * - LRU 缓存策略：自动清理最久未使用的数据
 * - 过期时间控制：支持自定义缓存过期时间
 * - 内存管理：限制最大缓存条目数
 * - 性能优化：避免重复请求相同数据
 */
export class DataCache {
  private static instance: DataCache;
  private cache = new Map<string, CacheItem<any>>();
  private maxSize = 50; // 最大缓存条目数
  private defaultExpiry = 5 * 60 * 1000; // 默认 5 分钟过期

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): DataCache {
    if (!DataCache.instance) {
      DataCache.instance = new DataCache();
    }
    return DataCache.instance;
  }

  /**
   * 存储数据到缓存
   *
   * @param key 缓存键
   * @param data 要缓存的数据
   * @param expiry 过期时间（毫秒），默认使用 defaultExpiry
   */
  set<T>(key: string, data: T, expiry?: number): void {
    // 如果缓存已满，删除最旧的条目（LRU）
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
      console.log(`[DataCache] Evicted oldest entry: ${oldestKey}`);
    }

    const cacheItem: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      expiry: expiry || this.defaultExpiry,
    };

    this.cache.set(key, cacheItem);
    console.log(`[DataCache] Cached: ${key}, expires in ${cacheItem.expiry}ms`);
  }

  /**
   * 从缓存获取数据
   *
   * @param key 缓存键
   * @returns 缓存的数据，如果不存在或已过期则返回 null
   */
  get<T>(key: string): T | null {
    const item = this.cache.get(key);

    if (!item) {
      console.log(`[DataCache] Cache miss: ${key}`);
      return null;
    }

    // 检查是否过期
    const age = Date.now() - item.timestamp;
    if (age > item.expiry) {
      console.log(`[DataCache] Cache expired: ${key} (age: ${age}ms)`);
      this.cache.delete(key);
      return null;
    }

    console.log(`[DataCache] Cache hit: ${key} (age: ${age}ms)`);

    // LRU：将访问的项移到最后（删除再重新插入）
    this.cache.delete(key);
    this.cache.set(key, item);

    return item.data as T;
  }

  /**
   * 检查缓存是否存在且有效
   */
  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;

    const age = Date.now() - item.timestamp;
    if (age > item.expiry) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * 删除指定缓存
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      console.log(`[DataCache] Deleted: ${key}`);
    }
    return deleted;
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    console.log(`[DataCache] Clearing all cache (${this.cache.size} items)`);
    this.cache.clear();
  }

  /**
   * 获取缓存统计信息
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * 设置最大缓存条目数
   */
  setMaxSize(size: number): void {
    this.maxSize = size;
    console.log(`[DataCache] Max size set to: ${size}`);
  }

  /**
   * 设置默认过期时间
   */
  setDefaultExpiry(expiry: number): void {
    this.defaultExpiry = expiry;
    console.log(`[DataCache] Default expiry set to: ${expiry}ms`);
  }
}
