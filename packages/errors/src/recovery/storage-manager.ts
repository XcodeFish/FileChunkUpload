/**
 * 存储管理器实现
 * 用于持久化存储重试状态
 * @packageDocumentation
 */

import { StorageManager, RetryState } from './retry-types';

/**
 * 本地存储管理器实现
 * 使用localStorage进行简单存储
 */
export class LocalStorageManager implements StorageManager {
  /** 存储前缀 */
  private prefix: string;

  /**
   * 构造函数
   * @param prefix 存储键前缀
   */
  constructor(prefix: string = 'retry_') {
    this.prefix = prefix;
  }

  /**
   * 保存重试状态
   * @param fileId 文件ID
   * @param state 重试状态
   */
  async saveRetryState(fileId: string, state: RetryState): Promise<void> {
    if (typeof localStorage === 'undefined') return;

    try {
      localStorage.setItem(this.getKey(fileId), JSON.stringify(state));
    } catch (error) {
      console.error('保存重试状态失败:', error);
    }
  }

  /**
   * 获取重试状态
   * @param fileId 文件ID
   * @returns 重试状态
   */
  async getRetryState(fileId: string): Promise<RetryState | null> {
    if (typeof localStorage === 'undefined') return null;

    try {
      const stateStr = localStorage.getItem(this.getKey(fileId));
      if (!stateStr) return null;
      return JSON.parse(stateStr) as RetryState;
    } catch (error) {
      console.error('获取重试状态失败:', error);
      return null;
    }
  }

  /**
   * 获取活动上传ID列表
   * @returns 活动上传ID列表
   */
  async getActiveUploads(): Promise<string[]> {
    if (typeof localStorage === 'undefined') return [];

    try {
      const result: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.prefix)) {
          result.push(key.substring(this.prefix.length));
        }
      }
      return result;
    } catch (error) {
      console.error('获取活动上传失败:', error);
      return [];
    }
  }

  /**
   * 清除指定文件的重试状态
   * @param fileId 文件ID
   */
  async clearRetryState(fileId: string): Promise<void> {
    if (typeof localStorage === 'undefined') return;

    try {
      localStorage.removeItem(this.getKey(fileId));
    } catch (error) {
      console.error('清除重试状态失败:', error);
    }
  }

  /**
   * 清除所有重试状态
   */
  async clearAllRetryStates(): Promise<void> {
    if (typeof localStorage === 'undefined') return;

    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.prefix)) {
          keys.push(key);
        }
      }

      for (const key of keys) {
        localStorage.removeItem(key);
      }
    } catch (error) {
      console.error('清除所有重试状态失败:', error);
    }
  }

  /**
   * 获取存储键
   * @param fileId 文件ID
   * @returns 存储键
   */
  private getKey(fileId: string): string {
    return `${this.prefix}${fileId}`;
  }
}

/**
 * 创建存储管理器
 * @param prefix 存储键前缀
 * @returns 存储管理器实例
 */
export function createStorageManager(prefix?: string): StorageManager {
  return new LocalStorageManager(prefix);
}
