/**
 * 上传错误类实现
 * 处理各种上传过程中的错误情况，支持错误信息本地化和开发者模式
 * @packageDocumentation
 */

import { ErrorCode, IUploadError } from '@file-chunk-uploader/types';

/**
 * 扩展错误代码
 * 定义额外的错误代码，这些代码不在ErrorCode枚举中
 */
const ExtendedErrorCode = {
  RESOURCE_NOT_FOUND: 'resource_not_found',
  RESOURCE_CONFLICT: 'resource_conflict',
  UNSUPPORTED_MEDIA_TYPE: 'unsupported_media_type',
} as const;

/**
 * HTTP状态码处理结果接口
 * @internal
 */
interface HttpStatusCodeResult {
  code: string;
  retryable: boolean;
}

/**
 * 上传错误类
 * 实现IUploadError接口，提供错误处理和本地化功能
 */
export class UploadError extends Error implements IUploadError {
  readonly code: string;
  readonly retryable: boolean;
  readonly details?: Record<string, unknown>;
  readonly fileId?: string;
  readonly chunkIndex?: number;
  readonly originalError?: Error;
  readonly operation?: string;
  readonly timestamp: number;
  handled: boolean;

  /**
   * 构造函数
   * @param message 错误消息
   * @param code 错误代码
   * @param options 错误选项
   */
  constructor(
    message: string,
    code: string | ErrorCode = 'unknown_error',
    options: {
      retryable?: boolean;
      details?: Record<string, unknown>;
      fileId?: string;
      chunkIndex?: number;
      originalError?: Error;
      operation?: string;
      handled?: boolean;
    } = {},
  ) {
    super(message);
    this.name = 'UploadError';
    this.code = code;
    this.details = options.details;
    this.fileId = options.fileId;
    this.chunkIndex = options.chunkIndex;
    this.originalError = options.originalError;
    this.operation = options.operation;
    this.timestamp = Date.now();
    this.handled = options.handled || false;

    // 根据错误代码决定是否可重试
    if (options.retryable !== undefined) {
      this.retryable = options.retryable;
    } else {
      this.retryable = true; // 默认可重试
    }

    // 确保原型链正确
    Object.setPrototypeOf(this, UploadError.prototype);
  }

  /**
   * 判断错误代码是否可重试
   * @param code 错误代码
   * @returns 是否可重试
   */
  private isRetryableErrorCode(code: string | ErrorCode): boolean {
    const retryableCodes = [
      ErrorCode.NETWORK_ERROR,
      ErrorCode.NETWORK_DISCONNECT,
      ErrorCode.SERVER_ERROR,
      ErrorCode.SERVER_TIMEOUT,
      ErrorCode.SERVER_OVERLOAD,
      ErrorCode.TIMEOUT,
      ErrorCode.CHUNK_UPLOAD_FAILED,
      ErrorCode.REQUEST_FAILED,
      'network_error',
      'network_disconnect',
      'server_error',
      'server_timeout',
      'server_overload',
      'timeout',
      'timeout_error',
      'chunk_upload_failed',
      'request_failed',
    ];

    return retryableCodes.includes(code.toLowerCase());
  }

  /**
   * 获取本地化错误消息
   * @param localizer 本地化提供程序函数
   * @returns 本地化的错误消息
   */
  getLocalizedMessage(localizer?: (code: string) => string): string {
    if (localizer) {
      return localizer(this.code) || this.message;
    }
    return this.message;
  }

  /**
   * 获取开发者模式下的详细错误信息
   * @param devMode 是否启用开发者模式
   * @returns 详细错误信息
   */
  getDeveloperMessage(devMode = false): string {
    let message = `${this.message} [${this.code}]`;

    if (devMode && this.originalError) {
      message += `\n原始错误: ${this.originalError.message}`;
      if (this.originalError.stack) {
        message += `\n${this.originalError.stack}`;
      }
    }

    if (devMode && this.details) {
      message += `\n详细信息: ${JSON.stringify(this.details, null, 2)}`;
    }

    return message;
  }

  /**
   * 从HTTP状态码创建错误
   * @param statusCode HTTP状态码
   * @param message 错误消息
   * @param options 其他选项
   * @returns 上传错误实例
   */
  static fromHttpStatus(
    statusCode: number,
    message: string = '请求失败',
    options: {
      fileId?: string;
      chunkIndex?: number;
      details?: Record<string, unknown>;
      originalError?: Error;
    } = {},
  ): UploadError {
    const result = handleHttpStatusCode(statusCode);

    return new UploadError(message, result.code, {
      retryable: result.retryable,
      fileId: options.fileId,
      chunkIndex: options.chunkIndex,
      details: { ...(options.details || {}), statusCode },
      originalError: options.originalError,
    });
  }

