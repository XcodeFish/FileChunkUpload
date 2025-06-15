/**
 * 重试管理器实现
 * 负责管理上传错误的重试策略，提供丰富的重试机制
 * @packageDocumentation
 */

import { IUploadError, IRetryConfig } from '@file-chunk-uploader/types';

import { CountdownManager, createCountdownManager } from './countdown-manager';
import { NetworkDetector, createNetworkDetector } from './network-detector';
import { ProgressTracker, createProgressTracker } from './progress-tracker';
import { RetryDecisionMaker, createRetryDecisionMaker } from './retry-decision';
import { RetryEventManager, createRetryEventManager } from './retry-events';
import { RetryStateManager, createRetryStateManager } from './retry-state';
import { RetryStateStorage, createRetryStateStorage } from './retry-state-storage';
import { RetryTaskManager } from './retry-task';
import {
  RetryManager as IRetryManager,
  EventEmitter,
  StorageManager,
  RetryManagerOptions,
  ExtendedErrorContext,
  NetworkInfo,
  NetworkConditionRecord,
  RetryState,
  RetryCountdownInfo,
} from './retry-types';

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
   * 重试状态存储
   */
  private stateStorage?: RetryStateStorage;

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
    this.config = options.config || {
      enabled: true,
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      useExponentialBackoff: true,
    };

    this.networkDetector = options.networkDetector || createNetworkDetector();
    this.eventEmitter = options.eventEmitter || {
      emit: () => {
        /* 空实现 */
      },
    };
    this.storageManager = options.storageManager;
    this.countdownManager = options.countdownManager || createCountdownManager();
    this.progressTracker = options.progressTracker || createProgressTracker();
    this.stateManager = createRetryStateManager(this.storageManager);

    // 初始化决策器
    this.decisionMaker = createRetryDecisionMaker({
      config: this.config,
      networkDetector: this.networkDetector,
    });

    // 初始化任务管理器
    this.taskManager = new RetryTaskManager({
      countdownManager: this.countdownManager,
      progressTracker: this.progressTracker,
      decisionMaker: this.decisionMaker,
    });

    this.eventManager = createRetryEventManager(this.eventEmitter);

    // 初始化增强的状态存储
    if (this.storageManager && this.config.persistRetryState) {
      this.stateStorage = createRetryStateStorage({
        storageManager: this.storageManager,
        enableSync: this.config.persistRetryState || false,
      });
    }

    this.initialize();
  }

  /**
   * 初始化重试管理器
   * 加载重试状态，设置事件监听器
   */
  private async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // 初始化网络检测器
    this.networkDetector.onNetworkChange(network => {
      this.handleNetworkChange(network);
    });

    // 初始化增强的状态存储
    if (this.storageManager && this.stateStorage) {
      try {
        // 加载所有活动状态
        const activeStates = await this.stateStorage.getAllActiveStates();

        // 恢复重试历史记录
        for (const state of activeStates) {
          const { fileId, successfulRetries, failedRetries, lastRetryTime, networkHistory } = state;

          // 恢复重试历史统计
          this.retryHistory.set(fileId, {
            successCount: successfulRetries,
            failCount: failedRetries,
            lastRetryTime,
            networkConditions:
              networkHistory?.map(entry => ({
                time: entry.timestamp,
                online: entry.network.online,
                type: entry.network.type || 'unknown',
                speed: entry.network.speed || 0,
                rtt: entry.network.rtt || 0,
              })) || [],
          });

          // 记录恢复的状态信息
          // 使用 logger 或者移除 console.info
          // console.info(
          //   `已恢复文件 ${fileId} 的重试状态，成功次数: ${successfulRetries}, 失败次数: ${failedRetries}`,
          // );
        }

        // 清理过期状态
        await this.stateStorage.cleanupExpiredStates();

        // console.info(`重试状态初始化完成，共恢复 ${activeStates.length} 个文件的重试状态`);
      } catch (err) {
        // console.error('初始化重试状态失败:', err);
        // 错误处理但不输出到控制台
      }
    }

    this.initialized = true;
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

    // 记录网络状态到重试历史记录
    this.recordNetworkState(network);

    // 只在网络恢复在线时处理
    if (network.online) {
      // 网络恢复在线时，处理等待中的任务
      this.taskManager.processWaitingTasks();
    }
  }

  /**
   * 记录网络状态到重试历史记录
   * @param network 当前网络状态
   */
  private recordNetworkState(network: NetworkInfo): void {
    // 如果没有启用增强状态存储，则跳过
    if (!this.stateStorage) return;

    // 获取所有活动的重试任务
    const activeTasks = this.taskManager.getActiveTasks();

    // 为每个活动任务记录网络状态
    for (const task of activeTasks) {
      const fileId = task.fileId;
      if (fileId) {
        this.stateStorage.recordNetworkState(fileId, network).catch(_err => {
          // console.warn(`记录文件 ${fileId} 的网络状态失败:`, _err);
        });
      }
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
   * @param error 上传错误
   * @param context 错误上下文
   * @param handler 重试处理函数
   */
  async retry(
    error: IUploadError,
    context: ExtendedErrorContext,
    handler: () => Promise<void>,
  ): Promise<void> {
    try {
      await this.ensureInitialized();
      if (!this.config.enabled) {
        console.warn('重试管理器已禁用，不会执行重试');
        return;
      }

      const fileId = context.fileId || 'unknown';
      const { retryCount = 0 } = context;
      const maxRetries = this.config.maxRetries || 3; // 设置默认值为3

      // 检查重试次数是否达到上限
      if (retryCount >= maxRetries) {
        this.eventEmitter.emit('retry:max_retries', {
          fileId,
          error,
          retryCount,
        });

        // 触发最终失败事件
        this.eventEmitter.emit('retry:failed', {
          fileId,
          error,
          reason: `达到最大重试次数 (${maxRetries})`,
        });

        this.handleRetryFailure(context, error, false);
        return;
      }

      // 更新重试统计
      this.updateRetryStats(context, error);

      // 计算延迟时间
      const delay = this.calculateDelay(retryCount, error);

      // 生成唯一任务ID
      const taskId = `${fileId}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      // 发布重试开始事件
      this.eventEmitter.emit('retry:scheduled', {
        fileId,
        taskId,
        delay,
        retryCount: retryCount + 1,
        error,
      });

      // 为了保持向后兼容，也发出旧的事件名称
      this.eventEmitter.emit('retry:start', {
        fileId,
        taskId,
        delay,
        retryCount: retryCount + 1,
        error,
      });

      // 如果配置了存储状态，保存当前重试状态
      await this.saveRetryState(context);

      // 处理重试倒计时
      this.handleRetryCountdown(taskId, fileId, context.chunkIndex, delay);

      // 安排延迟任务
      setTimeout(async () => {
        try {
          // 再次检查重试是否启用，以应对在延迟期间可能发生的配置变更
          if (!this.config.enabled) {
            console.warn('重试已在延迟期间被禁用，取消重试');
            return;
          }

          // 发布重试执行事件
          this.eventEmitter.emit('retry:executing', {
            fileId,
            taskId,
            retryCount: retryCount + 1,
            error,
          });

          // 执行重试处理函数
          await handler();

          // 重试成功，发布成功事件
          this.eventEmitter.emit('retry:success', {
            fileId,
            taskId,
            retryCount: retryCount + 1,
          });

          await this.handleRetrySuccess(context);
        } catch (err) {
          // 捕获并处理错误，确保类型安全
          const retryError = err as Error;

          // 重试失败，发布失败事件
          const isUploadError = this.isUploadError(retryError);

          // 确保错误是IUploadError类型
          const errorToEmit: IUploadError = isUploadError
            ? (retryError as IUploadError)
            : {
                ...error,
                message: retryError.message || error.message,
                name: retryError.name || error.name,
              };

          // 确定错误是否可恢复
          const recoverable = isUploadError
            ? (retryError as IUploadError).retryable !== false
            : error.retryable !== false;

          // 检查已重试次数与最大重试次数
          const nextRetryCount = retryCount + 1;
          const reachedMaxRetries = nextRetryCount >= maxRetries;

          if (reachedMaxRetries) {
            // 达到最大重试次数，发出最终失败事件
            this.eventEmitter.emit('retry:failed', {
              fileId,
              error: errorToEmit,
              reason: `达到最大重试次数 (${maxRetries})`,
            });

            this.handleRetryFailure(context, errorToEmit, false);
          } else if (recoverable) {
            // 还可以继续重试
            console.warn(
              `重试失败，但仍可恢复。将安排下一次重试 (${nextRetryCount + 1}/${maxRetries})`,
              retryError,
            );

            // 递归尝试下一次重试，增加重试计数
            await this.retry(
              errorToEmit,
              {
                ...context,
                retryCount: nextRetryCount,
                lastError: errorToEmit,
                startTime: context.startTime || Date.now(),
              },
              handler,
            );
          } else {
            // 错误不可恢复，发出最终失败事件
            this.eventEmitter.emit('retry:failed', {
              fileId,
              error: errorToEmit,
              reason: '重试失败且不可恢复',
            });

            this.handleRetryFailure(context, errorToEmit, false);
          }
        }
      }, delay);
    } catch (err) {
      console.error('在重试过程中发生意外错误:', err);
      this.eventEmitter.emit('retry:error', {
        error: err,
        originalError: error,
        context,
      });
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
   * 该方法已被弃用，改用 decisionMaker.updateRetryStats
   *
   * @deprecated 使用 decisionMaker.updateRetryStats 替代
   * @param context 错误上下文
   * @param _error 错误对象
   * @private
   */
  private updateRetryStats(context: ExtendedErrorContext, _error: IUploadError): void {
    // 调用决策器的统计更新方法
    this.decisionMaker.updateRetryStats(context, _error);
  }

  /**
   * 保存重试状态
   * 使用增强的状态存储功能保存重试状态
   *
   * @param context 错误上下文
   * @returns Promise<void>
   */
  private async saveRetryState(context: ExtendedErrorContext): Promise<void> {
    // 如果没有文件ID或未启用状态存储，则跳过
    if (!context.fileId) return;

    // 尝试使用增强的状态存储
    if (this.stateStorage) {
      const retryState = {
        fileId: context.fileId,
        retryCount: context.retryCount || 0,
        lastRetryTime: Date.now(),
        chunkRetries: context.chunkRetries || {},
        successfulRetries: this.getSuccessCount(context.fileId),
        failedRetries: this.getFailCount(context.fileId),
      };

      try {
        await this.stateStorage.saveState(context.fileId, retryState);
      } catch (err) {
        // console.warn(`保存文件 ${context.fileId} 的重试状态失败:`, err);

        // 回退到基本状态管理器
        await this.stateManager.saveRetryState(
          context,
          this.getSuccessCount(context.fileId),
          this.getFailCount(context.fileId),
        );
      }
    } else {
      // 使用基本状态管理器
      await this.stateManager.saveRetryState(
        context,
        this.getSuccessCount(context.fileId),
        this.getFailCount(context.fileId),
      );
    }
  }

  /**
   * 获取文件的成功重试次数
   * @param fileId 文件ID
   * @returns 成功次数
   */
  private getSuccessCount(fileId: string): number {
    const stats = this.retryHistory.get(fileId);
    return stats?.successCount || 0;
  }

  /**
   * 获取文件的失败重试次数
   * @param fileId 文件ID
   * @returns 失败次数
   */
  private getFailCount(fileId: string): number {
    const stats = this.retryHistory.get(fileId);
    return stats?.failCount || 0;
  }

  /**
   * 处理重试成功
   * 记录成功统计，清理资源，发送成功事件
   * @param context 错误上下文
   */
  async handleRetrySuccess(context: ExtendedErrorContext): Promise<void> {
    const fileId = context.fileId;
    if (!fileId) {
      return;
    }

    // 更新重试统计
    const retryStats = this.retryHistory.get(fileId) || {
      successCount: 0,
      failCount: 0,
      lastRetryTime: 0,
      networkConditions: [],
    };
    retryStats.successCount += 1;
    retryStats.lastRetryTime = Date.now();
    this.retryHistory.set(fileId, retryStats);

    // 更新成功统计
    this.decisionMaker.updateRetrySuccessStats(context);

    // 异步持久化状态
    if (this.stateStorage) {
      try {
        await this.stateStorage.recordSuccess(fileId);
      } catch (err) {
        // console.warn(`保存文件 ${fileId} 的重试状态失败:`, err);
      }
    }

    // 发送重试成功事件
    this.eventManager.emitRetrySuccess(context, retryStats.successCount);
  }

  /**
   * 处理重试失败
   * 更新失败计数，发送失败事件
   *
   * @param context 错误上下文
   * @param error 上传错误
   * @param _recoverable 是否可恢复
   */
  handleRetryFailure(
    context: ExtendedErrorContext,
    error: IUploadError,
    _recoverable: boolean,
  ): void {
    const fileId = context.fileId;
    if (!fileId) return;

    // 更新重试历史记录
    const stats = this.retryHistory.get(fileId) || {
      successCount: 0,
      failCount: 0,
      lastRetryTime: Date.now(),
      networkConditions: [],
    };

    stats.failCount += 1;
    this.retryHistory.set(fileId, stats);

    // 使用增强的状态存储记录失败
    if (this.stateStorage) {
      this.stateStorage.recordFailure(fileId, error.message, error.code).catch(_err => {
        // console.warn(`记录文件 ${fileId} 的重试失败失败:`, _err);
      });
    }

    // 发送重试失败事件
    this.eventManager.emitRetryFailed(
      context,
      error,
      false,
      this.getFailCount(fileId),
      this.config.maxRetries,
    );
  }

  /**
   * 处理重试倒计时
   * 创建倒计时并设置进度回调
   *
   * @param taskId 任务ID
   * @param fileId 文件ID
   * @param chunkIndex 分片索引
   * @param delay 延迟时间（毫秒）
   */
  private handleRetryCountdown(
    taskId: string,
    fileId?: string,
    chunkIndex?: number,
    delay?: number,
  ): void {
    if (!delay) return;

    // 创建倒计时
    const countdownInfo = this.countdownManager.createCountdown(
      taskId,
      delay,
      (info: RetryCountdownInfo) => {
        // 发送倒计时进度事件
        this.eventEmitter.emit('retry:countdown', {
          taskId,
          fileId,
          chunkIndex,
          remainingTime: info.remainingTime,
          totalDelay: info.totalDelay,
          progressPercentage: info.progressPercentage,
        });
      },
    );

    // 发送倒计时事件
    this.eventManager.emitRetryCountdown(taskId, fileId, chunkIndex, countdownInfo);
  }

  /**
   * 计算重试延迟时间
   * 使用指数退避算法或线性增长算法计算下次重试的延迟时间
   * @param retryCount 当前重试次数
   * @param error 上传错误（可选）
   * @returns 延迟时间（毫秒）
   */
  private calculateDelay(retryCount: number, error?: IUploadError): number {
    return this.decisionMaker.calculateRetryDelay(retryCount, error);
  }

  /**
   * 获取重试配置
   * @returns 重试配置
   */
  getConfig(): IRetryConfig {
    return { ...this.config };
  }

  /**
   * 更新重试配置
   * @param config 重试配置
   */
  updateConfig(config: Partial<IRetryConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取重试状态
   * @param fileId 文件ID
   * @returns 重试状态
   */
  async getRetryState(fileId: string): Promise<RetryState | null> {
    if (this.stateStorage) {
      return this.stateStorage.loadState(fileId);
    }
    return null;
  }

  /**
   * 清理资源
   * @returns Promise<void>
   */
  async cleanup(): Promise<void> {
    this.networkDetector.cleanup();
    this.countdownManager.cleanup();
    this.taskManager.cleanup();
    this.decisionMaker.cleanup();

    // 如果存在状态存储，也需要清理
    if (this.stateStorage && typeof (this.stateStorage as any).cleanup === 'function') {
      (this.stateStorage as any).cleanup();
    }

    this.initialized = false;
  }

  /**
   * 等待网络连接恢复后重试
   * 当网络断开时，等待网络重新连接后再执行重试
   *
   * @param error 上传错误
   * @param context 错误上下文
   * @param handler 重试处理函数
   */
  async waitForConnection(
    error: IUploadError,
    context: ExtendedErrorContext,
    handler: () => Promise<void>,
  ): Promise<void> {
    // 确保初始化完成
    await this.ensureInitialized();

    // 获取当前网络状态
    const currentNetwork = this.networkDetector.getCurrentNetwork();

    // 记录网络状态
    if (this.stateStorage && context.fileId) {
      try {
        await this.stateStorage.recordNetworkState(context.fileId, currentNetwork);
      } catch (_err) {
        // 记录失败不影响主流程
      }
    }

    // 发送等待事件
    this.eventManager.emitWaitingEvent({
      fileId: context.fileId,
      chunkIndex: context.chunkIndex,
      error,
      network: currentNetwork,
      retryCount: context.retryCount,
    });

    // 如果当前已在线，直接执行重试
    if (currentNetwork.online) {
      return this.retry(error, context, handler);
    }

    // 等待网络恢复
    const unsubscribe = this.networkDetector.onNetworkChange(network => {
      if (network.online) {
        // 网络恢复后，取消监听并执行重试
        unsubscribe();
        this.retry(error, context, handler).catch(_err => {
          // 错误处理
        });
      }
    });

    // 返回，不等待完成
    return Promise.resolve();
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
