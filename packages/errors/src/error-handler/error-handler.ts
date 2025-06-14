/**
 * 错误处理器实现
 * 负责处理上传过程中的各种错误，提供错误处理策略和统计功能
 * @packageDocumentation
 */

import {
  IErrorHandler,
  IUploadError,
  IErrorContext,
  IErrorAction,
  IErrorReport,
  ErrorCode,
  ILogger,
  IEventEmitter,
} from '@file-chunk-uploader/types';

/**
 * 错误处理器配置接口
 */
export interface ErrorHandlerConfig {
  /** 最大重试次数 */
  maxRetries: number;
  /** 基础延迟时间（毫秒） */
  baseDelay: number;
  /** 最大延迟时间（毫秒） */
  maxDelay: number;
  /** 是否使用指数退避算法 */
  useExponentialBackoff: boolean;
  /** 错误类型特定的最大重试次数 */
  errorTypeRetries?: {
    /** 网络错误最大重试次数 */
    network?: number;
    /** 服务器错误最大重试次数 */
    server?: number;
    /** 超时错误最大重试次数 */
    timeout?: number;
    /** 未知错误最大重试次数 */
    unknown?: number;
  };
  /** 是否启用详细日志 */
  verbose?: boolean;
  /** 是否发送错误事件通知 */
  notifyOnError?: boolean;
}

/**
 * 错误处理器类
 * 实现IErrorHandler接口，提供错误处理策略
 */
export class ErrorHandler implements IErrorHandler {
  /** 错误处理器配置 */
  private config: ErrorHandlerConfig;
  /** 错误记录 */
  private errorRecords: Array<{
    code: string;
    message: string;
    fileId?: string;
    timestamp: number;
    retried: boolean;
    details?: Record<string, unknown>;
  }> = [];
  /** 日志记录器 */
  private logger?: ILogger;
  /** 事件发射器 */
  private eventEmitter?: IEventEmitter;

  /**
   * 构造函数
   * @param config 错误处理器配置
   * @param logger 日志记录器（可选）
   * @param eventEmitter 事件发射器（可选）
   */
  constructor(
    config: Partial<ErrorHandlerConfig> = {},
    logger?: ILogger,
    eventEmitter?: IEventEmitter,
  ) {
    // 设置默认配置
    this.config = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      useExponentialBackoff: true,
      errorTypeRetries: {
        network: 5,
        server: 3,
        timeout: 3,
        unknown: 1,
      },
      verbose: false,
      notifyOnError: true,
      ...config,
    };