  /**
   * 获取开发者模式下的详细错误信息
   * @returns 详细错误信息
   */
  getDevModeDetails(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      retryable: this.retryable,
      timestamp: this.timestamp,
      fileId: this.fileId,
      chunkIndex: this.chunkIndex,
      details: this.details,
      operation: this.operation,
      handled: this.handled,
      stack: this.stack,
      originalError: this.originalError
        ? {
            name: this.originalError.name,
            message: this.originalError.message,
            stack: this.originalError.stack,
          }
        : undefined,
    };
  }

  /**
   * 将错误转换为JSON
   * @returns JSON表示
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      retryable: this.retryable,
      timestamp: this.timestamp,
      fileId: this.fileId,
      chunkIndex: this.chunkIndex,
      details: this.details,
      operation: this.operation,
      handled: this.handled,
    };
  }

  /**
   * 创建网络错误
   * @param message 错误消息
   * @param options 错误选项
   * @returns 网络错误实例
   */
  static network(
    message: string,
    options: {
      retryable?: boolean;
      details?: Record<string, unknown>;
      fileId?: string;
      chunkIndex?: number;
      originalError?: Error;
    } = {},
  ): UploadError {
    return new UploadError(message, ErrorCode.NETWORK_ERROR, {
      retryable: options.retryable !== undefined ? options.retryable : true,
      details: options.details,
      fileId: options.fileId,
      chunkIndex: options.chunkIndex,
      originalError: options.originalError,
      operation: 'network',
    });
  }

  /**
   * 创建文件错误
   * @param message 错误消息
   * @param code 错误代码
   * @param options 错误选项
   * @returns 文件错误实例
   */
  static file(
    message: string,
    code: string | ErrorCode = ErrorCode.FILE_READ_ERROR,
    options: {
      retryable?: boolean;
      details?: Record<string, unknown>;
      fileId?: string;
      originalError?: Error;
    } = {},
  ): UploadError {
    return new UploadError(message, code, {
      retryable: options.retryable !== undefined ? options.retryable : false,
      details: options.details,
      fileId: options.fileId,
      originalError: options.originalError,
      operation: 'file',
    });
  }

  /**
   * 创建服务器错误
   * @param message 错误消息
   * @param statusCode HTTP状态码
   * @param options 错误选项
   * @returns 服务器错误实例
   */
  static server(
    message: string,
    statusCode?: number,
    options: {
      retryable?: boolean;
      details?: Record<string, unknown>;
      fileId?: string;
      chunkIndex?: number;
      originalError?: Error;
    } = {},
  ): UploadError {
    const result = handleHttpStatusCode(statusCode);

    return new UploadError(message, result.code, {
      retryable: options.retryable !== undefined ? options.retryable : result.retryable,
      details: { ...(options.details || {}), statusCode },
      fileId: options.fileId,
      chunkIndex: options.chunkIndex,
      originalError: options.originalError,
      operation: 'server',
    });
  }

  /**
   * 创建超时错误
   * @param message 错误消息
   * @param options 错误选项
   * @returns 超时错误实例
   */
  static timeout(
    message: string,
    options: {
      retryable?: boolean;
      details?: Record<string, unknown>;
      fileId?: string;
      chunkIndex?: number;
      originalError?: Error;
    } = {},
  ): UploadError {
    return new UploadError(message, ErrorCode.TIMEOUT, {
      retryable: options.retryable !== undefined ? options.retryable : true,
      details: options.details,
      fileId: options.fileId,
      chunkIndex: options.chunkIndex,
      originalError: options.originalError,
      operation: 'timeout',
    });
  }

  /**
   * 创建分片错误
   * @param message 错误消息
   * @param chunkIndex 分片索引
   * @param options 错误选项
   * @returns 分片错误实例
   */
  static chunk(
    message: string,
    chunkIndex: number,
    options: {
      retryable?: boolean;
      details?: Record<string, unknown>;
      fileId?: string;
      originalError?: Error;
      code?: string | ErrorCode;
    } = {},
  ): UploadError {
    return new UploadError(message, options.code || ErrorCode.CHUNK_UPLOAD_FAILED, {
      retryable: options.retryable !== undefined ? options.retryable : true,
      details: options.details,
      fileId: options.fileId,
      chunkIndex,
      originalError: options.originalError,
      operation: 'chunk',
    });
  }
}

/**
 * 处理HTTP状态码，返回相应的错误代码和是否可重试
 * @param statusCode HTTP状态码
 * @returns 错误处理结果
 */
