/**
 * 重试管理器实现
 */
import { IEventEmitter, Logger } from '@file-chunk-uploader/core';

import { NETWORK_RETRY_LOG_CATEGORY } from '../utils/logger-categories';

import { DEFAULT_RETRY_CONFIG, IRetryConfig } from './retry-config';

/**
 * 重试状态
 */
export enum RetryStatus {
  /** 准备重试 */
  PENDING = 'pending',
  /** 重试中 */
  RETRYING = 'retrying',
  /** 重试成功 */
  SUCCESS = 'success',
  /** 重试失败 */
  FAILED = 'failed',
  /** 重试取消 */
  CANCELLED = 'cancelled',
}

/**
 * 重试事件
 */
export enum RetryEvent {
  /** 重试开始 */
  START = 'retry:start',
  /** 重试成功 */
  SUCCESS = 'retry:success',
  /** 重试失败 */
  FAILED = 'retry:failed',
  /** 重试取消 */
  CANCELLED = 'retry:cancelled',
  /** 重试倒计时 */
  COUNTDOWN = 'retry:countdown',
}

/**
 * 重试管理器
 * 负责处理重试逻辑，包括指数退避算法
 */
export class RetryManager {
  /** 重试配置 */
  private config: IRetryConfig;
  /** 事件发射器 */
  private eventEmitter: IEventEmitter;
  /** 日志记录器 */
  private logger?: Logger;
  /** 当前重试次数 */
  private retryCount = 0;
  /** 重试状态 */
  private status: RetryStatus = RetryStatus.PENDING;
  /** 重试计时器ID */
  private retryTimerId?: number;
  /** 重试请求ID */
  private requestId: string;

  /**
   * 构造函数
   * @param requestId 请求ID
   * @param config 重试配置
   * @param eventEmitter 事件发射器
   * @param logger 日志记录器
   */
  constructor(
    requestId: string,
    config: Partial<IRetryConfig> = {},
    eventEmitter: IEventEmitter,
    logger?: Logger,
  ) {
    this.requestId = requestId;
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
    this.eventEmitter = eventEmitter;
    this.logger = logger;
  }

  /**
   * 检查是否应该重试
   * @param error 错误对象
   * @returns 是否应该重试
   */
  shouldRetry(error: Error): boolean {
    // 如果已经达到最大重试次数，不再重试
    if (this.retryCount >= this.config.maxRetries) {
      this.logger?.debug(
        NETWORK_RETRY_LOG_CATEGORY,
        `[${this.requestId}] 达到最大重试次数 ${this.config.maxRetries}，不再重试`,
      );
      return false;
    }

    // 检查自定义重试条件
    if (this.config.retryCondition && !this.config.retryCondition(error)) {
      this.logger?.debug(
        NETWORK_RETRY_LOG_CATEGORY,
        `[${this.requestId}] 自定义重试条件不满足，不再重试`,
      );
      return false;
    }

    // 检查错误类型
    const errorName = error.name || error.constructor.name;
    if (this.config.retryErrorTypes.includes(errorName)) {
      this.logger?.debug(
        NETWORK_RETRY_LOG_CATEGORY,
        `[${this.requestId}] 错误类型 ${errorName} 符合重试条件`,
      );
      return true;
    }

    // 检查HTTP状态码（如果错误对象中包含状态码）
    const statusCode = (error as any).status || (error as any).statusCode;
    if (statusCode && this.config.retryStatusCodes.includes(statusCode)) {
      this.logger?.debug(
        NETWORK_RETRY_LOG_CATEGORY,
        `[${this.requestId}] 状态码 ${statusCode} 符合重试条件`,
      );
      return true;
    }

    this.logger?.debug(
      NETWORK_RETRY_LOG_CATEGORY,
      `[${this.requestId}] 不满足任何重试条件，不再重试`,
    );
    return false;
  }

