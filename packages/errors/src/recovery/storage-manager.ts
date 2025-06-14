/**
 * 存储管理器实现
 * 用于持久化存储重试状态
 * @packageDocumentation
 */

import { StorageManager, RetryState } from './retry-types';
import { StorageProvider, createStorageProvider } from './storage-provider';

/**
 * 本地存储管理器实现
 * 使用localStorage进行简单存储
 *
 * 主要功能：
 * 1. 保存重试状态到本地存储
 * 2. 从本地存储获取重试状态
 * 3. 管理活动上传列表
 * 4. 清理过期或完成的重试状态
 */
export class LocalStorageManager implements StorageManager {
  /**
   * 存储前缀
   * 用于区分不同应用或模块的存储项
   */
  private prefix: string;

  /**
   * 活动上传文件ID列表键名
   * 用于存储当前活动的上传文件ID列表
   */
  private activeUploadsKey: string;

  /**
   * 存储条目过期时间 (毫秒)
   * 存储项在此时间后被认为过期
   */
  private expirationTime: number;

  /**
   * 存储提供者
   * 用于操作实际存储媒介
   */
  private storageProvider: StorageProvider;

  /**
   * 构造函数
   * @param options 配置选项
   * @param options.prefix 存储键前缀，默认为'retry_'
   * @param options.expirationTime 存储条目过期时间(毫秒)，默认为24小时
   * @param options.storageProvider 存储提供者实例
   */
  constructor(
    options: {
      prefix?: string;
      expirationTime?: number;
      storageProvider?: StorageProvider;
    } = {},
  ) {
    this.prefix = options.prefix || 'retry_';
    this.activeUploadsKey = `${this.prefix}active_uploads`;
    this.expirationTime = options.expirationTime || 24 * 60 * 60 * 1000;
    this.storageProvider = options.storageProvider || createStorageProvider();

    // 启动时清理过期存储
    this.cleanupExpiredStorage().catch(err => {
      console.warn('清理过期存储失败:', err);
    });
  }

  /**
   * 保存重试状态
   * 将重试状态序列化并存储
   * @param fileId 文件ID
   * @param state 重试状态
   * @throws 如果序列化或存储过程中出错
   */
  async saveRetryState(fileId: string, state: RetryState): Promise<void> {
    try {
      // 验证输入参数
      if (!fileId) {
        throw new Error('文件ID不能为空');
      }

      // 添加额外元数据
      const stateWithMeta = {
        ...state,
        timestamp: Date.now(),
        expiration: Date.now() + this.expirationTime,
      };

      // 序列化状态对象
      const serializedState = JSON.stringify(stateWithMeta);

      // 通过存储提供者保存
      const key = this.getStorageKey(fileId);
      await this.storageProvider.setItem(key, serializedState);

      // 更新活动上传列表
      await this.addToActiveUploads(fileId);
    } catch (err) {
      console.error(`保存文件 ${fileId} 的重试状态失败:`, err);
      throw err;
    }
  }

  /**
   * 获取重试状态
   * 读取并解析重试状态
   * @param fileId 文件ID
   * @returns 重试状态对象，若不存在则返回null
   * @throws 如果解析过程中出错
   */
  async getRetryState(fileId: string): Promise<RetryState | null> {
    try {
      // 获取存储键
      const key = this.getStorageKey(fileId);
      const serializedState = await this.storageProvider.getItem(key);

      // 如果没有找到存储的状态，返回null
      if (!serializedState) return null;

      // 解析JSON
      const state = JSON.parse(serializedState);

      // 检查是否过期
      if (state.expiration && state.expiration < Date.now()) {
        // 状态已过期，清理并返回null
        await this.clearRetryState(fileId);
        return null;
      }

      return state;
    } catch (err) {
      console.error(`获取文件 ${fileId} 的重试状态失败:`, err);

      // 错误时移除可能损坏的数据
      try {
        await this.clearRetryState(fileId);
      } catch (clearErr) {
        // 清理失败不需处理
      }

      throw err;
    }
  }

  /**
   * 获取活动上传列表
   * 返回所有当前活动的上传文件ID
   * @returns 文件ID数组
   */
  async getActiveUploads(): Promise<string[]> {
    try {
      const serialized = await this.storageProvider.getItem(this.activeUploadsKey);
      if (!serialized) return [];

      const activeUploads = JSON.parse(serialized);

      // 确保返回数组
      if (!Array.isArray(activeUploads)) {
        return [];
      }

      // 过滤无效值
      return activeUploads.filter(id => typeof id === 'string' && id.length > 0);
    } catch (err) {
      console.error('获取活动上传列表失败:', err);

      // 错误时重置活动上传列表
      try {
        await this.storageProvider.setItem(this.activeUploadsKey, '[]');
      } catch (setErr) {
        // 设置失败不需处理
      }

      return [];
    }
  }

