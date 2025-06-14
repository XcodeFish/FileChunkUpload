/**
 * 重试管理器实现
 * 负责管理上传错误的重试策略，提供丰富的重试机制
 * @packageDocumentation
 */

import { IUploadError, IErrorContext, IRetryConfig, ErrorCode } from '@file-chunk-uploader/types';

import { createNetworkDetector } from './network-detector';
import {
  RetryManager as IRetryManager,
  EventEmitter,
  NetworkDetector,
  StorageManager,
  RetryStartInfo,
  RetryFailedInfo,
  RetrySuccessInfo,
  RetryState,
  RetryTask,
  RetryManagerOptions,
  NetworkConditionRecord,
  NetworkInfo,
} from './retry-types';

/**
 * 默认重试配置
 */
const DEFAULT_RETRY_CONFIG: IRetryConfig = {
  enabled: true,
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  useExponentialBackoff: true,
};

/**
 * 重试管理器实现类
 * 处理上传错误的重试策略
 */
export class DefaultRetryManager implements IRetryManager {
  /** 配置 */
  private config: IRetryConfig;
  /** 网络检测器 */
  private networkDetector: NetworkDetector;
  /** 事件发射器 */
  private eventEmitter: EventEmitter;
  /** 存储管理器 */
  private storageManager?: StorageManager;
  /** 重试历史记录 */
  private retryHistory: Map<
    string,
    {
      successCount: number;
      failCount: number;
      lastRetryTime: number;
      networkConditions: NetworkConditionRecord[];
    }
  > = new Map();
  /** 重试任务队列 */
  private retryTasks: Map<string, RetryTask> = new Map();
  /** 重试定时器ID */
  private retryTimers: Map<string, number> = new Map();
  /** 是否已初始化 */
  private initialized: boolean = false;

  /**
   * 构造函数
   * @param options 重试管理器选项
   */
  constructor(options: RetryManagerOptions = {}) {
    this.config = {
      ...DEFAULT_RETRY_CONFIG,
      ...options.config,
    };

    this.networkDetector = options.networkDetector || createNetworkDetector();
    this.eventEmitter = options.eventEmitter || {
      emit: () => {
        /* 空实现 */
      },
    };
    this.storageManager = options.storageManager;

    // 监听网络状态变化
    this.networkDetector.onNetworkChange(this.handleNetworkChange.bind(this));

    // 初始化重试状态
    this.initialize();
  }

  /**
   * 初始化重试管理器
   */
  private async initialize(): Promise<void> {
    if (this.initialized || !this.storageManager) {
      this.initialized = true;
      return;
    }

    try {
      // 从存储加载重试状态
      const activeUploads = await this.storageManager.getActiveUploads();

      for (const fileId of activeUploads) {
        const retryState = await this.storageManager.getRetryState(fileId);
        if (retryState) {
          this.retryHistory.set(fileId, {
            successCount: retryState.successfulRetries || 0,
            failCount: retryState.failedRetries || 0,
            lastRetryTime: retryState.lastRetryTime,
            networkConditions: [],
          });
        }
      }

      this.initialized = true;
    } catch (err) {
      console.warn('初始化重试状态失败:', err);
      this.initialized = true;
    }
  }

  /**
   * 处理网络状态变化
   * @param network 网络状态
   */
  private handleNetworkChange(network: NetworkInfo): void {
    if (network.online) {
      // 网络恢复在线时，处理等待中的任务
      this.processWaitingTasks();
    }
  }

  /**
   * 处理等待中的重试任务
   */
  private processWaitingTasks(): void {
    const now = Date.now();
    const tasksToExecute: RetryTask[] = [];

    // 找出所有可以执行的任务
    this.retryTasks.forEach(task => {
      if (!task.handled && task.scheduledTime <= now) {
        tasksToExecute.push(task);
      }
    });

    // 执行任务
    tasksToExecute.forEach(task => {
      this.executeTask(task);
    });
  }

  /**
   * 执行重试任务
   * @param task 重试任务
   */
  private async executeTask(task: RetryTask): Promise<void> {
    if (task.handled) return;

    try {
      task.handled = true;
      await task.handler();

      // 处理重试成功
      await this.handleRetrySuccess(task.context);
    } catch (err) {
      // 处理重试失败
      this.handleRetryFailure(
        task.context,
        task.error,
        task.context.retryCount < (this.config.maxRetries || 3),
      );
    } finally {
      // 清理任务
      this.retryTasks.delete(task.id);
      if (this.retryTimers.has(task.id)) {
        clearTimeout(this.retryTimers.get(task.id));
        this.retryTimers.delete(task.id);
      }
    }
  }

