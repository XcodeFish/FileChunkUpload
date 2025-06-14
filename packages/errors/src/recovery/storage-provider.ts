/**
 * 存储提供者接口和实现
 * 提供对不同存储后端的抽象，支持多环境运行
 * @packageDocumentation
 */

/**
 * 存储提供者接口
 * 定义与存储媒介交互的标准方法
 */
export interface StorageProvider {
  /**
   * 获取存储项
   * @param key 存储键
   * @returns 存储值，不存在则返回null
   */
  getItem(key: string): Promise<string | null>;

  /**
   * 设置存储项
   * @param key 存储键
   * @param value 存储值
   */
  setItem(key: string, value: string): Promise<void>;

  /**
   * 移除存储项
   * @param key 存储键
   */
  removeItem(key: string): Promise<void>;

  /**
   * 清除所有存储项
   * 清除该提供者管理的所有存储
   */
  clear(): Promise<void>;

  /**
   * 获取所有存储键
   * @returns 所有存储键的数组
   */
  getAllKeys(): Promise<string[]>;
}

/**
 * localStorage存储提供者
 * 使用浏览器的localStorage API实现存储
 */
export class LocalStorageProvider implements StorageProvider {
  /**
   * 获取存储项
   * @param key 存储键
   * @returns 存储值，不存在则返回null
   */
  async getItem(key: string): Promise<string | null> {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    return localStorage.getItem(key);
  }

  /**
   * 设置存储项
   * @param key 存储键
   * @param value 存储值
   */
  async setItem(key: string, value: string): Promise<void> {
    if (typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem(key, value);
  }

  /**
   * 移除存储项
   * @param key 存储键
   */
  async removeItem(key: string): Promise<void> {
    if (typeof localStorage === 'undefined') {
      return;
    }
    localStorage.removeItem(key);
  }

  /**
   * 清除所有存储项
   */
  async clear(): Promise<void> {
    if (typeof localStorage === 'undefined') {
      return;
    }
    localStorage.clear();
  }

  /**
   * 获取所有存储键
   * @returns 所有存储键的数组
   */
  async getAllKeys(): Promise<string[]> {
    if (typeof localStorage === 'undefined') {
      return [];
    }
    return Object.keys(localStorage);
  }
}

/**
 * 内存存储提供者
 * 使用内存Map实现存储，用于非浏览器环境
 */
export class MemoryStorageProvider implements StorageProvider {
  private storage = new Map<string, string>();

  /**
   * 获取存储项
   * @param key 存储键
   * @returns 存储值，不存在则返回null
   */
  async getItem(key: string): Promise<string | null> {
    return this.storage.has(key) ? this.storage.get(key)! : null;
  }

  /**
   * 设置存储项
   * @param key 存储键
   * @param value 存储值
   */
  async setItem(key: string, value: string): Promise<void> {
    this.storage.set(key, value);
  }

  /**
   * 移除存储项
   * @param key 存储键
   */
  async removeItem(key: string): Promise<void> {
    this.storage.delete(key);
  }

  /**
   * 清除所有存储项
   */
  async clear(): Promise<void> {
    this.storage.clear();
  }

  /**
   * 获取所有存储键
   * @returns 所有存储键的数组
   */
  async getAllKeys(): Promise<string[]> {
    return Array.from(this.storage.keys());
  }
}

/**
 * 创建适当的存储提供者
 * 工厂函数，根据运行环境创建合适的存储提供者
 *
 * @returns 存储提供者实例
 */
export function createStorageProvider(): StorageProvider {
  if (typeof localStorage !== 'undefined') {
    return new LocalStorageProvider();
  }
  return new MemoryStorageProvider();
}