    this.logger = logger;
    this.eventEmitter = eventEmitter;
  }

  /**
   * 处理错误
   * @param error 上传错误
   * @param context 错误上下文
   * @returns 错误处理动作
   */
  handle(error: IUploadError, context: IErrorContext): IErrorAction {
    // 记录错误
    this.recordError(error, context.retryCount > 0);

    // 记录详细错误日志
    this.logError(error, context);

    // 发送错误事件通知
    this.notifyError(error, context);

    // 获取错误类型的最大重试次数
    const maxRetries = this.getMaxRetriesForError(error);

    // 判断是否可重试
    if (error.retryable && context.retryCount < maxRetries) {
      // 计算重试延迟
      const retryDelay = this.calculateRetryDelay(context.retryCount);

      const action: IErrorAction = {
        type: 'retry',
        delay: retryDelay,
        message: `将在${retryDelay / 1000}秒后重试（${context.retryCount + 1}/${maxRetries}）`,
      };

      // 记录重试决策日志
      this.logRetryDecision(error, context, action);

      return action;
    }

    // 特定错误类型的处理策略
    switch (error.code) {
      case ErrorCode.NETWORK_DISCONNECT:
        return {
          type: 'wait_for_connection',
          message: '等待网络连接恢复...',
        };

      case ErrorCode.SERVER_OVERLOAD:
        // 服务器过载情况下，即使超过最大重试次数，也尝试一次延迟更长的重试
        if (context.retryCount <= maxRetries + 1) {
          return {
            type: 'retry',
            delay: 30000, // 30秒特殊延迟
            message: '服务器繁忙，将在30秒后重试',
          };
        }
        break;

      case ErrorCode.QUOTA_EXCEEDED:
        return {
          type: 'fail',
          recoverable: false,
          message: '存储配额已满，无法继续上传',
        };

      case ErrorCode.CHUNK_SIZE_INVALID:
      case ErrorCode.INVALID_CHUNK_SIZE:
        // 尝试调整分片大小
        if (context.chunkSize) {
          const newChunkSize = Math.floor(context.chunkSize / 2);
          if (newChunkSize >= 256 * 1024) {
            // 确保分片大小不小于256KB
            return {
              type: 'adjust_and_retry',
              newChunkSize,
              message: '分片大小调整后重试',
            };
          }
        }
        break;
    }

    // 默认失败处理
    const action: IErrorAction = {
      type: 'fail',
      recoverable: error.retryable,
      message: error.message,
    };

    // 记录失败决策日志
    this.logFailureDecision(error, context, action);

    return action;
  }

  /**
   * 获取错误统计报告
   * @param timeWindow 时间窗口（毫秒），默认为1小时
   * @returns 错误统计报告
   */
  aggregateErrors(timeWindow: number = 3600000): IErrorReport {
    const now = Date.now();
    const relevantErrors = this.errorRecords.filter(e => e.timestamp >= now - timeWindow);

    // 分类统计错误
    const errorTypes: Record<string, number> = {};
    relevantErrors.forEach(error => {
      const code = error.code || 'unknown';
      errorTypes[code] = (errorTypes[code] || 0) + 1;
    });

    return {
      count: relevantErrors.length,
      types: errorTypes,
      details: relevantErrors,
    };
  }

  /**
   * 清除错误记录
   */
  clearErrorRecords(): void {
    this.errorRecords = [];
  }

  /**
   * 获取错误记录
   * @returns 错误记录数组
   */
  getErrorRecords(): Array<{
    code: string;
    message: string;
    fileId?: string;
    timestamp: number;
    retried: boolean;
    details?: Record<string, unknown>;
  }> {
    return [...this.errorRecords];
  }

  /**
   * 设置日志记录器
   * @param logger 日志记录器
   */
  setLogger(logger: ILogger): void {
    this.logger = logger;
  }

  /**
   * 设置事件发射器
   * @param eventEmitter 事件发射器
   */
  setEventEmitter(eventEmitter: IEventEmitter): void {
    this.eventEmitter = eventEmitter;
  }

  /**
   * 记录错误
   * @param error 上传错误
   * @param isRetry 是否是重试
   */
  private recordError(error: IUploadError, isRetry: boolean): void {
    this.errorRecords.push({
      code: error.code,
      message: error.message,
      fileId: error.fileId,
      timestamp: Date.now(),
      retried: isRetry,
      details: error.details,
    });

    // 限制错误记录数量，避免内存泄漏
    if (this.errorRecords.length > 100) {
      this.errorRecords = this.errorRecords.slice(-100);
    }
  }

  /**
   * 记录错误日志
   * @param error 上传错误
   * @param context 错误上下文
   */
  private logError(error: IUploadError, context: IErrorContext): void {
    if (!this.logger) {
      return;
    }

    const logPrefix = context.fileId ? `[文件:${context.fileId}]` : '';
    const chunkInfo = context.chunkIndex !== undefined ? ` [分片:${context.chunkIndex}]` : '';

    if (this.config.verbose) {
      this.logger.error('error', `${logPrefix}${chunkInfo} 错误(${error.code}): ${error.message}`, {
        error: {
          code: error.code,
          message: error.message,
          retryable: error.retryable,
          details: error.details,
        },
        context: {
          fileId: context.fileId,
          chunkIndex: context.chunkIndex,
          retryCount: context.retryCount,
          operation: context.operation,
        },
      });
    } else {
      this.logger.error('error', `${logPrefix}${chunkInfo} 错误(${error.code}): ${error.message}`);
    }
  }

  /**
   * 记录重试决策日志
   * @param error 上传错误
   * @param context 错误上下文
   * @param action 错误处理动作
   */
  private logRetryDecision(
    error: IUploadError,
    context: IErrorContext,
    action: IErrorAction,
  ): void {
    if (!this.logger) {
      return;
    }

    const logPrefix = context.fileId ? `[文件:${context.fileId}]` : '';
    const chunkInfo = context.chunkIndex !== undefined ? ` [分片:${context.chunkIndex}]` : '';

    this.logger.info(
      'retry',
      `${logPrefix}${chunkInfo} 重试决策: ${action.message}`,
      this.config.verbose
        ? {
            error: { code: error.code, message: error.message },
            retryCount: context.retryCount,
            delay: action.delay,
          }
        : undefined,
    );
  }

  /**
   * 记录失败决策日志
   * @param error 上传错误
   * @param context 错误上下文
   * @param action 错误处理动作
   */
  private logFailureDecision(
    error: IUploadError,
    context: IErrorContext,
    action: IErrorAction,
  ): void {
    if (!this.logger) {
      return;
    }

    const logPrefix = context.fileId ? `[文件:${context.fileId}]` : '';
    const chunkInfo = context.chunkIndex !== undefined ? ` [分片:${context.chunkIndex}]` : '';

    this.logger.error(
      'error',
      `${logPrefix}${chunkInfo} 失败决策: ${action.message}`,
      this.config.verbose
        ? {
            error: { code: error.code, message: error.message },
            retryCount: context.retryCount,
            recoverable: action.recoverable,
          }
        : undefined,
    );
  }

  /**
   * 发送错误通知
   * @param error 上传错误
   * @param context 错误上下文
   */
  private notifyError(error: IUploadError, context: IErrorContext): void {
    if (!this.eventEmitter || !this.config.notifyOnError) {
      return;
    }

    // 转换错误和上下文为可序列化对象
    const errorData = {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      fileId: error.fileId,
      chunkIndex: error.chunkIndex,
      details: error.details,
      operation: error.operation,
      timestamp: error.timestamp || Date.now(),
    };

    const contextData = {
      fileId: context.fileId,
      chunkIndex: context.chunkIndex,
      retryCount: context.retryCount,
      operation: context.operation,
      timestamp: context.timestamp,
    };

    this.eventEmitter.emit('error', {
      error: errorData,
      context: contextData,
    });
  }

  /**
   * 计算重试延迟
   * @param retryCount 重试次数
   * @returns 延迟时间（毫秒）
   */
  private calculateRetryDelay(retryCount: number): number {
    if (this.config.useExponentialBackoff) {
      // 使用指数退避算法
      const baseDelay = this.config.baseDelay;
      const maxDelay = this.config.maxDelay;
      const jitter = Math.random() * 1000; // 0-1000ms随机抖动
      const exponentialDelay = baseDelay * Math.pow(2, retryCount);
      return Math.min(exponentialDelay + jitter, maxDelay);
    } else {
      // 使用线性延迟
      const delay = this.config.baseDelay * (retryCount + 1);
      return Math.min(delay, this.config.maxDelay);
    }
  }

  /**
   * 获取错误类型的最大重试次数
   * @param error 上传错误
   * @returns 最大重试次数
   */
  private getMaxRetriesForError(error: IUploadError): number {
    const { errorTypeRetries, maxRetries } = this.config;

    if (!errorTypeRetries) {
      return maxRetries;
    }

    // 根据错误代码确定错误类型
    if (
      error.code.includes('network') ||
      error.code === ErrorCode.NETWORK_ERROR ||
      error.code === ErrorCode.NETWORK_DISCONNECT
    ) {
      return errorTypeRetries.network || maxRetries;
    } else if (
      error.code.includes('server') ||
      error.code === ErrorCode.SERVER_ERROR ||
      error.code === ErrorCode.SERVER_TIMEOUT ||
      error.code === ErrorCode.SERVER_OVERLOAD
    ) {
      return errorTypeRetries.server || maxRetries;
    } else if (error.code.includes('timeout') || error.code === ErrorCode.TIMEOUT) {
      return errorTypeRetries.timeout || maxRetries;
    } else {
      return errorTypeRetries.unknown || maxRetries;
    }
  }
}

/**
 * 创建错误处理器
 * @param config 错误处理器配置
 * @param logger 日志记录器
 * @param eventEmitter 事件发射器
 * @returns 错误处理器实例
 */
export function createErrorHandler(
  config: Partial<ErrorHandlerConfig> = {},
  logger?: ILogger,
  eventEmitter?: IEventEmitter,
): IErrorHandler {
  return new ErrorHandler(config, logger, eventEmitter);
}
