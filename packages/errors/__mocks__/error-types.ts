/**
 * 错误类型模拟
 * 主要用于测试
 */

// 错误代码枚举
export enum RetryErrorCode {
  UNKNOWN_ERROR = 'unknown_error',
  NETWORK_ERROR = 'network_error',
  SERVER_ERROR = 'server_error',
  TIMEOUT_ERROR = 'timeout_error',
  ABORT_ERROR = 'abort_error',
  STORAGE_ERROR = 'storage_error',
  FILE_ERROR = 'file_error',
  CHUNK_ERROR = 'chunk_error',
  INVALID_PARAMETER = 'invalid_parameter',
  AUTH_ERROR = 'auth_error',
  QUOTA_EXCEEDED = 'quota_exceeded',
  NETWORK_DISCONNECT = 'network_disconnect',
  SERVER_OVERLOAD = 'server_overload',
}

// 为了向后兼容，保留 ErrorCode 别名
export const ErrorCode = RetryErrorCode;

// 上传错误类
export class UploadError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly details?: Record<string, any>;

  constructor(
    message: string,
    code: string = RetryErrorCode.UNKNOWN_ERROR,
    options: { retryable?: boolean; details?: Record<string, any> } = {},
  ) {
    super(message);
    this.name = 'UploadError';
    this.code = code;
    this.retryable =
      options.retryable !== undefined ? options.retryable : this.isRetryableByDefault(code);
    this.details = options.details;
  }

  // 根据错误代码判断是否默认可重试
  private isRetryableByDefault(code: string): boolean {
    switch (code) {
      case RetryErrorCode.NETWORK_ERROR:
      case RetryErrorCode.TIMEOUT_ERROR:
      case RetryErrorCode.SERVER_ERROR:
      case RetryErrorCode.SERVER_OVERLOAD:
      case RetryErrorCode.NETWORK_DISCONNECT:
        return true;
      default:
        return false;
    }
  }

  // 静态工厂方法 - 创建网络错误
  static network(message: string, details?: Record<string, any>): UploadError {
    return new UploadError(message, RetryErrorCode.NETWORK_ERROR, { retryable: true, details });
  }

  // 静态工厂方法 - 创建服务器错误
  static server(message: string, status?: number, details?: Record<string, any>): UploadError {
    let code = RetryErrorCode.SERVER_ERROR;
    let retryable = false;

    // 特殊状态码处理
    if (status) {
      if (status >= 500) {
        // 服务器错误
        retryable = true;
      } else if (status === 429) {
        // 请求过多
        code = RetryErrorCode.SERVER_OVERLOAD;
        retryable = true;
      } else if (status === 401 || status === 403) {
        // 认证错误
        code = RetryErrorCode.AUTH_ERROR;
      }
    }

    return new UploadError(message, code, { retryable, details: { ...details, status } });
  }

  // 静态工厂方法 - 创建超时错误
  static timeout(message: string, details?: Record<string, any>): UploadError {
    return new UploadError(message, RetryErrorCode.TIMEOUT_ERROR, { retryable: true, details });
  }

  // 静态工厂方法 - 创建文件错误
  static file(message: string, details?: Record<string, any>): UploadError {
    return new UploadError(message, RetryErrorCode.FILE_ERROR, { retryable: false, details });
  }
}