function handleHttpStatusCode(statusCode?: number): HttpStatusCodeResult {
  if (!statusCode) {
    return { code: ErrorCode.SERVER_ERROR, retryable: true };
  }

  // 根据状态码分类处理
  if (statusCode >= 200 && statusCode < 300) {
    // 2xx: 成功响应
    return { code: 'success', retryable: false };
  } else if (statusCode >= 400 && statusCode < 500) {
    // 4xx: 客户端错误
    switch (statusCode) {
      case 401:
        return { code: ErrorCode.AUTHENTICATION_FAILED, retryable: false };
      case 403:
        return { code: ErrorCode.AUTHORIZATION_FAILED, retryable: false };
      case 404:
        return { code: ExtendedErrorCode.RESOURCE_NOT_FOUND, retryable: false };
      case 409:
        return { code: ExtendedErrorCode.RESOURCE_CONFLICT, retryable: false };
      case 413:
        return { code: ErrorCode.FILE_TOO_LARGE, retryable: false };
      case 415:
        return { code: ExtendedErrorCode.UNSUPPORTED_MEDIA_TYPE, retryable: false };
      case 429:
        return { code: ErrorCode.SERVER_OVERLOAD, retryable: true };
      default:
        return { code: ErrorCode.UNKNOWN_ERROR, retryable: false };
    }
  } else if (statusCode >= 500 && statusCode < 600) {
    // 5xx: 服务器错误
    switch (statusCode) {
      case 500:
        return { code: ErrorCode.SERVER_ERROR, retryable: true };
      case 502:
      case 503:
      case 504:
        return { code: ErrorCode.SERVER_OVERLOAD, retryable: true };
      default:
        return { code: ErrorCode.SERVER_ERROR, retryable: true };
    }
  }

  // 其他状态码
  return { code: ErrorCode.UNKNOWN_ERROR, retryable: false };
}

/**
 * 错误消息本地化
 */
export function getLocalizedErrorMessage(
  code: string | ErrorCode,
  locale: string = 'en-US',
  fallbackMessage?: string,
): string {
  // 支持的语言
  const supportedLocales = ['en-US', 'zh-CN'];

  // 如果不支持的语言，回退到英文
  if (!supportedLocales.includes(locale)) {
    locale = 'en-US';
  }

  // 错误消息映射
  const errorMessages: Record<string, Record<string, string>> = {
    [ErrorCode.NETWORK_ERROR]: {
      'en-US': 'Network error',
      'zh-CN': '网络错误',
    },
    [ErrorCode.NETWORK_DISCONNECT]: {
      'en-US': 'Network disconnected',
      'zh-CN': '网络连接断开',
    },
    [ErrorCode.SERVER_ERROR]: {
      'en-US': 'Server error',
      'zh-CN': '服务器错误',
    },
    [ErrorCode.SERVER_TIMEOUT]: {
      'en-US': 'Server timeout',
      'zh-CN': '服务器超时',
    },
    [ErrorCode.SERVER_OVERLOAD]: {
      'en-US': 'Server overloaded',
      'zh-CN': '服务器过载',
    },
    [ErrorCode.TIMEOUT]: {
      'en-US': 'Operation timeout',
      'zh-CN': '操作超时',
    },
    [ErrorCode.FILE_TOO_LARGE]: {
      'en-US': 'File is too large',
      'zh-CN': '文件过大',
    },
    [ErrorCode.FILE_TYPE_NOT_ALLOWED]: {
      'en-US': 'File type not allowed',
      'zh-CN': '文件类型不允许',
    },
    [ErrorCode.CHUNK_UPLOAD_FAILED]: {
      'en-US': 'Chunk upload failed',
      'zh-CN': '分片上传失败',
    },
    [ErrorCode.INVALID_CHUNK_SIZE]: {
      'en-US': 'Invalid chunk size',
      'zh-CN': '无效的分片大小',
    },
    [ErrorCode.AUTHENTICATION_FAILED]: {
      'en-US': 'Authentication failed',
      'zh-CN': '认证失败',
    },
    [ErrorCode.AUTHORIZATION_FAILED]: {
      'en-US': 'Authorization failed',
      'zh-CN': '授权失败',
    },
    [ExtendedErrorCode.RESOURCE_NOT_FOUND]: {
      'en-US': 'Resource not found',
      'zh-CN': '资源未找到',
    },
    [ExtendedErrorCode.RESOURCE_CONFLICT]: {
      'en-US': 'Resource conflict',
      'zh-CN': '资源冲突',
    },
    [ExtendedErrorCode.UNSUPPORTED_MEDIA_TYPE]: {
      'en-US': 'Unsupported media type',
      'zh-CN': '不支持的媒体类型',
    },
  };

  // 尝试获取本地化消息
  const localizedMessages = errorMessages[code];
  if (localizedMessages) {
    return localizedMessages[locale] || fallbackMessage || code.toString();
  }

  // 如果没有找到本地化消息，返回原始消息或代码
  return fallbackMessage || code.toString();
}
