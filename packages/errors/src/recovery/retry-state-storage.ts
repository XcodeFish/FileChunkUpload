/**
 * 重试状态持久化管理器
 * 负责重试状态的存储和恢复
 * @packageDocumentation
 */

import { StorageManager, BaseRetryState, NetworkInfo, RetryState } from './retry-types';

/**
 * 存储操作结果
 * 表示存储操作的结果状态
 */
export interface StorageOperationResult {
  /** 操作是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: Error;
  /** 操作类型 */
  operation:
    | 'save'
    | 'load'
    | 'delete'
    | 'clean'
    | 'recordSuccess'
    | 'recordFailure'
    | 'recordNetworkState'
    | 'syncState';
  /** 已删除的计数 */
  deletedCount?: number;
}

/**
 * 重试状态存储选项接口
 */
export interface RetryStateStorageOptions {
  /** 存储管理器 */
  storageManager: StorageManager;
  /** 是否启用跨设备同步 */
  enableSync?: boolean;
  /** 状态过期时间（毫秒），默认7天 */
  expirationTime?: number;
  /** 设备标识符 */
  deviceId?: string;
  /** 会话标识符 */
  sessionId?: string;
  /** 存储键前缀 */
  storageKeyPrefix?: string;
  /** 网络历史记录最大长度 */
  maxNetworkHistoryLength?: number;
  /** 重试历史记录最大长度 */
  maxRetryHistoryLength?: number;
}

/**
 * 重试状态存储接口
 * 定义重试状态的存储和恢复方法
 */
export interface RetryStateStorage {
  /**
   * 保存状态
   * @param fileId 文件ID
   * @param state 重试状态
   */
  saveState(fileId: string, state: BaseRetryState): Promise<StorageOperationResult>;

  /**
   * 加载状态
   * @param fileId 文件ID
   * @returns 重试状态，如果不存在则返回null
   */
  loadState(fileId: string): Promise<RetryState | null>;

  /**
   * 获取所有活动状态
   * @returns 所有活动状态的数组
   */
  getAllActiveStates(): Promise<RetryState[]>;

  /**
   * 删除状态
   * @param fileId 文件ID
   */
  deleteState(fileId: string): Promise<StorageOperationResult>;

  /**
   * 清理过期状态
   */
  cleanupExpiredStates(): Promise<StorageOperationResult>;

  /**
   * 记录重试成功
   * @param fileId 文件ID
   */
  recordSuccess(fileId: string): Promise<StorageOperationResult>;

  /**
   * 记录重试失败
   * @param fileId 文件ID
   * @param errorMessage 错误信息
   * @param errorCode 错误代码
   */
  recordFailure(
    fileId: string,
    errorMessage?: string,
    errorCode?: string,
  ): Promise<StorageOperationResult>;

  /**
   * 记录网络状态
   * @param fileId 文件ID
   * @param networkInfo 网络信息
   */
  recordNetworkState(fileId: string, networkInfo: NetworkInfo): Promise<StorageOperationResult>;

  /**
   * 获取设备ID
   * @returns 设备ID
   */
  getDeviceId(): string;

  /**
   * 获取会话ID
   * @returns 会话ID
   */
  getSessionId(): string;
}

/**
 * 默认重试状态存储实现
 */
export class DefaultRetryStateStorage implements RetryStateStorage {
  /** 存储管理器 */
  private storageManager: StorageManager;
  /** 是否启用跨设备同步 */
  private enableSync: boolean;
  /** 状态过期时间（毫秒） */
  private expirationTime: number;
  /** 设备标识符 */
  private deviceId: string;
  /** 会话标识符 */
  private sessionId: string;
  /** 存储键前缀 */
  private storageKeyPrefix: string;
  /** 网络历史记录最大长度 */
  private maxNetworkHistoryLength: number;
  /** 重试历史记录最大长度 */
  private maxRetryHistoryLength: number;