  /**
   * 处理错误重试
   * @param error 错误对象
   * @param context 错误上下文
   * @param handler 重试处理函数
   */
  async retry(
    error: IUploadError,
    context: IErrorContext,
    handler: () => Promise<void>,
  ): Promise<void> {
    // 确保已初始化
    await this.ensureInitialized();

    // 检查重试是否启用
    if (!(this.config.enabled ?? true)) {
      this.handleRetryFailure(context, error, false);
      return;
    }

    // 设置重试计数
    if (context.retryCount === undefined) {
      context.retryCount = 0;
    } else {
      context.retryCount++;
    }

    // 检查是否可重试
    if (!this.isRetryable(error) || context.retryCount >= (this.config.maxRetries || 3)) {
      this.handleRetryFailure(context, error, false);
      return;
    }

    // 更新重试统计
    this.updateRetryStats(context, error);

    // 检查是否应该进行重试
    if (!this.shouldRetry(context)) {
      this.handleRetryFailure(context, error, true);
      return;
    }

    // 计算重试延迟
    const delay = this.calculateRetryDelay(context.retryCount);

    // 创建重试任务ID
    const taskId = `${context.fileId || 'unknown'}_${context.chunkIndex || 'file'}_${Date.now()}`;

    // 创建重试任务
    const task: RetryTask = {
      id: taskId,
      fileId: context.fileId,
      chunkIndex: context.chunkIndex,
      type: 'retry',
      scheduledTime: Date.now() + delay,
      delay,
      context,
      error,
      handler,
      handled: false,
      createdAt: Date.now(),
    };

    // 注册任务
    this.retryTasks.set(taskId, task);

    // 发送重试开始事件
    const startInfo: RetryStartInfo = {
      fileId: context.fileId,
      chunkIndex: context.chunkIndex,
      retryCount: context.retryCount,
      delay,
      error,
    };
    this.eventEmitter.emit('retry:start', startInfo);

    // 安排重试
    const timerId = window.setTimeout(() => {
      this.executeTask(task);
    }, delay);

    this.retryTimers.set(taskId, timerId);

    // 保存重试状态
    await this.saveRetryState(context);
  }

  /**
   * 确保已初始化
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * 检查错误是否可重试
   * @param error 错误对象
   * @returns 是否可重试
   */
  private isRetryable(error: IUploadError): boolean {
    if (error.retryable !== undefined) {
      return error.retryable;
    }

    // 默认认为网络错误和服务器错误可重试
    return [
      ErrorCode.NETWORK_ERROR,
      ErrorCode.NETWORK_DISCONNECT,
      ErrorCode.SERVER_ERROR,
      ErrorCode.SERVER_TIMEOUT,
      ErrorCode.CHUNK_UPLOAD_FAILED,
    ].includes(error.code as ErrorCode);
  }

  /**
   * 更新重试统计数据
   * @param context 错误上下文
   * @param _error 错误对象
   */
  private updateRetryStats(context: IErrorContext, _error: IUploadError): void {
    const fileId = context.fileId;
    if (!fileId) return;

    let stats = this.retryHistory.get(fileId);
    if (!stats) {
      stats = {
        successCount: 0,
        failCount: 0,
        lastRetryTime: 0,
        networkConditions: [],
      };
      this.retryHistory.set(fileId, stats);
    }

    // 记录当前网络状况
    const networkInfo = this.networkDetector.getCurrentNetwork();
    const networkRecord: NetworkConditionRecord = {
      time: Date.now(),
      online: networkInfo.online,
      type: networkInfo.type,
      speed: networkInfo.speed,
      rtt: networkInfo.rtt,
    };
    stats.networkConditions.push(networkRecord);

    // 保留最近10条记录
    if (stats.networkConditions.length > 10) {
      stats.networkConditions.shift();
    }

    // 更新最后重试时间
    stats.lastRetryTime = Date.now();
  }

  /**
   * 基于历史数据判断是否应该重试
   * @param context 错误上下文
   * @returns 是否应该重试
   */
  private shouldRetry(context: IErrorContext): boolean {
    const fileId = context.fileId;
    if (!fileId) return true; // 默认重试

    const stats = this.retryHistory.get(fileId);
    if (!stats) return true;

    // 如果成功率过低，可能不值得重试
    const totalAttempts = stats.successCount + stats.failCount;
    if (totalAttempts > 5 && stats.successCount / totalAttempts < 0.2) {
      return false; // 成功率低于20%，不再重试
    }

    // 基于网络质量决定是否重试
    const recentConditions = stats.networkConditions.slice(-3); // 最近3次网络状况
    if (recentConditions.length >= 3) {
      // 如果连续3次网络状况很差，暂停重试
      const allPoorConditions = recentConditions.every(
        c => !c.online || c.speed < 0.5 || c.rtt > 1000,
      );

      if (allPoorConditions) {
        return false;
      }
    }

    return true;
  }

