/**
 * 重试管理器实现
 * 负责管理上传错误的重试策略，提供丰富的重试机制
 * @packageDocumentation
 */

import { IUploadError, IRetryConfig, ErrorCode } from '@file-chunk-uploader/types';

import { CountdownManager, createCountdownManager } from './countdown-manager';
import { NetworkDetector, createNetworkDetector } from './network-detector';
import { ProgressTracker, createProgressTracker } from './progress-tracker';
import { RetryDecisionMaker } from './retry-decision';
import { RetryEventManager, createRetryEventManager } from './retry-events';
import { RetryStateManager, createRetryStateManager } from './retry-state';
import { RetryTaskManager } from './retry-task';
import {
  RetryManager as IRetryManager,
  EventEmitter,
  StorageManager,
  RetryTask,
  RetryManagerOptions,
  NetworkConditionRecord,
  NetworkInfo,
  ExtendedErrorContext,
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
 * 6. 重试进度和倒计时支持
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
   * 是否已初始化
   * 标记重试管理器是否已完成初始化
   */
  private initialized: boolean = false;

  /**
   * 倒计时管理器
   * 用于管理重试任务的倒计时
   */
  private countdownManager: CountdownManager;

  /**
   * 进度追踪器
   * 用于跟踪重试任务进度
   */
  private progressTracker: ProgressTracker;

  /**
   * 决策器
   * 用于智能重试决策
   */
  private decisionMaker: RetryDecisionMaker;

  /**
   * 任务管理器
   * 用于管理重试任务
   */
  private taskManager: RetryTaskManager;

  /**
   * 状态管理器
   * 用于管理重试状态的持久化
   */
  private stateManager: RetryStateManager;

  /**
   * 事件管理器
   * 用于管理重试事件
   */
  private eventManager: RetryEventManager;

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

    // 初始化倒计时管理器和进度追踪器
    this.countdownManager = options.countdownManager || createCountdownManager();
    this.progressTracker = options.progressTracker || createProgressTracker();

    // 初始化决策器、任务管理器、状态管理器和事件管理器
    this.decisionMaker = new RetryDecisionMaker({
      config: this.config,
      networkDetector: this.networkDetector,
    });

    this.taskManager = new RetryTaskManager({
      countdownManager: this.countdownManager,
      progressTracker: this.progressTracker,
      decisionMaker: this.decisionMaker,
    });

    this.stateManager = createRetryStateManager(this.storageManager);
    this.eventManager = createRetryEventManager(this.eventEmitter);

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
      // 从存储加载所有重试状态
      const states = await this.stateManager.loadAllRetryStates();

      // 恢复重试历史记录
      for (const [fileId, state] of states.entries()) {
        this.retryHistory.set(fileId, {
          successCount: state.successfulRetries || 0,
          failCount: state.failedRetries || 0,
          lastRetryTime: state.lastRetryTime,
          networkConditions: [], // 网络状况无法持久化，初始化为空数组
        });
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
    // 发送网络状态变化事件
    this.eventManager.emitNetworkChange(network);

    // 只在网络恢复在线时处理
    if (network.online) {
      // 网络恢复在线时，处理等待中的任务
      this.taskManager.processWaitingTasks();
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
  private isUploadError(err: unknown): err is IUploadError {
    return !!err && typeof err === 'object' && err !== null && 'code' in err;
  }

  /**
   * 处理重试
   * 根据错误和上下文信息决定是否重试，以及如何重试
   *
   * @param error 错误对象
   * @param context 错误上下文
   * @param handler 重试处理函数
   * @returns Promise<void>
   */
  async retry(
    error: IUploadError,
    context: ExtendedErrorContext,
    handler: () => Promise<void>,
  ): Promise<void> {
    await this.ensureInitialized();

    // 检查是否启用重试
    if (!this.config.enabled || !this.decisionMaker.isRetryable(error)) {
      this.handleRetryFailure(context, error, false);
      return;
    }

    // 初始化或增加重试计数
    if (context.retryCount === undefined) {
      context.retryCount = 0;
    } else {
      context.retryCount++;
    }

    // 检查是否超过最大重试次数
    const maxRetries = this.config.maxRetries ?? DEFAULT_RETRY_CONFIG.maxRetries ?? 3;

    if ((context.retryCount || 0) >= maxRetries) {
      this.handleRetryFailure(context, error, false);
      return;
    }

    // 检查是否应该重试
    if (!this.decisionMaker.shouldRetry(context)) {
      this.handleRetryFailure(context, error, true);
      return;
    }

    // 更新重试统计
    this.updateRetryStats(context, error);

    // 计算延迟时间
    const delay = this.decisionMaker.calculateRetryDelay(context.retryCount || 0);

    // 创建任务ID
    const taskId = `retry_${Date.now()}_${Math.random().toString(36).substring(2)}`;

    // 确保上下文包含时间戳
    if (!context.timestamp) {
      context.timestamp = Date.now();
    }

    // 增加起始时间记录
    if (!context.startTime) {
      context.startTime = Date.now();
    }

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

    // 创建进度信息
    const progressInfo = this.progressTracker.createProgress(
      taskId,
      context.retryCount || 0,
      maxRetries,
      context.chunkIndex,
    );

    // 创建倒计时并设置更新回调
    const countdownInfo = this.countdownManager.createCountdown(taskId, delay, countdownInfo => {
      // 获取任务进度信息
      const progress = this.progressTracker.getProgress(taskId);

      // 发送倒计时事件
      this.eventManager.emitRetryCountdown(
        taskId,
        task.fileId,
        task.chunkIndex,
        countdownInfo,
        progress || undefined,
      );
    });

    // 发送重试开始事件
    this.eventManager.emitRetryStart(context, error, taskId, delay, progressInfo, countdownInfo);

    // 保存重试状态
    await this.saveRetryState(context);

    // 添加任务到任务管理器
    this.taskManager.addTask(task, task => this.executeTask(task));
  }

  /**
   * 执行重试任务
   * 在计算的延迟后执行重试处理函数
   *
   * @param task 重试任务
   * @returns Promise<void>
   * @private
   */
  private async executeTask(task: RetryTask): Promise<void> {
    try {
      // 执行重试处理函数
      await task.handler();

      // 重试成功，处理成功回调
      await this.handleRetrySuccess(task.context as ExtendedErrorContext);
    } catch (err) {
      // 重试失败，检查是否需要再次重试
      if (this.isUploadError(err)) {
        // 增加失败计数
        if (task.context.retryCount) {
          task.context.retryCount++;
        } else {
          task.context.retryCount = 1;
        }

        // 记录最后的错误
        (task.context as ExtendedErrorContext).lastError = err;

        // 更新进度信息
        if (task.fileId) {
          this.progressTracker.markFailed(task.id);
        }

        // 检查是否仍然可以重试
        const maxRetries = this.config.maxRetries ?? DEFAULT_RETRY_CONFIG.maxRetries ?? 3;

        if (
          this.decisionMaker.isRetryable(err) &&
          (task.context.retryCount || 0) < maxRetries &&
          this.decisionMaker.shouldRetry(task.context as ExtendedErrorContext)
        ) {
          // 可以再次重试，递归调用retry方法
          await this.retry(err, task.context as ExtendedErrorContext, task.handler);
        } else {
          // 无法再次重试，调用失败处理
          this.handleRetryFailure(task.context as ExtendedErrorContext, err, false);
        }
      } else {
        // 非上传错误，按原始错误处理
        const uploadError: IUploadError = {
          name: 'RetryError',
          message: err instanceof Error ? err.message : String(err),
          code: ErrorCode.REQUEST_FAILED,
          retryable: false,
          timestamp: Date.now(),
        };
        this.handleRetryFailure(task.context as ExtendedErrorContext, uploadError, false);
      }
    }
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
   * 更新重试统计数据
   * 记录网络状况和重试时间
   *
   * @param context 错误上下文
   * @param _error 错误对象
   * @private
   */
  private updateRetryStats(context: ExtendedErrorContext, _error: IUploadError): void {
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
      type: networkInfo.type || 'unknown',
      speed: networkInfo.speed || 0,
      rtt: networkInfo.rtt || 0,
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
   * 保存重试状态到持久化存储
   * 将当前重试状态保存到存储管理器
   *
   * @param context 错误上下文
   * @returns Promise<void>
   * @private
   */
  private async saveRetryState(context: ExtendedErrorContext): Promise<void> {
    const fileId = context.fileId;
    if (!fileId) return;

    const stats = this.retryHistory.get(fileId);
    if (!stats) return;

    await this.stateManager.saveRetryState(context, stats.successCount, stats.failCount);
  }

  /**
   * 处理重试成功
   * 更新重试成功统计，发送成功事件
   *
   * @param context 错误上下文
   * @returns Promise<void>
   */
  async handleRetrySuccess(context: ExtendedErrorContext): Promise<void> {
    // 更新统计信息
    const fileId = context.fileId;
    if (fileId) {
      // 从重试历史中获取统计信息
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

      // 更新成功计数
      stats.successCount++;
      stats.lastRetryTime = Date.now();

      // 找到对应的重试任务
      const taskId = this.taskManager.findTaskIdByFileId(fileId, context.chunkIndex);

      // 更新任务进度
      if (taskId) {
        // 完成倒计时
        this.countdownManager.completeCountdown(taskId);

        // 更新进度信息
        this.progressTracker.completeTask(taskId, true);
      }

      // 更新持久化存储
      await this.stateManager.updateRetryState(fileId, {
        successfulRetries: stats.successCount,
        lastRetryTime: stats.lastRetryTime,
      });

      // 发送成功事件
      this.eventManager.emitRetrySuccess(context, stats.successCount);
    }
  }

  /**
   * 处理重试失败
   * 更新重试失败统计，发送失败事件
   *
   * @param context 错误上下文
   * @param error 错误对象
   * @param recoverable 是否可恢复
   */
  handleRetryFailure(
    context: ExtendedErrorContext,
    error: IUploadError,
    recoverable: boolean,
  ): void {
    // 更新统计信息
    const fileId = context.fileId;
    if (fileId) {
      // 从重试历史中获取统计信息
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

      // 更新失败计数
      stats.failCount++;
      stats.lastRetryTime = Date.now();

      // 找到对应的重试任务
      const taskId = this.taskManager.findTaskIdByFileId(fileId, context.chunkIndex);

      // 更新任务进度
      if (taskId) {
        // 完成倒计时
        this.countdownManager.completeCountdown(taskId);

        // 更新进度信息
        this.progressTracker.completeTask(taskId, false);
      }

      // 更新持久化存储
      this.stateManager.updateRetryState(fileId, {
        failedRetries: stats.failCount,
        lastRetryTime: stats.lastRetryTime,
      });

      // 发送失败事件
      this.eventManager.emitRetryFailed(
        context,
        error,
        recoverable,
        stats.failCount,
        this.config.maxRetries,
      );
    }
  }

  /**
   * 清理资源
   * 取消所有重试任务，清理资源
   *
   * @returns Promise<void>
   */
  async cleanup(): Promise<void> {
    // 清理任务管理器
    this.taskManager.cleanup();

    // 清理重试历史
    this.retryHistory.clear();

    // 清理倒计时管理器和进度追踪器
    this.countdownManager.cleanup();
    this.progressTracker.clear();

    // 清理网络检测器
    if (this.networkDetector) {
      this.networkDetector.cleanup();
    }
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
