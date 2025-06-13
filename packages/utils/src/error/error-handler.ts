/**
 * 错误处理工具
 * 提供错误处理和转换功能
 * @module utils/error
 */
import { ErrorCode, ILogger, IUploadError } from '@file-chunk-uploader/types';

/**
 * 类型守卫：检查对象是否为上传错误
 * @param error 待检查的错误对象
 * @returns 是否为上传错误
 */
export function isUploadError(error: any): error is IUploadError {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.message === 'string'
  );
}

/**
 * 创建标准上传错误对象
 * @param error 原始错误
 * @returns 标准上传错误
 */
export function createUploadError(error: any): IUploadError {
  // 使用类型守卫函数判断
  if (isUploadError(error)) {
    return error;
  }

  const uploadError = new Error(error?.message || '上传失败') as IUploadError;
  uploadError.code = ErrorCode.UNKNOWN_ERROR;
  uploadError.message = error?.message || '上传失败';
  uploadError.retryable = true;
  uploadError.originalError = error;
  uploadError.timestamp = Date.now();

  return uploadError;
}

/**
 * 创建取消上传错误
 * @returns 取消上传错误
 */
export function createCancelError(): IUploadError {
  const error = new Error('上传已取消') as IUploadError;
  error.code = ErrorCode.OPERATION_CANCELED;
  error.message = '上传已取消';
  error.retryable = false;
  error.timestamp = Date.now();

  return error;
}

/**
 * 创建暂停上传错误
 * @returns 暂停上传错误
 */
export function createPauseError(): IUploadError {
  const error = new Error('上传已暂停') as IUploadError;
  error.code = 'upload_paused';
  error.message = '上传已暂停';
  error.retryable = true;
  error.timestamp = Date.now();

  return error;
}

/**
 * 创建网络错误
 * @param message 错误消息
 * @returns 网络错误
 */
export function createNetworkError(message: string = '网络错误'): IUploadError {
  const error = new Error(message) as IUploadError;
  error.code = ErrorCode.NETWORK_ERROR;
  error.message = message;
  error.retryable = true;
  error.timestamp = Date.now();

  return error;
}

/**
 * 创建服务器错误
 * @param statusCode HTTP状态码
 * @param message 错误消息
 * @returns 服务器错误
 */
export function createServerError(
  statusCode: number,
  message: string = '服务器错误',
): IUploadError {
  const error = new Error(`${message} (${statusCode})`) as IUploadError;
  error.code = ErrorCode.SERVER_ERROR;
  error.message = `${message} (${statusCode})`;
  error.retryable = statusCode >= 500; // 5xx错误通常是可重试的
  error.timestamp = Date.now();
  error.details = { statusCode };

  return error;
}

/**
 * 错误处理类
 * 提供统一的错误处理和转换功能
 */
export class ErrorHandler {
  /**
   * 构造函数
   * @param logger 日志记录器
   */
  constructor(private readonly logger?: ILogger) {}

  /**
   * 创建标准上传错误对象
   * @param error 原始错误
   * @returns 标准上传错误
   */
  public createUploadError(error: any): IUploadError {
    const uploadError = createUploadError(error);
    this.logError('创建上传错误', uploadError);
    return uploadError;
  }

  /**
   * 创建取消上传错误
   * @returns 取消上传错误
   */
  public createCancelError(): IUploadError {
    const cancelError = createCancelError();
    this.logError('上传已取消', cancelError);
    return cancelError;
  }

  /**
   * 创建暂停上传错误
   * @returns 暂停上传错误
   */
  public createPauseError(): IUploadError {
    const pauseError = createPauseError();
    this.logError('上传已暂停', pauseError);
    return pauseError;
  }

  /**
   * 创建网络错误
   * @param message 错误消息
   * @returns 网络错误
   */
  public createNetworkError(message: string = '网络错误'): IUploadError {
    const networkError = createNetworkError(message);
    this.logError(message, networkError);
    return networkError;
  }

  /**
   * 创建服务器错误
   * @param statusCode HTTP状态码
   * @param message 错误消息
   * @returns 服务器错误
   */
  public createServerError(statusCode: number, message: string = '服务器错误'): IUploadError {
    const serverError = createServerError(statusCode, message);
    this.logError(`服务器错误 (${statusCode}): ${message}`, serverError);
    return serverError;
  }

  /**
   * 处理错误
   * @param error 错误对象
   * @param context 错误上下文
   * @returns 标准化的上传错误
   */
  public handleError(error: any, context?: string): IUploadError {
    const uploadError = this.createUploadError(error);
    const contextMsg = context ? `[${context}] ` : '';
    this.logError(`${contextMsg}${uploadError.message}`, uploadError);
    return uploadError;
  }

  /**
   * 记录错误日志
   * @param message 错误消息
   * @param error 错误对象
   */
  private logError(message: string, error: IUploadError): void {
    if (this.logger?.error) {
      this.logger.error('error', message, error);
    }
  }
}
