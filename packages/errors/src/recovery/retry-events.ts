/**
 * 重试事件管理器
 * 负责事件通知相关逻辑
 * @packageDocumentation
 */

import { IUploadError } from '@file-chunk-uploader/types';

import {
  EventEmitter,
  RetryStartInfo,
  RetrySuccessInfo,
  RetryFailedInfo,
  RetryCountdownInfo,
  RetryProgressInfo,
  ExtendedErrorContext,
  NetworkInfo,
} from './retry-types';

/**
 * 等待网络连接恢复事件信息接口
 */
interface WaitingEventInfo {
  /** 文件ID */
  fileId?: string;
  /** 分片索引 */
  chunkIndex?: number;
  /** 错误对象 */
  error: IUploadError;
  /** 网络信息 */
  network: NetworkInfo;
  /** 重试次数 */
  retryCount: number;
}

/**
 * 重试事件管理器类
 * 处理重试过程中的事件通知
 */
export class RetryEventManager {
  /**
   * 事件发射器
   */
  private eventEmitter: EventEmitter;

  /**
   * 构造函数
   * @param eventEmitter 事件发射器
   */
  constructor(eventEmitter: EventEmitter) {
    this.eventEmitter = eventEmitter || {
      emit: () => {
        /* 空实现 */
      },
    };
  }

  /**
   * 发送重试开始事件
   * @param context 错误上下文
   * @param error 错误对象
   * @param taskId 任务ID
   * @param delay 延迟时间
   * @param progressInfo 进度信息
   * @param countdownInfo 倒计时信息
   */
  emitRetryStart(
    context: ExtendedErrorContext,
    error: any,
    taskId: string,
    delay: number,
    progressInfo?: RetryProgressInfo,
    countdownInfo?: RetryCountdownInfo,
  ): void {
    // 构建重试开始信息
    const retryStartInfo: RetryStartInfo = {
      fileId: context.fileId,
      chunkIndex: context.chunkIndex,
      retryCount: context.retryCount || 0,
      delay,
      error,
      taskId,
      type: 'retry',
      progress: progressInfo,
      countdown: countdownInfo,
      network: {
        currentNetwork: {
          online: navigator.onLine,
          type:
            typeof navigator !== 'undefined' && 'connection' in navigator
              ? (navigator as any).connection?.type || 'unknown'
              : 'unknown',
          speed: 0,
          rtt: 0,
        },
        isRetryRecommended: true,
      },
      strategy: {
        algorithm: 'exponential',
        baseDelay: 1000,
        maxDelay: 30000,
        useJitter: true,
      },
    };

    // 发送事件
    this.eventEmitter.emit('retry:start', retryStartInfo);
  }

  /**
   * 发送等待网络连接恢复事件
   * @param info 等待事件信息
   */
  emitWaitingEvent(info: WaitingEventInfo): void {
    // 发送等待网络连接恢复事件
    this.eventEmitter.emit('retry:waiting', {
      fileId: info.fileId,
      chunkIndex: info.chunkIndex,
      error: info.error,
      network: info.network,
      retryCount: info.retryCount,
      timestamp: Date.now(),
      reason: 'waiting_for_network',
      message: '等待网络连接恢复',
    });
  }

  /**
   * 发送重试成功事件
   * @param context 错误上下文
   * @param successCount 成功次数
   */
  emitRetrySuccess(context: ExtendedErrorContext, successCount: number): void {
    // 构建成功信息
    const successInfo: RetrySuccessInfo = {
      fileId: context.fileId,
      chunkIndex: context.chunkIndex,
      successCount,
      startTimestamp: context.startTime || 0,
      completeTimestamp: Date.now(),
      duration: context.startTime ? Date.now() - context.startTime : undefined,
      network: {
        online: navigator.onLine,
        type:
          typeof navigator !== 'undefined' && 'connection' in navigator
            ? (navigator as any).connection?.type || 'unknown'
            : 'unknown',
        speed: 0,
        rtt: 0,
      },
      history: {
        totalRetries: context.retryCount || 0,
        successfulRetries: successCount,
        successRate: successCount > 0 ? 1 : 0,
      },
    };

    // 发送事件
    this.eventEmitter.emit('retry:success', successInfo);
  }

  /**
   * 发送重试失败事件
   * @param context 错误上下文
   * @param error 错误对象
   * @param recoverable 是否可恢复
   * @param failCount 失败次数
   * @param maxRetries 最大重试次数
   */
  emitRetryFailed(
    context: ExtendedErrorContext,
    error: any,
    recoverable: boolean,
    failCount: number,
    maxRetries: number = 3,
  ): void {
    // 构建失败信息
    const failedInfo: RetryFailedInfo = {
      fileId: context.fileId,
      error,
      recoverable,
      chunkIndex: context.chunkIndex,
      retryCount: context.retryCount,
      maxRetries,
      reason: error.message,
      timestamp: Date.now(),
      suggestedAction: recoverable ? 'manual_retry' : 'cancel',
      history: {
        attempts: (context.retryCount || 0) + 1,
        failures: failCount,
        failureRate: failCount > 0 ? 1 : 0,
      },
      network: {
        online: navigator.onLine,
        type:
          typeof navigator !== 'undefined' && 'connection' in navigator
            ? (navigator as any).connection?.type || 'unknown'
            : 'unknown',
        speed: 0,
        rtt: 0,
      },
    };

    // 发送事件
    this.eventEmitter.emit('retry:failed', failedInfo);
  }

  /**
   * 发送重试倒计时事件
   * @param taskId 任务ID
   * @param fileId 文件ID
   * @param chunkIndex 分片索引
   * @param countdownInfo 倒计时信息
   * @param progressInfo 进度信息
   */
  emitRetryCountdown(
    taskId: string,
    fileId?: string,
    chunkIndex?: number,
    countdownInfo?: RetryCountdownInfo,
    progressInfo?: RetryProgressInfo,
  ): void {
    // 发送事件
    this.eventEmitter.emit('retry:countdown', {
      taskId,
      fileId,
      chunkIndex,
      countdown: countdownInfo,
      progress: progressInfo,
    });
  }

  /**
   * 发送网络状态变化事件
   * @param networkInfo 网络信息
   */
  emitNetworkChange(networkInfo: NetworkInfo): void {
    // 发送事件
    this.eventEmitter.emit('retry:network', {
      online: networkInfo.online,
      type: networkInfo.type || 'unknown', // 使用实际类型，仅当undefined时使用'unknown'作为后备值
      speed: networkInfo.speed || 0,
      rtt: networkInfo.rtt || 0,
      timestamp: Date.now(),
    });
  }
}

/**
 * 创建重试事件管理器
 * @param eventEmitter 事件发射器
 * @returns 重试事件管理器实例
 */
export function createRetryEventManager(eventEmitter: EventEmitter): RetryEventManager {
  return new RetryEventManager(eventEmitter);
}
