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
 * 定义重试机制的默认行为参数
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
 * 处理上传错误的重试策略，提供智能重试决策、状态持久化和事件通知
 *
 * 主要功能：
 * 1. 基于错误类型和网络状况的智能重试决策
 * 2. 指数退避算法避免频繁重试
 * 3. 重试状态持久化存储
 * 4. 完整的重试生命周期事件通知
 * 5. 网络状态监测和自动恢复
 *
 * 工作流程：
 * 1. 接收错误 -> 2. 决策是否重试 -> 3. 计算延迟时间 ->
 * 4. 安排重试任务 -> 5. 执行重试 -> 6. 处理结果
 */
export class DefaultRetryManager implements IRetryManager {
  /**
   * 重试配置
   * 控制重试行为的参数集合
   */
  private config: IRetryConfig;

  /**
   * 网络检测器
   * 用于监控网络状态变化和评估网络质量
   */
  private networkDetector: NetworkDetector;

  /**
   * 事件发射器
   * 用于发送重试生命周期事件
   */
  private eventEmitter: EventEmitter;

  /**
   * 存储管理器
   * 用于持久化存储重试状态
   */
  private storageManager?: StorageManager;

  /**
   * 重试历史记录
   * 用于跟踪每个文件的重试成功/失败次数和网络状况
   *
   * 键: 文件ID
   * 值: 包含成功次数、失败次数、最后重试时间和网络状况记录的对象
   */
  private retryHistory: Map<
    string,
    {
      successCount: number;
      failCount: number;
      lastRetryTime: number;
      networkConditions: NetworkConditionRecord[];
    }
  > = new Map();

  /**
   * 重试任务队列
   * 存储所有待执行的重试任务
   *
   * 键: 任务ID
   * 值: 重试任务对象
   */
  private retryTasks: Map<string, RetryTask> = new Map();

  /**
   * 重试定时器ID
   * 用于取消计划中的重试任务
   *
   * 键: 任务ID
   * 值: 定时器ID
   */
  private retryTimers: Map<string, number> = new Map();

  /**
   * 是否已初始化
   * 标记重试管理器是否已完成初始化
   */
  private initialized: boolean = false;

