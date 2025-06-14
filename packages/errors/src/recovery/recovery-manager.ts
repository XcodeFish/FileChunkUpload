/**
 * 错误恢复管理器实现
 * 负责管理错误重试和恢复策略，提供错误重试和恢复机制
 * @packageDocumentation
 */

import {
  IErrorRecoveryManager,
  IUploadError,
  IErrorContext,
  IErrorHandler,
  IErrorAction,
  IRetryStats,
} from '@file-chunk-uploader/types';

/**
 * 恢复任务接口
 */
interface RecoveryTask {
  /** 任务ID */
  id: string;
  /** 文件ID */
  fileId?: string;
  /** 分片索引 */
  chunkIndex?: number;
  /** 计划执行时间 */
  scheduledTime: number;
  /** 延迟时间（毫秒） */
  delay: number;
  /** 错误上下文 */
  context: IErrorContext;
  /** 错误对象 */
  error: IUploadError;
  /** 任务处理函数 */
  handler: () => Promise<void>;
  /** 是否已处理 */
  handled: boolean;
  /** 创建时间 */
  createdAt: number;
}

/**
 * 网络检测器接口
 */
interface NetworkDetector {
  /** 是否在线 */
  isOnline(): boolean;
  /** 添加在线状态变化监听器 */
  addOnlineListener(listener: () => void): void;
  /** 移除在线状态变化监听器 */
  removeOnlineListener(listener: () => void): void;
}

/**
 * 事件发射器接口
 */
interface EventEmitter {
  /** 发射事件 */
  emit(event: string, data: any): void;
}

/**
 * 默认网络检测器实现
 */
class DefaultNetworkDetector implements NetworkDetector {
  private onlineListeners: Array<() => void> = [];

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
    }
  }

  /**
   * 检查是否在线
   * @returns 是否在线
   */
  isOnline(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }

  /**
   * 添加在线状态变化监听器
   * @param listener 监听器函数
   */
  addOnlineListener(listener: () => void): void {
    this.onlineListeners.push(listener);
  }

  /**
   * 移除在线状态变化监听器
   * @param listener 监听器函数
   */
  removeOnlineListener(listener: () => void): void {
    this.onlineListeners = this.onlineListeners.filter(l => l !== listener);
  }

  /**
   * 处理在线事件
   */
  private handleOnline = (): void => {
    this.onlineListeners.forEach(listener => {
      try {
        listener();
      } catch (err) {
        console.error('网络状态监听回调错误:', err);
      }
    });
  };

  /**
   * 清理资源
   */
  cleanup(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
    }
    this.onlineListeners = [];
  }
}

/**
 * 默认事件发射器实现
 */
class DefaultEventEmitter implements EventEmitter {
  /**
   * 发射事件
   * @param event 事件名称
   * @param data 事件数据
   */
  emit(event: string, data: any): void {
    // 简单实现，实际项目中可能会使用更完整的事件系统
    console.log(`[Event] ${event}:`, data);
  }
}

/**
 * 错误恢复管理器配置接口
 */
export interface RecoveryManagerConfig {
  /** 是否启用智能决策 */
  useSmartDecision?: boolean;
  /** 最低成功率阈值 */
  minSuccessRate?: number;
  /** 是否发送重试事件通知 */
  notifyOnRetry?: boolean;
}

/**
 * 错误恢复管理器类
 * 实现IErrorRecoveryManager接口，提供错误重试和恢复机制
 */
export class RecoveryManager implements IErrorRecoveryManager {
  /** 错误处理器 */
  private errorHandler: IErrorHandler;
  /** 网络检测器 */
  private networkDetector: NetworkDetector;
  /** 事件发射器 */
  private eventEmitter: EventEmitter;
  /** 恢复任务队列 */
  private recoveryQueue: Map<string, RecoveryTask> = new Map();
  /** 重试统计 */
  private retryStats: Map<string, IRetryStats> = new Map();
  /** 定时器ID */
  private timerId: ReturnType<typeof setTimeout> | null = null;
  /** 配置 */
  private config: RecoveryManagerConfig;

