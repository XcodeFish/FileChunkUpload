/**
 * 重试管理器实现
 * 负责管理上传错误的重试策略，提供丰富的重试机制
 * @packageDocumentation
 */

import { IUploadError, IRetryConfig } from '@file-chunk-uploader/types';

import { CountdownManager, createCountdownManager } from './countdown-manager';
import { NetworkDetector, createNetworkDetector } from './network-detector';
import { ProgressTracker, createProgressTracker } from './progress-tracker';
import { RetryDecisionMaker } from './retry-decision-maker';
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
    this.decisionMaker = new RetryDecisionMaker({
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
          console.info(
            `已恢复文件 ${fileId} 的重试状态，成功次数: ${successfulRetries}, 失败次数: ${failedRetries}`,
          );
        }

        // 清理过期状态
        await this.stateStorage.cleanupExpiredStates();

        console.info(`重试状态初始化完成，共恢复 ${activeStates.length} 个文件的重试状态`);
      } catch (err) {
        console.error('初始化重试状态失败:', err);
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
        this.stateStorage.recordNetworkState(fileId, network).catch(err => {
          console.warn(`记录文件 ${fileId} 的网络状态失败:`, err);
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
   * 根据错误和上下文决定是否重试，如何重试
   * 应用智能重试决策逻辑，包括：
   * 1. 基于历史成功率的智能决策
   * 2. 基于网络质量的重试策略调整
   * 3. 根据错误类型特定的重试策略
   * 4. 自适应重试次数和间隔
   *
   * @param error 上传错误
   * @param context 错误上下文
   * @param handler 重试处理函数
   */
  async retry(
    error: IUploadError,
    context: ExtendedErrorContext,
    handler: () => Promise<void>,
  ): Promise<void> {
    // 确保初始化完成
    await this.ensureInitialized();

    // 如果重试功能未启用，直接抛出错误
    if (!this.config.enabled) {
      throw error;
    }

    // 确保上下文有fileId
    if (!context.fileId) {
      context.fileId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    // 获取当前网络状态
    const currentNetwork = this.networkDetector.getCurrentNetwork();

    // 记录网络状态
    this.recordNetworkState(currentNetwork);

    // 更新重试决策器的统计信息
    this.decisionMaker.updateRetryStats(context, error);

    // 如果提供了增强的状态存储，记录网络状态
    if (this.stateStorage) {
      try {
        await this.stateStorage.recordNetworkState(context.fileId, currentNetwork);
      } catch (err) {
        console.warn(`记录文件 ${context.fileId} 的网络状态失败:`, err);
      }
    }

    // 确保重试次数在上下文中
    if (context.retryCount === undefined) {
      context.retryCount = 0;
    } else {
      context.retryCount++;
    }

    // 确保分片重试记录在上下文中
    if (!context.chunkRetries) {
      context.chunkRetries = {};
    }

    // 如果指定了分片索引，更新该分片的重试次数
    if (context.chunkIndex !== undefined) {
      const chunkIndex = context.chunkIndex;
      context.chunkRetries[chunkIndex] = (context.chunkRetries[chunkIndex] || 0) + 1;
    }

    // 记录开始时间和最后错误
    context.startTime = context.startTime || Date.now();
    context.lastError = error;

    // 保存重试状态
    await this.saveRetryState(context);

    // 使用决策器决定是否应该重试
    if (!this.decisionMaker.shouldRetry(context, error)) {
      // 增强的决策器决定不再重试，发送重试失败事件
      const maxRetries = this.config.maxRetries || 3;
      this.eventManager.emitRetryFailed(
        context,
        error,
        false,
        this.getFailCount(context.fileId),
        maxRetries,
      );

      // 如果提供了增强的状态存储，记录失败
      if (this.stateStorage) {
        try {
          await this.stateStorage.recordFailure(
            context.fileId,
            error.message,
            error.code || 'unknown_error',
          );
        } catch (err) {
          console.warn(`记录文件 ${context.fileId} 的重试失败失败:`, err);
        }
      }

      throw error;
    }

    // 检查是否超过基本最大重试次数
    const maxRetries = this.config.maxRetries || 3;
    if (context.retryCount >= maxRetries) {
      // 发送重试失败事件
      this.eventManager.emitRetryFailed(
        context,
        error,
        false,
        this.getFailCount(context.fileId),
        maxRetries,
      );

      // 如果提供了增强的状态存储，记录失败
      if (this.stateStorage) {
        try {
          await this.stateStorage.recordFailure(
            context.fileId,
            error.message,
            error.code || 'unknown_error',
          );
        } catch (err) {
          console.warn(`记录文件 ${context.fileId} 的重试失败失败:`, err);
        }
      }

      throw error;
    }

    // 计算延迟时间
    const delay = this.calculateDelay(context.retryCount);

    // 创建重试任务ID
    const taskId = `retry_${context.fileId}_${context.retryCount}_${Date.now()}`;

    // 发送重试开始事件
    this.eventManager.emitRetryStart(context, error, taskId, delay);

    // 处理倒计时
    this.handleRetryCountdown(taskId, context.fileId, context.chunkIndex, delay);

    // 执行重试任务
    return new Promise((resolve, reject) => {
      setTimeout(async () => {
        try {
          await handler();
          // 重试成功
          await this.handleRetrySuccess(context);
          resolve();
        } catch (retryError) {
          // 重试失败
          if (this.isUploadError(retryError)) {
            // 递归调用retry
            try {
              await this.retry(retryError, context, handler);
              resolve();
            } catch (finalError) {
              reject(finalError);
            }
          } else {
            // 非上传错误，直接拒绝
            reject(retryError);
          }
        }
      }, delay);
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
        console.warn(`保存文件 ${context.fileId} 的重试状态失败:`, err);

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
   * 获取成功计数
   * @param fileId 文件ID
   * @returns 成功计数
   */
  private getSuccessCount(fileId: string): number {
    return this.retryHistory.get(fileId)?.successCount || 0;
  }

  /**
   * 获取失败次数
   * @param fileId 文件ID
   * @returns 失败次数
   * @private
   */
  private getFailCount(fileId: string): number {
    // 使用决策器的方法获取失败次数
    return this.decisionMaker.getFailCount(fileId);
  }

  /**
   * 处理重试成功
   * 更新成功计数，发送成功事件
   * 使用智能决策器记录成功
   *
   * @param context 错误上下文
   * @returns Promise<void>
   */
  async handleRetrySuccess(context: ExtendedErrorContext): Promise<void> {
    await this.ensureInitialized();

    const fileId = context.fileId;
    if (!fileId) return;

    // 更新智能决策器中的成功记录
    await this.decisionMaker.handleRetrySuccess(context);

    // 使用增强的状态存储记录成功
    if (this.stateStorage) {
      try {
        await this.stateStorage.recordSuccess(fileId);
      } catch (err) {
        console.warn(`记录文件 ${fileId} 的重试成功失败:`, err);
      }
    }

    // 发送重试成功事件
    this.eventManager.emitRetrySuccess(context, this.getSuccessCount(fileId));
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
      this.stateStorage.recordFailure(fileId, error.message, error.code).catch(err => {
        console.warn(`记录文件 ${fileId} 的重试失败失败:`, err);
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
   * 根据重试次数和配置计算下一次重试的延迟时间
   *
   * @param retryCount 当前重试次数
   * @param error 错误对象（可选）
   * @returns 延迟时间（毫秒）
   */
  private calculateDelay(retryCount: number, error?: IUploadError): number {
    // 使用决策器的增强型智能重试延迟计算
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