  /**
   * 计算重试延迟时间
   * @param retryCount 当前重试次数
   * @returns 延迟时间（毫秒）
   */
  private calculateRetryDelay(retryCount: number): number {
    const baseDelay = this.config.baseDelay ?? 1000;
    const maxDelay = this.config.maxDelay ?? 30000;
    const useExponentialBackoff = this.config.useExponentialBackoff ?? true;

    let delay: number;

    if (useExponentialBackoff) {
      // 指数退避算法: 基础延迟 * 2^重试次数
      delay = baseDelay * Math.pow(2, retryCount);
    } else {
      // 线性延迟: 基础延迟 * (重试次数 + 1)
      delay = baseDelay * (retryCount + 1);
    }

    // 添加一些随机抖动，避免同时重试
    const jitter = Math.random() * baseDelay * 0.5;
    delay += jitter;

    // 限制最大延迟
    return Math.min(delay, maxDelay);
  }

  /**
   * 保存重试状态到持久化存储
   * @param context 错误上下文
   */
  private async saveRetryState(context: IErrorContext): Promise<void> {
    if (!this.storageManager || !context.fileId) return;

    const stats = this.retryHistory.get(context.fileId);
    if (!stats) return;

    const retryState: RetryState = {
      fileId: context.fileId,
      retryCount: context.retryCount || 0,
      lastRetryTime: stats.lastRetryTime,
      chunkRetries: context.chunkRetries || {},
      successfulRetries: stats.successCount,
      failedRetries: stats.failCount,
    };

    try {
      await this.storageManager.saveRetryState(context.fileId, retryState);
    } catch (err) {
      console.warn('保存重试状态失败:', err);
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
    const stats = this.retryHistory.get(fileId) || {
      successCount: 0,
      failCount: 0,
      lastRetryTime: 0,
      networkConditions: [],
    };

    stats.successCount++;
    this.retryHistory.set(fileId, stats);

    // 发送重试成功事件
    const successInfo: RetrySuccessInfo = {
      fileId,
      chunkIndex: context.chunkIndex,
      successCount: stats.successCount,
    };

    this.eventEmitter.emit('retry:success', successInfo);

    // 更新持久化存储
    if (this.storageManager) {
      try {
        const retryState = await this.storageManager.getRetryState(fileId);
        if (retryState) {
          retryState.successfulRetries = stats.successCount;
          await this.storageManager.saveRetryState(fileId, retryState);
        }
      } catch (err) {
        console.warn('更新重试状态失败:', err);
      }
    }
  }

  /**
   * 处理重试失败
   * @param context 错误上下文
   * @param error 错误对象
   * @param recoverable 是否可恢复
   */
  handleRetryFailure(context: IErrorContext, error: IUploadError, recoverable: boolean): void {
    const fileId = context.fileId;
    if (!fileId) return;

    // 更新统计
    const stats = this.retryHistory.get(fileId);
    if (stats) {
      stats.failCount++;
      this.retryHistory.set(fileId, stats);
    }

    // 发送重试失败事件
    const failedInfo: RetryFailedInfo = {
      fileId,
      error,
      recoverable,
    };

    this.eventEmitter.emit('retry:failed', failedInfo);

    // 更新持久化存储
    if (this.storageManager) {
      this.storageManager
        .getRetryState(fileId)
        .then(retryState => {
          if (retryState) {
            retryState.failedRetries = (retryState.failedRetries || 0) + 1;
            this.storageManager!.saveRetryState(fileId, retryState).catch(err => {
              console.warn('更新重试状态失败:', err);
            });
          }
        })
        .catch(() => {
          // 忽略错误
        });
    }
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    // 清除所有定时器
    this.retryTimers.forEach(timerId => {
      clearTimeout(timerId);
    });

    this.retryTimers.clear();
    this.retryTasks.clear();
    this.retryHistory.clear();

    // 清理网络检测器
    this.networkDetector.cleanup();
  }
}

/**
 * 创建重试管理器
 * @param options 重试管理器选项
 * @returns 重试管理器实例
 */
export function createRetryManager(options?: RetryManagerOptions): IRetryManager {
  return new DefaultRetryManager(options);
}