  /**
   * 构造函数
   * @param errorHandler 错误处理器
   * @param options 配置选项
   */
  constructor(
    errorHandler: IErrorHandler,
    options: {
      networkDetector?: NetworkDetector;
      eventEmitter?: EventEmitter;
      config?: RecoveryManagerConfig;
    } = {},
  ) {
    this.errorHandler = errorHandler;
    this.networkDetector = options.networkDetector || new DefaultNetworkDetector();
    this.eventEmitter = options.eventEmitter || new DefaultEventEmitter();
    this.config = {
      useSmartDecision: true,
      minSuccessRate: 0.2,
      notifyOnRetry: true,
      ...options.config,
    };

    // 监听网络状态变化
    this.networkDetector.addOnlineListener(this.onNetworkOnline);
  }

  /**
   * 处理错误
   * @param error 上传错误
   * @param context 错误上下文
   */
  async handleError(error: IUploadError, context: IErrorContext): Promise<void> {
    // 获取错误处理动作
    const action = this.errorHandler.handle(error, context);

    // 更新错误统计
    this.updateErrorStats(error, context);

    // 根据动作类型处理
    switch (action.type) {
      case 'retry':
        // 发送重试开始事件
        if (this.config.notifyOnRetry) {
          this.eventEmitter.emit('retry:start', {
            fileId: context.fileId,
            chunkIndex: context.chunkIndex,
            retryCount: context.retryCount,
            delay: action.delay,
            error,
          });
        }

        // 安排重试
        await this.scheduleRetry(context, action, error);
        break;

      case 'wait_for_connection':
        if (this.config.notifyOnRetry) {
          this.eventEmitter.emit('retry:waiting', {
            fileId: context.fileId,
            reason: 'network_disconnect',
          });
        }

        // 等待网络连接恢复
        this.queueForNetworkRecovery(context, error);
        break;

      case 'adjust_and_retry':
        if (this.config.notifyOnRetry) {
          this.eventEmitter.emit('retry:adjusting', {
            fileId: context.fileId,
            chunkIndex: context.chunkIndex,
            oldChunkSize: context.chunkSize,
            newChunkSize: action.newChunkSize,
          });
        }

        // 调整分片大小后重试
        await this.adjustAndRetry(context, action, error);
        break;

      case 'fail':
        // 发送重试失败事件
        if (this.config.notifyOnRetry) {
          this.eventEmitter.emit('retry:failed', {
            fileId: context.fileId,
            error,
            recoverable: action.recoverable || false,
          });
        }

        // 处理失败
        this.handleFailure(context, action, error);
        break;
    }
  }

  /**
   * 处理重试成功
   * @param context 错误上下文
   */
  async handleRetrySuccess(context: IErrorContext): Promise<void> {
    const fileId = context.fileId;
    if (!fileId) return;

    // 更新统计
    const stats = this.getOrCreateRetryStats(fileId);
    stats.successCount++;

    // 发送重试成功事件
    if (this.config.notifyOnRetry) {
      this.eventEmitter.emit('retry:success', {
        fileId,
        chunkIndex: context.chunkIndex,
        successCount: stats.successCount,
      });
    }
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    // 清除定时器
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }

    // 清空恢复队列
    this.recoveryQueue.clear();