  /**
   * 删除重试状态
   * 与clearRetryState功能相同，为兼容StorageManager接口
   * @param fileId 文件ID
   */
  async deleteRetryState(fileId: string): Promise<void> {
    return this.clearRetryState(fileId);
  }

  /**
   * 清除特定文件的重试状态
   * @param fileId 文件ID
   */
  async clearRetryState(fileId: string): Promise<void> {
    try {
      // 移除存储的状态
      const key = this.getStorageKey(fileId);
      await this.storageProvider.removeItem(key);

      // 从活动上传列表移除
      await this.removeFromActiveUploads(fileId);
    } catch (err) {
      console.error(`清除文件 ${fileId} 的重试状态失败:`, err);
      throw err;
    }
  }

  /**
   * 清除所有重试状态
   * 移除所有与重试相关的存储项
   */
  async clearAllRetryStates(): Promise<void> {
    try {
      // 获取所有活动上传
      const activeUploads = await this.getActiveUploads();

      // 逐个清除
      for (const fileId of activeUploads) {
        const key = this.getStorageKey(fileId);
        await this.storageProvider.removeItem(key);
      }

      // 清除活动上传列表
      await this.storageProvider.removeItem(this.activeUploadsKey);
    } catch (err) {
      console.error('清除所有重试状态失败:', err);
      throw err;
    }
  }

  /**
   * 清理过期的存储条目
   * 定期检查并移除过期的重试状态
   * @private
   */
  private async cleanupExpiredStorage(): Promise<void> {
    try {
      const activeUploads = await this.getActiveUploads();
      const now = Date.now();
      const expiredIds: string[] = [];

      // 检查每个活动上传是否过期
      for (const fileId of activeUploads) {
        try {
          const key = this.getStorageKey(fileId);
          const serialized = await this.storageProvider.getItem(key);

          if (serialized) {
            const state = JSON.parse(serialized);

            // 检查过期时间
            if (state.expiration && state.expiration < now) {
              // 已过期，添加到待清理列表
              expiredIds.push(fileId);
            }
          } else {
            // 存储项不存在，也应该从活动列表中移除
            expiredIds.push(fileId);
          }
        } catch (err) {
          // 错误时将此ID添加到过期列表
          expiredIds.push(fileId);
        }
      }

      // 清理所有过期的存储项
      for (const fileId of expiredIds) {
        await this.clearRetryState(fileId);
      }
    } catch (err) {
      console.warn('清理过期存储时发生错误:', err);
      // 不抛出异常，让清理过程静默失败
    }
  }

  /**
   * 将文件ID添加到活动上传列表
   * @param fileId 文件ID
   * @private
   */
  private async addToActiveUploads(fileId: string): Promise<void> {
    try {
      // 获取当前活动上传
      const activeUploads = await this.getActiveUploads();

      // 检查是否已经在列表中
      if (!activeUploads.includes(fileId)) {
        // 添加到列表并保存
        activeUploads.push(fileId);
        await this.storageProvider.setItem(this.activeUploadsKey, JSON.stringify(activeUploads));
      }
    } catch (err) {
      console.error('添加到活动上传列表失败:', err);
      throw err;
    }
  }

  /**
   * 从活动上传列表移除文件ID
   * @param fileId 文件ID
   * @private
   */
  private async removeFromActiveUploads(fileId: string): Promise<void> {
    try {
      // 获取当前活动上传
      const activeUploads = await this.getActiveUploads();

      // 过滤掉要移除的ID
      const filteredUploads = activeUploads.filter(id => id !== fileId);

      // 保存更新后的列表
      await this.storageProvider.setItem(this.activeUploadsKey, JSON.stringify(filteredUploads));
    } catch (err) {
      console.error('从活动上传列表移除失败:', err);
      throw err;
    }
  }

  /**
   * 获取存储键
   * 为特定文件ID生成存储键名
   * @param fileId 文件ID
   * @returns 存储键名
   * @private
   */
  private getStorageKey(fileId: string): string {
    return `${this.prefix}${fileId}`;
  }
}

/**
 * 创建存储管理器
 * 工厂函数，创建并返回存储管理器实例
 * @param options 配置选项
 * @param options.prefix 存储键前缀，默认为'retry_'
 * @param options.expirationTime 存储条目过期时间(毫秒)，默认为24小时
 * @param options.storageProvider 存储提供者实例
 * @returns 存储管理器实例
 */
export function createStorageManager(options?: {
  prefix?: string;
  expirationTime?: number;
  storageProvider?: StorageProvider;
}): StorageManager {
  return new LocalStorageManager(options);
}