  /**
   * 构造函数
   * @param options 存储选项
   */
  constructor(options: RetryStateStorageOptions) {
    this.storageManager = options.storageManager;
    this.enableSync = options.enableSync || false;
    this.expirationTime = options.expirationTime || 7 * 24 * 60 * 60 * 1000; // 默认7天
    this.deviceId = options.deviceId || this.generateDeviceId();
    this.sessionId = options.sessionId || this.generateSessionId();
    this.storageKeyPrefix = options.storageKeyPrefix || 'retry-state';
    this.maxNetworkHistoryLength = options.maxNetworkHistoryLength || 20;
    this.maxRetryHistoryLength = options.maxRetryHistoryLength || 50;
  }

  /**
   * 保存状态
   * @param fileId 文件ID
   * @param state 重试状态
   * @returns 操作结果
   */
  async saveState(fileId: string, state: BaseRetryState): Promise<StorageOperationResult> {
    try {
      // 创建扩展状态
      const now = Date.now();
      const extendedState: RetryState = {
        ...state,
        deviceId: this.deviceId,
        sessionId: this.sessionId,
        createdAt: now,
        updatedAt: now,
        expiresAt: now + this.expirationTime,
        networkHistory: [],
        retryHistory: [],
        syncStatus: {
          synced: false,
          lastSyncTime: 0,
        },
      };

      // 保存到存储
      await this.storageManager.saveRetryState(fileId, extendedState);
      return { success: true, operation: 'save' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('未知错误'),
        operation: 'save',
      };
    }
  }

  /**
   * 加载状态
   * @param fileId 文件ID
   * @returns 重试状态，如果不存在则返回null
   */
  async loadState(fileId: string): Promise<RetryState | null> {
    try {
      const state = await this.storageManager.getRetryState(fileId);
      if (!state) return null;

      // 检查是否过期
      if ('expiresAt' in state && state.expiresAt < Date.now()) {
        await this.deleteState(fileId);
        return null;
      }

      // 确保返回完整的RetryState格式
      const now = Date.now();
      const isBaseState = !('deviceId' in state);

      if (isBaseState) {
        // 如果只有基本状态，则扩展为完整的RetryState
        const baseState = state as BaseRetryState;
        return {
          ...baseState,
          deviceId: this.deviceId,
          sessionId: this.sessionId,
          createdAt: now,
          updatedAt: now,
          expiresAt: now + this.expirationTime,
          networkHistory: [],
          retryHistory: [],
          syncStatus: {
            synced: false,
            lastSyncTime: 0,
          },
        };
      }

      // 已经是完整的RetryState
      return state as RetryState;
    } catch (error) {
      console.error(`加载文件 ${fileId} 的重试状态失败:`, error);
      return null;
    }
  }

  /**
   * 获取所有活动状态
   * @returns 所有活动状态的数组
   */
  async getAllActiveStates(): Promise<RetryState[]> {
    try {
      const fileIds = await this.storageManager.getActiveUploads();
      const states: RetryState[] = [];

      for (const fileId of fileIds) {
        const state = await this.loadState(fileId);
        if (state) {
          states.push(state);
        }
      }

      return states;
    } catch (error) {
      console.error('获取活动状态失败:', error);
      return [];
    }
  }

  /**
   * 删除状态
   * @param fileId 文件ID
   * @returns 操作结果
   */
  async deleteState(fileId: string): Promise<StorageOperationResult> {
    try {
      await this.storageManager.deleteRetryState(fileId);
      return { success: true, operation: 'delete' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('未知错误'),
        operation: 'delete',
      };
    }
  }

