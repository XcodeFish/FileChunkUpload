/**
 * 重试状态管理器
 * 负责状态持久化和恢复逻辑
 * @packageDocumentation
 */

import { RetryState, StorageManager, ExtendedErrorContext } from './retry-types';

/**
 * 重试状态管理器类
 * 处理重试状态的持久化存储和恢复
 */
export class RetryStateManager {
  /**
   * 存储管理器
   */
  private storageManager?: StorageManager;

  /**
   * 重试状态缓存
   * 键: 文件ID
   * 值: 重试状态
   */
  private stateCache: Map<string, RetryState> = new Map();

  /**
   * 构造函数
   * @param storageManager 存储管理器
   */
  constructor(storageManager?: StorageManager) {
    this.storageManager = storageManager;
  }

  /**
   * 保存重试状态
   * @param context 错误上下文
   * @param successCount 成功次数
   * @param failCount 失败次数
   * @returns Promise<void>
   */
  async saveRetryState(
    context: ExtendedErrorContext,
    successCount: number = 0,
    failCount: number = 0,
  ): Promise<void> {
    // 检查依赖和参数
    if (!this.storageManager || !context.fileId) return;

    // 构建重试状态对象
    const retryState: RetryState = {
      fileId: context.fileId,
      retryCount: context.retryCount || 0,
      lastRetryTime: Date.now(),
      chunkRetries: context.chunkRetries || {},
      successfulRetries: successCount,
      failedRetries: failCount,
    };

    // 更新缓存
    this.stateCache.set(context.fileId, retryState);

    // 持久化存储
    await this.storageManager.saveRetryState(context.fileId, retryState);
  }

  /**
   * 加载重试状态
   * @param fileId 文件ID
   * @returns Promise<RetryState | null>
   */
  async loadRetryState(fileId: string): Promise<RetryState | null> {
    // 检查缓存
    if (this.stateCache.has(fileId)) {
      return this.stateCache.get(fileId) || null;
    }

    // 检查依赖
    if (!this.storageManager) return null;

    try {
      // 从存储加载
      const state = await this.storageManager.getRetryState(fileId);

      // 更新缓存
      if (state) {
        this.stateCache.set(fileId, state);
      }

      return state;
    } catch (err) {
      console.warn(`加载文件 ${fileId} 的重试状态失败:`, err);
      return null;
    }
  }

  /**
   * 加载所有重试状态
   * @returns 所有重试状态的Map
   */
  async loadAllRetryStates(): Promise<Map<string, RetryState>> {
    const states = new Map<string, RetryState>();

    // 如果没有存储管理器，返回空Map
    if (!this.storageManager) {
      return states;
    }

    try {
      // 从存储加载重试状态
      const activeUploads = await this.storageManager.getActiveUploads();

      // 处理每个活动上传的重试状态
      for (const fileId of activeUploads) {
        try {
          const retryState = await this.storageManager.getRetryState(fileId);
          if (retryState) {
            states.set(fileId, retryState);
          }
        } catch (err) {
          console.warn(`加载文件 ${fileId} 的重试状态失败:`, err);
          // 继续处理其他文件，不中断整个过程
        }
      }
    } catch (err) {
      console.warn('加载重试状态失败:', err);
    }

    return states;
  }

  /**
   * 更新重试状态
   * @param fileId 文件ID
   * @param updates 要更新的字段
   * @returns Promise<void>
   */
  async updateRetryState(fileId: string, updates: Partial<RetryState>): Promise<void> {
    // 如果没有存储管理器，直接返回
    if (!this.storageManager) {
      return;
    }

    try {
      // 获取当前状态
      const currentState = await this.storageManager.getRetryState(fileId).catch(() => null);

      // 创建新状态
      const newState: RetryState = currentState || {
        fileId,
        retryCount: 0,
        lastRetryTime: Date.now(),
        chunkRetries: {},
        successfulRetries: 0,
        failedRetries: 0,
      };

      // 应用更新
      Object.assign(newState, updates);

      // 保存更新后的状态
      await this.storageManager.saveRetryState(fileId, newState);
    } catch (err) {
      console.warn(`更新文件 ${fileId} 的重试状态失败:`, err);
    }
  }

  /**
   * 删除重试状态
   * @param fileId 文件ID
   * @returns Promise<boolean>
   */
  async deleteRetryState(fileId: string): Promise<boolean> {
    // 从缓存中删除
    this.stateCache.delete(fileId);

    // 检查依赖
    if (!this.storageManager) return false;

    try {
      // 从存储中删除
      await this.storageManager.deleteRetryState(fileId);
      return true;
    } catch (err) {
      console.warn(`删除文件 ${fileId} 的重试状态失败:`, err);
      return false;
    }
  }

  /**
   * 清理所有重试状态
   * @returns Promise<void>
   */
  async clearAllRetryStates(): Promise<void> {
    // 清空缓存
    this.stateCache.clear();

    // 检查依赖
    if (!this.storageManager) return;

    try {
      // 获取所有活动上传
      const activeUploads = await this.storageManager.getActiveUploads();

      // 删除每个活动上传的重试状态
      for (const fileId of activeUploads) {
        try {
          await this.storageManager.deleteRetryState(fileId);
        } catch (err) {
          console.warn(`删除文件 ${fileId} 的重试状态失败:`, err);
          // 继续处理其他文件，不中断整个过程
        }
      }
    } catch (err) {
      console.warn('清理重试状态失败:', err);
    }
  }
}

/**
 * 创建重试状态管理器
 * @param storageManager 存储管理器
 * @returns 重试状态管理器实例
 */
export function createRetryStateManager(storageManager?: StorageManager): RetryStateManager {
  return new RetryStateManager(storageManager);
}