    // 移除网络监听器
    if (this.networkDetector instanceof DefaultNetworkDetector) {
      (this.networkDetector as DefaultNetworkDetector).cleanup();
    }
  }

  /**
   * 安排重试
   * @param context 错误上下文
   * @param action 错误处理动作
   * @param error 上传错误
   * @private
   */
  private async scheduleRetry(
    context: IErrorContext,
    action: IErrorAction,
    error: IUploadError,
  ): Promise<void> {
    // 检查是否应该重试
    if (this.config.useSmartDecision && !this.shouldRetry(context)) {
      // 智能决策认为不应该重试
      if (this.config.notifyOnRetry) {
        this.eventEmitter.emit('retry:skipped', {
          fileId: context.fileId,
          reason: 'smart_decision',
          error,
        });
      }
      return;
    }

    const delay = action.delay || 1000;
    const taskId = this.generateTaskId(context);
    const scheduledTime = Date.now() + delay;

    // 创建恢复任务
    const task: RecoveryTask = {
      id: taskId,
      fileId: context.fileId,
      chunkIndex: context.chunkIndex,
      scheduledTime,
      delay,
      context: {
        ...context,
        retryCount: context.retryCount + 1, // 增加重试计数
        lastError: error,
      },
      error,
      handler: async () => {
        // 这里实际上需要外部传入一个回调函数来执行重试逻辑
        // 在实际使用时，可以通过事件系统通知上传器执行重试
        if (this.config.notifyOnRetry) {
          this.eventEmitter.emit('retry:execute', {
            fileId: context.fileId,
            chunkIndex: context.chunkIndex,
            retryCount: context.retryCount + 1,
          });
        }
      },
      handled: false,
      createdAt: Date.now(),
    };

    // 添加到恢复队列
    this.recoveryQueue.set(taskId, task);

    // 安排执行
    this.scheduleNextTask();
  }

  /**
   * 等待网络连接恢复
   * @param context 错误上下文
   * @param error 上传错误
   * @private
   */
  private queueForNetworkRecovery(context: IErrorContext, error: IUploadError): void {
    const taskId = this.generateTaskId(context, 'network');

    // 创建网络恢复任务
    const task: RecoveryTask = {
      id: taskId,
      fileId: context.fileId,
      chunkIndex: context.chunkIndex,
      scheduledTime: 0, // 网络恢复后立即执行
      delay: 0,
      context: {
        ...context,
        lastError: error,
      },
      error,
      handler: async () => {
        // 网络恢复后执行重试
        if (this.config.notifyOnRetry) {
          this.eventEmitter.emit('retry:network_recovered', {
            fileId: context.fileId,
            chunkIndex: context.chunkIndex,
          });
        }
      },
      handled: false,
      createdAt: Date.now(),
    };

    // 添加到恢复队列
    this.recoveryQueue.set(taskId, task);

    // 如果已经在线，立即处理
    if (this.networkDetector.isOnline()) {
      this.processNetworkRecoveryTasks();
    }
  }

  /**
   * 调整分片大小后重试
   * @param context 错误上下文
   * @param action 错误处理动作
   * @param error 上传错误
   * @private
   */
  private async adjustAndRetry(
    context: IErrorContext,
    action: IErrorAction,
    error: IUploadError,
  ): Promise<void> {
    if (!action.newChunkSize) return;

    const taskId = this.generateTaskId(context, 'adjust');
    const scheduledTime = Date.now() + 1000; // 1秒后执行

    // 创建调整分片大小任务
    const task: RecoveryTask = {
      id: taskId,
      fileId: context.fileId,
      chunkIndex: context.chunkIndex,
      scheduledTime,
      delay: 1000,
      context: {
        ...context,
        chunkSize: action.newChunkSize, // 更新分片大小
        lastError: error,
      },
      error,
      handler: async () => {
        // 通知上传器调整分片大小并重试
        if (this.config.notifyOnRetry) {
          this.eventEmitter.emit('retry:adjust_chunk_size', {
            fileId: context.fileId,
            chunkIndex: context.chunkIndex,
            newChunkSize: action.newChunkSize,
          });
        }
      },
      handled: false,
      createdAt: Date.now(),
    };

    // 添加到恢复队列
    this.recoveryQueue.set(taskId, task);

    // 安排执行
    this.scheduleNextTask();
  }

  /**
   * 处理失败
   * @param context 错误上下文
   * @param _action 错误处理动作
   * @param _error 上传错误
   * @private
   */
  private handleFailure(context: IErrorContext, _action: IErrorAction, _error: IUploadError): void {
    const fileId = context.fileId;
    if (!fileId) return;

    // 更新统计
    const stats = this.getOrCreateRetryStats(fileId);
    stats.failCount++;

    // 清理相关任务
    if (context.chunkIndex !== undefined) {
      // 清理特定分片的任务
      const taskId = this.generateTaskId(context);
      this.recoveryQueue.delete(taskId);
    } else {
      // 清理整个文件的所有任务
      for (const [id, task] of this.recoveryQueue.entries()) {
        if (task.fileId === fileId) {
          this.recoveryQueue.delete(id);
        }
      }
    }
  }

  /**
   * 安排下一个任务执行
   * @private
   */
  private scheduleNextTask(): void {
    // 清除现有定时器
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }

    // 查找最早需要执行的任务
    let earliestTask: RecoveryTask | null = null;
    let earliestTime = Number.MAX_SAFE_INTEGER;

    for (const task of this.recoveryQueue.values()) {
      if (!task.handled && task.scheduledTime < earliestTime) {
        earliestTask = task;
        earliestTime = task.scheduledTime;
      }
    }

    if (!earliestTask) return;

    const now = Date.now();
    const delay = Math.max(0, earliestTime - now);

    // 设置定时器
    this.timerId = setTimeout(() => {
      this.executeTask(earliestTask!);
      this.scheduleNextTask(); // 安排下一个任务
    }, delay);
  }

  /**
   * 执行任务
   * @param task 恢复任务
   * @private
   */
  private async executeTask(task: RecoveryTask): Promise<void> {
    if (task.handled) return;

    try {
      // 标记任务为已处理
      task.handled = true;

      // 执行任务处理函数
      await task.handler();

      // 从队列中移除任务
      this.recoveryQueue.delete(task.id);
    } catch (err) {
      console.error(`执行恢复任务失败:`, err);
    }
  }

  /**
   * 处理网络恢复
   * @private
   */
  private onNetworkOnline = (): void => {
    this.processNetworkRecoveryTasks();
  };

  /**
   * 处理网络恢复任务
   * @private
   */
  private processNetworkRecoveryTasks(): void {
    // 查找网络恢复任务
    for (const task of this.recoveryQueue.values()) {
      if (!task.handled && task.scheduledTime === 0) {
        // 立即执行网络恢复任务
        this.executeTask(task);
      }
    }
  }

  /**
   * 生成任务ID
   * @param context 错误上下文
   * @param prefix 前缀
   * @returns 任务ID
   * @private
   */
  private generateTaskId(context: IErrorContext, prefix: string = ''): string {
    const { fileId, chunkIndex } = context;
    const base = fileId
      ? `${fileId}:${chunkIndex !== undefined ? chunkIndex : 'file'}`
      : `task:${Date.now()}`;
    return prefix ? `${prefix}:${base}` : base;
  }

  /**
   * 更新错误统计
   * @param error 上传错误
   * @param context 错误上下文
   * @private
   */
  private updateErrorStats(error: IUploadError, context: IErrorContext): void {
    const fileId = context.fileId;
    if (!fileId) return;

    const stats = this.getOrCreateRetryStats(fileId);
    stats.lastRetryTime = Date.now();
  }

  /**
   * 获取或创建重试统计
   * @param fileId 文件ID
   * @returns 重试统计
   * @private
   */
  private getOrCreateRetryStats(fileId: string): IRetryStats {
    let stats = this.retryStats.get(fileId);
    if (!stats) {
      stats = {
        successCount: 0,
        failCount: 0,
        lastRetryTime: 0,
        networkConditions: [],
      };
      this.retryStats.set(fileId, stats);
    }
    return stats;
  }

  /**
   * 智能决策是否应该重试
   * @param context 错误上下文
   * @returns 是否应该重试
   * @private
   */
  private shouldRetry(context: IErrorContext): boolean {
    const fileId = context.fileId;
    if (!fileId) return true; // 默认重试

    const stats = this.retryStats.get(fileId);
    if (!stats) return true;

    // 基于历史成功率决策
    const totalAttempts = stats.successCount + stats.failCount;
    if (
      totalAttempts > 5 &&
      stats.successCount / totalAttempts < (this.config.minSuccessRate || 0.2)
    ) {
      return false; // 成功率过低，不再重试
    }

    return true;
  }
}

/**
 * 创建错误恢复管理器
 * @param errorHandler 错误处理器
 * @param options 配置选项
 * @returns 错误恢复管理器实例
 */
export function createRecoveryManager(
  errorHandler: IErrorHandler,
  options: {
    networkDetector?: NetworkDetector;
    eventEmitter?: EventEmitter;
    config?: RecoveryManagerConfig;
  } = {},
): IErrorRecoveryManager {
  return new RecoveryManager(errorHandler, options);
}