  /**
   * 清理过期状态
   * @returns 操作结果
   */
  async cleanupExpiredStates(): Promise<StorageOperationResult> {
    try {
      const states = await this.getAllActiveStates();
      const now = Date.now();
      let deletedCount = 0;

      for (const state of states) {
        if (state.expiresAt < now) {
          await this.deleteState(state.fileId);
          deletedCount++;
        }
      }

      return {
        success: true,
        operation: 'clean',
        deletedCount,
      } as StorageOperationResult;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('未知错误'),
        operation: 'clean',
      };
    }
  }

  /**
   * 记录重试成功
   * @param fileId 文件ID
   */
  async recordSuccess(fileId: string): Promise<StorageOperationResult> {
    try {
      // 加载当前状态
      const currentState = await this.loadState(fileId);
      if (!currentState) {
        // 如果状态不存在，创建一个新的
        const now = Date.now();
        const newState: RetryState = {
          fileId,
          retryCount: 0,
          lastRetryTime: now,
          chunkRetries: {},
          successfulRetries: 1,
          failedRetries: 0,
          deviceId: this.deviceId,
          sessionId: this.sessionId,
          createdAt: now,
          updatedAt: now,
          expiresAt: now + this.expirationTime,
          networkHistory: [],
          retryHistory: [
            {
              timestamp: now,
              success: true,
            },
          ],
          syncStatus: {
            synced: false,
            lastSyncTime: 0,
          },
        };

        await this.storageManager.saveRetryState(fileId, newState);
        return {
          success: true,
          operation: 'recordSuccess',
        };
      }

      // 更新重试历史记录
      const updatedState: RetryState = {
        ...currentState,
        successfulRetries: (currentState.successfulRetries || 0) + 1,
        updatedAt: Date.now(),
        retryHistory: [
          ...(currentState.retryHistory || []),
          {
            timestamp: Date.now(),
            success: true,
          },
        ],
      };

      // 限制历史记录长度
      if (updatedState.retryHistory.length > this.maxRetryHistoryLength) {
        updatedState.retryHistory = updatedState.retryHistory.slice(-this.maxRetryHistoryLength);
      }

      // 保存更新后的状态
      await this.storageManager.saveRetryState(fileId, updatedState);

      return {
        success: true,
        operation: 'recordSuccess',
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        operation: 'recordSuccess',
      };
    }
  }

  /**
   * 记录重试失败
   * @param fileId 文件ID
   * @param errorMessage 错误消息
   * @param errorCode 错误代码
   */
  async recordFailure(
    fileId: string,
    errorMessage?: string,
    errorCode?: string,
  ): Promise<StorageOperationResult> {
    try {
      // 加载当前状态
      const currentState = await this.loadState(fileId);
      if (!currentState) {
        // 如果状态不存在，创建一个新的
        const now = Date.now();
        const newState: RetryState = {
          fileId,
          retryCount: 0,
          lastRetryTime: now,
          chunkRetries: {},
          successfulRetries: 0,
          failedRetries: 1,
          deviceId: this.deviceId,
          sessionId: this.sessionId,
          createdAt: now,
          updatedAt: now,
          expiresAt: now + this.expirationTime,
          networkHistory: [],
          retryHistory: [
            {
              timestamp: now,
              success: false,
              errorMessage,
              errorCode,
            },
          ],
          syncStatus: {
            synced: false,
            lastSyncTime: 0,
          },
        };

        await this.storageManager.saveRetryState(fileId, newState);
        return {
          success: true,
          operation: 'recordFailure',
        };
      }

      // 更新重试历史记录
      const updatedState: RetryState = {
        ...currentState,
        failedRetries: (currentState.failedRetries || 0) + 1,
        updatedAt: Date.now(),
        retryHistory: [
          ...(currentState.retryHistory || []),
          {
            timestamp: Date.now(),
            success: false,
            errorMessage,
            errorCode,
          },
        ],
      };

      // 限制历史记录长度
      if (updatedState.retryHistory.length > this.maxRetryHistoryLength) {
        updatedState.retryHistory = updatedState.retryHistory.slice(-this.maxRetryHistoryLength);
      }

      // 保存更新后的状态
      await this.storageManager.saveRetryState(fileId, updatedState);

      return {
        success: true,
        operation: 'recordFailure',
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        operation: 'recordFailure',
      };
    }
  }

  /**
   * 记录网络状态
   * @param fileId 文件ID
   * @param networkInfo 网络信息
   */
  async recordNetworkState(
    fileId: string,
    networkInfo: NetworkInfo,
  ): Promise<StorageOperationResult> {
    try {
      // 加载当前状态
      const currentState = await this.loadState(fileId);
      if (!currentState) {
        // 如果状态不存在，创建一个新的
        const now = Date.now();
        const newState: RetryState = {
          fileId,
          retryCount: 0,
          lastRetryTime: now,
          chunkRetries: {},
          successfulRetries: 0,
          failedRetries: 0,
          deviceId: this.deviceId,
          sessionId: this.sessionId,
          createdAt: now,
          updatedAt: now,
          expiresAt: now + this.expirationTime,
          networkHistory: [
            {
              timestamp: now,
              network: networkInfo,
            },
          ],
          retryHistory: [],
          syncStatus: {
            synced: false,
            lastSyncTime: 0,
          },
        };

        await this.storageManager.saveRetryState(fileId, newState);
        return {
          success: true,
          operation: 'recordNetworkState',
        };
      }

      // 更新网络历史记录
      const updatedState: RetryState = {
        ...currentState,
        updatedAt: Date.now(),
        networkHistory: [
          ...(currentState.networkHistory || []),
          {
            timestamp: Date.now(),
            network: networkInfo,
          },
        ],
      };

      // 限制历史记录长度
      if (updatedState.networkHistory.length > this.maxNetworkHistoryLength) {
        updatedState.networkHistory = updatedState.networkHistory.slice(
          -this.maxNetworkHistoryLength,
        );
      }

      // 保存更新后的状态
      await this.storageManager.saveRetryState(fileId, updatedState);

      return {
        success: true,
        operation: 'recordNetworkState',
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        operation: 'recordNetworkState',
      };
    }
  }

  /**
   * 获取设备ID
   * @returns 设备ID
   */
  getDeviceId(): string {
    return this.deviceId;
  }

  /**
   * 获取会话ID
   * @returns 会话ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * 生成设备标识符
   * 使用多种信息生成更可靠的设备指纹
   * @returns 设备标识符
   */
  private generateDeviceId(): string {
    // 尝试从localStorage获取设备ID
    try {
      const storageKey = `${this.storageKeyPrefix}:device-id`;
      const storedDeviceId = localStorage.getItem(storageKey);
      if (storedDeviceId) {
        return storedDeviceId;
      }
    } catch (err) {
      // localStorage可能不可用，忽略错误
      console.warn('无法从localStorage获取设备ID:', err);
    }

    // 生成新的设备ID，使用多种信息创建更可靠的指纹
    let fingerprint = '';

    try {
      // 收集浏览器和设备信息
      const info = [
        navigator.userAgent,
        navigator.language,
        new Date().getTimezoneOffset(),
        screen.colorDepth,
        screen.width + 'x' + screen.height,
        navigator.hardwareConcurrency || 'unknown',
        // 使用类型断言避免TypeScript错误
        (navigator as any).deviceMemory || 'unknown',
        navigator.platform || 'unknown',
      ];

      fingerprint = info.join('|');
    } catch (e) {
      // 如果获取信息失败，使用随机值
      fingerprint = Math.random().toString(36).substring(2, 15);
    }

    // 创建哈希
    const deviceId = this.simpleHash(fingerprint);

    // 保存到localStorage以便后续使用
    try {
      const storageKey = `${this.storageKeyPrefix}:device-id`;
      localStorage.setItem(storageKey, deviceId);
    } catch (err) {
      // 忽略localStorage错误
    }

    return deviceId;
  }

  /**
   * 生成会话标识符
   * @returns 会话标识符
   */
  private generateSessionId(): string {
    const timestamp = Date.now();
    const randomPart = Math.random().toString(36).substring(2, 10);

    // 尝试获取更多会话相关信息
    let sessionInfo = '';
    try {
      // 添加页面URL的哈希（不包含敏感参数）
      const urlHash = this.simpleHash(window.location.origin + window.location.pathname);

      // 添加页面加载时间信息
      const pageLoadTime =
        performance && performance.timing
          ? (performance.timing.navigationStart || 0).toString(36)
          : '';

      sessionInfo = `${urlHash}-${pageLoadTime}`;
    } catch (e) {
      // 忽略错误，使用默认随机值
      sessionInfo = Math.random().toString(36).substring(2, 6);
    }

    return `session-${timestamp}-${sessionInfo}-${randomPart}`;
  }

  /**
   * 简单哈希函数
   * @param str 要哈希的字符串
   * @returns 哈希值
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    // 转换为更友好的格式
    const hashStr = Math.abs(hash).toString(36);
    const timestamp = Date.now().toString(36).substring(4);

    return `${hashStr}-${timestamp}`;
  }
}

/**
 * 创建重试状态存储
 * @param options 存储选项
 * @returns 重试状态存储实例
 */
export function createRetryStateStorage(options: RetryStateStorageOptions): RetryStateStorage {
  return new DefaultRetryStateStorage(options);
}