  /**
   * 构造函数
   * 初始化重试管理器，设置配置和依赖组件
   *
   * @param options 重试管理器选项，包含配置、网络检测器、事件发射器和存储管理器
   */
  constructor(options: RetryManagerOptions = {}) {
    // 合并默认配置和用户配置
    this.config = {
      ...DEFAULT_RETRY_CONFIG,
      ...options.config,
    };

    // 初始化依赖组件
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
   * 从持久化存储加载重试状态，恢复之前的重试记录
   *
   * @returns Promise<void>
   * @private
   */
  private async initialize(): Promise<void> {
    // 如果已初始化或没有存储管理器，则直接返回
    if (this.initialized || !this.storageManager) {
      this.initialized = true;
      return;
    }

    try {
      // 从存储加载重试状态
      const activeUploads = await this.storageManager.getActiveUploads();

      // 处理每个活动上传的重试状态
      for (const fileId of activeUploads) {
        try {
          const retryState = await this.storageManager.getRetryState(fileId);
          if (retryState) {
            // 恢复重试历史记录
            this.retryHistory.set(fileId, {
              successCount: retryState.successfulRetries || 0,
              failCount: retryState.failedRetries || 0,
              lastRetryTime: retryState.lastRetryTime,
              networkConditions: [], // 网络状况无法持久化，初始化为空数组
            });
          }
        } catch (err) {
          console.warn(`加载文件 ${fileId} 的重试状态失败:`, err);
          // 继续处理其他文件，不中断整个过程
        }
      }

      this.initialized = true;
    } catch (err) {
      console.warn('初始化重试状态失败:', err);
      // 即使初始化失败，也标记为已初始化，避免反复尝试
      this.initialized = true;
    }
  }

  /**
   * 处理网络状态变化
   * 当网络恢复在线时，处理等待中的任务
   *
   * @param network 当前网络状态
   * @private
   */
  private handleNetworkChange(network: NetworkInfo): void {
    // 只在网络恢复在线时处理
    if (network.online) {
      // 网络恢复在线时，处理等待中的任务
      this.processWaitingTasks();
    }
  }

  /**
   * 处理等待中的重试任务
   * 检查所有任务，执行已到执行时间的任务
   *
   * @private
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
   * 处理任务执行的成功和失败情况
   *
   * @param task 重试任务
   * @private
   */
  private async executeTask(task: RetryTask): Promise<void> {
    // 避免重复执行
    if (task.handled) return;

    // 标记任务为已处理，防止重复执行
    task.handled = true;

    try {
      // 执行重试处理函数
      await task.handler();

      // 处理重试成功
      await this.handleRetrySuccess(task.context);
    } catch (err) {
      // 将捕获的通用错误转换为上传错误
      let uploadError: IUploadError;

      if (this.isUploadError(err)) {
        uploadError = err;
      } else {
        // 构造标准上传错误
        uploadError = {
          name: 'RetryError',
          message: err instanceof Error ? err.message : String(err),
          code: ErrorCode.REQUEST_FAILED, // 使用已存在的错误码
          retryable: task.context.retryCount < (this.config.maxRetries || 3),
          cause: err,
          timestamp: Date.now(), // 添加时间戳字段
        };
      }

      // 处理重试失败
      this.handleRetryFailure(
        task.context,
        uploadError,
        task.context.retryCount < (this.config.maxRetries || 3),
      );
    } finally {
      // 清理任务资源
      this.cleanupTask(task.id);
    }
  }

  /**
   * 清理任务资源
   * 移除任务和相关定时器
   *
   * @param taskId 任务ID
   * @private
   */
  private cleanupTask(taskId: string): void {
    // 从任务队列中移除
    this.retryTasks.delete(taskId);

    // 清除定时器
    if (this.retryTimers.has(taskId)) {
      clearTimeout(this.retryTimers.get(taskId));
      this.retryTimers.delete(taskId);
    }
  }

  /**
   * 判断错误是否为上传错误
   * 类型保护函数，用于区分标准Error和IUploadError
   *
   * @param err 任意错误对象
   * @returns 是否为上传错误
   * @private
   */
  private isUploadError(err: any): err is IUploadError {
    return err && typeof err === 'object' && 'code' in err;
  }

  /**
   * 处理错误重试
   * 核心方法，实现错误重试逻辑
   *
   * 流程：
   * 1. 检查重试是否启用
   * 2. 更新重试计数
   * 3. 检查是否可重试
   * 4. 更新重试统计
   * 5. 判断是否应该重试
   * 6. 计算重试延迟
   * 7. 创建并注册重试任务
   * 8. 发送重试开始事件
   * 9. 安排重试执行
   * 10. 保存重试状态
   *
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

    // 验证参数
    if (!error) {
      console.warn('重试失败: 错误对象为空');
      return;
    }

    if (!handler || typeof handler !== 'function') {
      console.warn('重试失败: 处理函数无效');
      this.handleRetryFailure(context, error, false);
      return;
    }

    // 确保上下文中有时间戳
    if (!context.timestamp) {
      context.timestamp = Date.now();
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
      this.executeTask(task).catch(err => {
        console.error('执行重试任务失败:', err);
        // 任务执行失败，但错误已在executeTask中处理
      });
    }, delay);

    this.retryTimers.set(taskId, timerId);

    // 保存重试状态
    await this.saveRetryState(context).catch(err => {
      // 保存状态失败不应该影响重试流程
      console.warn('保存重试状态失败:', err);
    });
  }

  /**
   * 确保已初始化
   * 如果未初始化，等待初始化完成
   *
   * @returns Promise<void>
   * @private
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * 检查错误是否可重试
   * 基于错误类型和retryable标志判断
   *
   * @param error 错误对象
   * @returns 是否可重试
   * @private
   */
  private isRetryable(error: IUploadError): boolean {
    // 优先使用错误对象的retryable标志
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
   * 记录网络状况和重试时间
   *
   * @param context 错误上下文
   * @param _error 错误对象
   * @private
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
   *
   * 智能重试决策算法：
   * 1. 基于历史成功率 - 如果成功率低于20%且尝试次数超过5次，不再重试
   * 2. 基于网络质量 - 如果连续3次网络状况很差，暂停重试
   * 3. 基于时间模式 - 分析重试成功的时间模式，选择最佳重试时机
   *
   * @param context 错误上下文
   * @returns 是否应该重试
   * @private
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
   *
   * 指数退避算法详解：
   * 1. 基本原理：随着重试次数增加，延迟时间呈指数增长
   * 2. 计算公式：delay = baseDelay * (2^retryCount) + jitter
   * 3. 优势：避免同时重试导致的"惊群效应"，给系统恢复的时间
   * 4. 随机抖动：添加随机延迟，避免多个客户端同时重试
   *
   * 指数退避的好处：
   * - 减轻服务器负担：失败后立即重试可能会使已经过载的服务器更加不堪重负
   * - 避免资源浪费：如果问题是暂时性的，等待一段时间后可能会自行解决
   * - 提高成功率：给系统足够的恢复时间，增加后续重试的成功概率
   * - 网络友好：避免在网络拥塞时产生更多流量
   *
   * 例如：
   * - 第1次重试：1000ms * 2^0 + jitter = ~1000ms
   * - 第2次重试：1000ms * 2^1 + jitter = ~2000ms
   * - 第3次重试：1000ms * 2^2 + jitter = ~4000ms
   * - 第4次重试：1000ms * 2^3 + jitter = ~8000ms (受maxDelay限制可能会更小)
   * - 第5次重试：1000ms * 2^4 + jitter = ~16000ms (受maxDelay限制可能会更小)
   *
   * @param retryCount 当前重试次数
   * @returns 延迟时间（毫秒）
   * @private
   */
  private calculateRetryDelay(retryCount: number): number {
    // 获取配置参数，使用默认值作为后备
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
    // 随机抖动范围为基础延迟的0-50%
    const jitter = Math.random() * baseDelay * 0.5;
    delay += jitter;

    // 限制最大延迟
    return Math.min(delay, maxDelay);
  }

  /**
   * 保存重试状态到持久化存储
   * 将当前重试状态保存到存储管理器
   *
   * @param context 错误上下文
   * @returns Promise<void>
   * @private
   */
  private async saveRetryState(context: IErrorContext): Promise<void> {
    // 检查依赖和参数
    if (!this.storageManager || !context.fileId) return;

    const stats = this.retryHistory.get(context.fileId);
    if (!stats) return;

    // 构建重试状态对象
    const retryState: RetryState = {
      fileId: context.fileId,
      retryCount: context.retryCount || 0,
      lastRetryTime: stats.lastRetryTime,
      chunkRetries: context.chunkRetries || {},
      successfulRetries: stats.successCount,
      failedRetries: stats.failCount,
    };

    await this.storageManager.saveRetryState(context.fileId, retryState);
  }

  /**
   * 处理重试成功
   * 更新统计数据并发送成功事件
   *
   * @param context 错误上下文
   * @returns Promise<void>
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
        // 继续执行，不影响主流程
      }
    }
  }

  /**
   * 处理重试失败
   * 更新统计数据并发送失败事件
   *
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
            return this.storageManager!.saveRetryState(fileId, retryState);
          }
          return Promise.resolve();
        })
        .catch(err => {
          console.warn('更新重试状态失败:', err);
          // 错误已处理，不再抛出
        });
    }
  }

  /**
   * 清理资源
   * 取消所有定时器，清空任务队列和历史记录
   *
   * @returns Promise<void>
   */
  async cleanup(): Promise<void> {
    // 清除所有定时器
    this.retryTimers.forEach(timerId => {
      clearTimeout(timerId);
    });

    // 清空所有集合
    this.retryTimers.clear();
    this.retryTasks.clear();
    this.retryHistory.clear();

    // 清理网络检测器
    this.networkDetector.cleanup();
  }
}

/**
 * 创建重试管理器
 * 工厂函数，创建并返回重试管理器实例
 *
 * @param options 重试管理器选项
 * @returns 重试管理器实例
 */
export function createRetryManager(options?: RetryManagerOptions): IRetryManager {
  return new DefaultRetryManager(options);
}