  /**
   * 计算下一次重试延迟时间
   * @returns 延迟时间(毫秒)
   */
  private calculateDelay(): number {
    // 使用指数退避算法计算延迟时间
    let delay = this.config.initialDelayMs * Math.pow(this.config.backoffFactor, this.retryCount);

    // 确保不超过最大延迟时间
    delay = Math.min(delay, this.config.maxDelayMs);

    // 添加随机抖动（±25%）
    if (this.config.jitter) {
      const jitterFactor = 0.5 + Math.random();
      delay = Math.floor(delay * jitterFactor);
    }

    this.logger?.debug(
      NETWORK_RETRY_LOG_CATEGORY,
      `[${this.requestId}] 计算重试延迟: ${delay}ms (第${this.retryCount + 1}次重试)`,
    );
    return delay;
  }

  /**
   * 开始重试
   * @param retryCallback 重试回调函数
   * @returns Promise，解析为重试是否成功
   */
  async retry(retryCallback: () => Promise<void>): Promise<boolean> {
    if (this.status === RetryStatus.RETRYING) {
      this.logger?.warn(NETWORK_RETRY_LOG_CATEGORY, `[${this.requestId}] 重试已在进行中`);
      return false;
    }

    this.retryCount++;
    this.status = RetryStatus.RETRYING;

    // 计算延迟时间
    const delay = this.calculateDelay();

    // 发出重试开始事件
    this.eventEmitter.emit(RetryEvent.START, {
      requestId: this.requestId,
      retryCount: this.retryCount,
      maxRetries: this.config.maxRetries,
      delay,
    });

    this.logger?.info(
      NETWORK_RETRY_LOG_CATEGORY,
      `[${this.requestId}] 开始第 ${this.retryCount} 次重试，延迟 ${delay}ms`,
    );

    // 开始倒计时
    let remainingTime = delay;
    const countdownInterval = setInterval(() => {
      remainingTime -= 1000;
      if (remainingTime <= 0) {
        clearInterval(countdownInterval);
        return;
      }

      this.eventEmitter.emit(RetryEvent.COUNTDOWN, {
        requestId: this.requestId,
        remainingTime,
        totalDelay: delay,
      });

      this.logger?.debug(
        NETWORK_RETRY_LOG_CATEGORY,
        `[${this.requestId}] 重试倒计时: ${remainingTime}ms`,
      );
    }, 1000);

    // 等待延迟时间后执行重试
    return new Promise<boolean>(resolve => {
      this.retryTimerId = setTimeout(async () => {
        try {
          await retryCallback();

          // 重试成功
          this.status = RetryStatus.SUCCESS;
          this.eventEmitter.emit(RetryEvent.SUCCESS, {
            requestId: this.requestId,
            retryCount: this.retryCount,
          });

          this.logger?.info(NETWORK_RETRY_LOG_CATEGORY, `[${this.requestId}] 重试成功`);
          resolve(true);
        } catch (error) {
          // 重试失败
          this.status = RetryStatus.FAILED;
          this.eventEmitter.emit(RetryEvent.FAILED, {
            requestId: this.requestId,
            retryCount: this.retryCount,
            error,
          });

          this.logger?.error(
            NETWORK_RETRY_LOG_CATEGORY,
            `[${this.requestId}] 重试失败: ${(error as Error).message}`,
          );
          resolve(false);
        } finally {
          clearInterval(countdownInterval);
        }
      }, delay) as unknown as number;
    });
  }

  /**
   * 取消重试
   */
  cancel(): void {
    if (this.retryTimerId !== undefined) {
      clearTimeout(this.retryTimerId);
      this.retryTimerId = undefined;
    }

    if (this.status === RetryStatus.RETRYING) {
      this.status = RetryStatus.CANCELLED;
      this.eventEmitter.emit(RetryEvent.CANCELLED, {
        requestId: this.requestId,
        retryCount: this.retryCount,
      });

      this.logger?.info(NETWORK_RETRY_LOG_CATEGORY, `[${this.requestId}] 重试已取消`);
    }
  }

  /**
   * 获取当前重试次数
   * @returns 当前重试次数
   */
  getRetryCount(): number {
    return this.retryCount;
  }

  /**
   * 获取重试状态
   * @returns 重试状态
   */
  getStatus(): RetryStatus {
    return this.status;
  }

  /**
   * 重置重试计数器
   */
  reset(): void {
    this.retryCount = 0;
    this.status = RetryStatus.PENDING;
    this.logger?.debug(NETWORK_RETRY_LOG_CATEGORY, `[${this.requestId}] 重试计数器已重置`);
  }
}
