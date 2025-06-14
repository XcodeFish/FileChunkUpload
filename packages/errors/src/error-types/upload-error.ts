/**
 * 上传错误类实现
 * 处理各种上传过程中的错误情况，支持错误信息本地化和开发者模式
 * @packageDocumentation
 */

import { ErrorCode, IUploadError } from '@file-chunk-uploader/types';

/**
 * UploadError类
 * 扩展Error类，实现IUploadError接口，提供更详细的上传错误信息
 */
export class UploadError extends Error implements IUploadError {
  /** 错误代码 */
  public readonly code: ErrorCode | string;

  /** 是否可重试 */
  public readonly retryable: boolean;

  /** 错误发生时间戳 */
  public readonly timestamp: number;

  /** 原始错误 */
  public readonly originalError?: Error;

  /** 文件ID */
  public readonly fileId?: string;

  /** 分片索引 */
  public readonly chunkIndex?: number;

  /** 错误详情 */
  public readonly details?: Record<string, unknown>;

  /** 是否已处理 */
  public handled?: boolean;

  /** 触发错误的操作 */
  public readonly operation?: string;

  /**
   * 构造函数
   * @param message 错误消息
   * @param code 错误代码
   * @param options 额外选项
   */
  constructor(
    message: string,
    code: ErrorCode | string = ErrorCode.UNKNOWN_ERROR,
    options: {
      retryable?: boolean;
      originalError?: Error;
      fileId?: string;
      chunkIndex?: number;
      details?: Record<string, unknown>;
      operation?: string;
    } = {},
  ) {
    super(message);
    this.name = 'UploadError';
    this.code = code;
    this.timestamp = Date.now();

    // 根据错误代码决定是否可重试
    this.retryable = options.retryable ?? this.isRetryableByDefault(code);

    // 保存其他选项
    this.originalError = options.originalError;
    this.fileId = options.fileId;
    this.chunkIndex = options.chunkIndex;
    this.details = options.details;
    this.operation = options.operation;
    this.handled = false;

    // 设置原型链 (解决ES5环境下的继承问题)
    Object.setPrototypeOf(this, UploadError.prototype);
  }

  /**
   * 根据错误代码判断默认是否可重试
   * @param code 错误代码
   * @returns 是否可重试
   */
  private isRetryableByDefault(code: ErrorCode | string): boolean {
    // 通常可重试的网络相关错误
    const retryableCodes = [
      ErrorCode.NETWORK_ERROR,
      ErrorCode.NETWORK_DISCONNECT,
      ErrorCode.SERVER_TIMEOUT,
      ErrorCode.SERVER_OVERLOAD,
      ErrorCode.REQUEST_FAILED,
      ErrorCode.CHUNK_UPLOAD_FAILED,
      ErrorCode.TIMEOUT,
    ];

    // 通常不可重试的错误
    const nonRetryableCodes = [
      ErrorCode.FILE_NOT_FOUND,
      ErrorCode.FILE_TOO_LARGE,
      ErrorCode.FILE_TYPE_NOT_ALLOWED,
      ErrorCode.FILE_EMPTY,
      ErrorCode.FILE_CORRUPTED,
      ErrorCode.QUOTA_EXCEEDED,
      ErrorCode.AUTHENTICATION_FAILED,
      ErrorCode.AUTHORIZATION_FAILED,
      ErrorCode.WORKER_NOT_SUPPORTED,
    ];

    return (
      retryableCodes.includes(code as ErrorCode) && !nonRetryableCodes.includes(code as ErrorCode)
    );
  }

  /**
   * 创建网络错误
   * @param message 错误消息
   * @param originalError 原始错误
   * @param options 其他选项
   * @returns 上传错误实例
   */
  static network(
    message: string,
    originalError?: Error,
    options: Partial<
      Omit<IUploadError, 'message' | 'code' | 'originalError' | 'retryable' | 'timestamp'>
    > = {},
  ): UploadError {
    return new UploadError(message, ErrorCode.NETWORK_ERROR, {
      retryable: true,
      originalError,
      ...options,
    });
  }

  /**
   * 创建文件错误
   * @param message 错误消息
   * @param code 错误代码
   * @param options 其他选项
   * @returns 上传错误实例
   */
  static file(
    message: string,
    code: ErrorCode = ErrorCode.FILE_NOT_FOUND,
    options: Partial<Omit<IUploadError, 'message' | 'code' | 'retryable' | 'timestamp'>> = {},
  ): UploadError {
    return new UploadError(message, code, {
      retryable: false,
      ...options,
    });
  }

  /**
   * 创建服务器错误
   * @param message 错误消息
   * @param statusCode HTTP状态码
   * @param options 其他选项
   * @returns 上传错误实例
   */
  static server(
    message: string,
    statusCode?: number,
    options: Partial<Omit<IUploadError, 'message' | 'code' | 'retryable' | 'timestamp'>> = {},
  ): UploadError {
    // 根据HTTP状态码决定错误代码和是否可重试
    let code = ErrorCode.SERVER_ERROR;
    let retryable = true;

    if (statusCode) {
      // 4xx客户端错误通常不可重试
      if (statusCode >= 400 && statusCode < 500) {
        retryable = false;
        // 特殊状态码处理
        if (statusCode === 401) {
          code = ErrorCode.AUTHENTICATION_FAILED;
        } else if (statusCode === 403) {
          code = ErrorCode.AUTHORIZATION_FAILED;
        } else if (statusCode === 413) {
          code = ErrorCode.FILE_TOO_LARGE;
        }
      }
      // 5xx服务器错误通常可重试
      else if (statusCode >= 500) {
        if (statusCode === 503) {
          code = ErrorCode.SERVER_OVERLOAD;
        }
      }
    }

    return new UploadError(message, code, {
      retryable,
      details: { statusCode },
      ...options,
    });
  }

  /**
   * 创建超时错误
   * @param message 错误消息
   * @param options 其他选项
   * @returns 上传错误实例
   */
  static timeout(
    message: string,
    options: Partial<Omit<IUploadError, 'message' | 'code' | 'retryable' | 'timestamp'>> = {},
  ): UploadError {
    return new UploadError(message, ErrorCode.TIMEOUT, {
      retryable: true,
      ...options,
    });
  }

  /**
   * 创建分片错误
   * @param message 错误消息
   * @param chunkIndex 分片索引
   * @param options 其他选项
   * @returns 上传错误实例
   */
  static chunk(
    message: string,
    chunkIndex: number,
    options: Partial<
      Omit<IUploadError, 'message' | 'code' | 'chunkIndex' | 'retryable' | 'timestamp'>
    > = {},
  ): UploadError {
    return new UploadError(message, ErrorCode.CHUNK_UPLOAD_FAILED, {
      retryable: true,
      chunkIndex,
      ...options,
    });
  }

  /**
   * 获取本地化错误消息
   * @param locale 语言代码(默认'zh-CN')
   * @returns 本地化的错误消息
   */
  getLocalizedMessage(locale: string = 'zh-CN'): string {
    // 默认直接返回当前消息
    if (!this.code || !errorMessages[locale]) {
      return this.message;
    }

    const localizedMessages = errorMessages[locale];
    const template = localizedMessages[this.code] || this.message;

    // 如果是模板字符串，则进行变量替换
    if (template.includes('{{')) {
      return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        if (key === 'message') return this.message;
        if (this.details && key in this.details) return String(this.details[key]);
        return match;
      });
    }

    return template;
  }

  /**
   * 获取开发者模式的详细错误信息
   * @returns 详细的错误信息对象
   */
  getDevModeDetails(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      timestamp: this.timestamp,
      retryable: this.retryable,
      fileId: this.fileId,
      chunkIndex: this.chunkIndex,
      operation: this.operation,
      details: this.details,
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
   * 将错误转换为JSON表示
   * @returns 错误的JSON表示
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      timestamp: this.timestamp,
      retryable: this.retryable,
      fileId: this.fileId,
      chunkIndex: this.chunkIndex,
      operation: this.operation,
      details: this.details,
    };
  }
}

/**
 * 错误消息本地化映射表
 * 支持不同语言的错误消息模板
 */
const errorMessages: Record<string, Record<string, string>> = {
  'zh-CN': {
    // 通用错误
    [ErrorCode.UNKNOWN_ERROR]: '未知错误',
    [ErrorCode.NOT_IMPLEMENTED]: '功能未实现',
    [ErrorCode.OPERATION_CANCELED]: '操作已取消',
    [ErrorCode.TIMEOUT]: '操作超时',
    [ErrorCode.INVALID_PARAMETER]: '无效参数',

    // 文件错误
    [ErrorCode.FILE_NOT_FOUND]: '找不到文件',
    [ErrorCode.FILE_TOO_LARGE]: '文件太大',
    [ErrorCode.FILE_TYPE_NOT_ALLOWED]: '不允许的文件类型',
    [ErrorCode.FILE_EMPTY]: '文件为空',
    [ErrorCode.FILE_CORRUPTED]: '文件已损坏',
    [ErrorCode.FILE_READ_ERROR]: '文件读取错误',

    // 网络错误
    [ErrorCode.NETWORK_ERROR]: '网络错误',
    [ErrorCode.NETWORK_DISCONNECT]: '网络连接已断开',
    [ErrorCode.SERVER_ERROR]: '服务器错误',
    [ErrorCode.SERVER_TIMEOUT]: '服务器响应超时',
    [ErrorCode.SERVER_OVERLOAD]: '服务器繁忙',
    [ErrorCode.REQUEST_FAILED]: '请求失败',
    [ErrorCode.RESPONSE_PARSE_ERROR]: '响应解析错误',

    // 分片错误
    [ErrorCode.CHUNK_UPLOAD_FAILED]: '分片上传失败',
    [ErrorCode.CHUNK_SIZE_INVALID]: '分片大小无效',
    [ErrorCode.CHUNK_OUT_OF_RANGE]: '分片索引超出范围',
    [ErrorCode.INVALID_CHUNK_SIZE]: '无效的分片大小',

    // 存储错误
    [ErrorCode.STORAGE_ERROR]: '存储错误',
    [ErrorCode.STORAGE_FULL]: '存储空间已满',
    [ErrorCode.QUOTA_EXCEEDED]: '存储配额已超出',
    [ErrorCode.STORAGE_READ_ERROR]: '存储读取错误',
    [ErrorCode.STORAGE_WRITE_ERROR]: '存储写入错误',

    // 插件错误
    [ErrorCode.PLUGIN_ERROR]: '插件错误',
    [ErrorCode.PLUGIN_NOT_FOUND]: '插件未找到',
    [ErrorCode.PLUGIN_INITIALIZATION_FAILED]: '插件初始化失败',
    [ErrorCode.PLUGIN_CONFLICT]: '插件冲突',

    // Worker错误
    [ErrorCode.WORKER_ERROR]: 'Worker错误',
    [ErrorCode.WORKER_NOT_SUPPORTED]: '不支持Web Worker',
    [ErrorCode.WORKER_TERMINATED]: 'Worker已终止',
    [ErrorCode.WORKER_TIMEOUT]: 'Worker执行超时',

    // 安全错误
    [ErrorCode.SECURITY_ERROR]: '安全错误',
    [ErrorCode.AUTHENTICATION_FAILED]: '身份验证失败',
    [ErrorCode.AUTHORIZATION_FAILED]: '授权失败',
    [ErrorCode.TOKEN_EXPIRED]: '令牌已过期',
    [ErrorCode.SIGNATURE_INVALID]: '签名无效',
  },
  'en-US': {
    // 通用错误
    [ErrorCode.UNKNOWN_ERROR]: 'Unknown error',
    [ErrorCode.NOT_IMPLEMENTED]: 'Not implemented',
    [ErrorCode.OPERATION_CANCELED]: 'Operation canceled',
    [ErrorCode.TIMEOUT]: 'Operation timed out',
    [ErrorCode.INVALID_PARAMETER]: 'Invalid parameter',

    // 文件错误
    [ErrorCode.FILE_NOT_FOUND]: 'File not found',
    [ErrorCode.FILE_TOO_LARGE]: 'File too large',
    [ErrorCode.FILE_TYPE_NOT_ALLOWED]: 'File type not allowed',
    [ErrorCode.FILE_EMPTY]: 'File is empty',
    [ErrorCode.FILE_CORRUPTED]: 'File is corrupted',
    [ErrorCode.FILE_READ_ERROR]: 'File read error',

    // 网络错误
    [ErrorCode.NETWORK_ERROR]: 'Network error',
    [ErrorCode.NETWORK_DISCONNECT]: 'Network disconnected',
    [ErrorCode.SERVER_ERROR]: 'Server error',
    [ErrorCode.SERVER_TIMEOUT]: 'Server timeout',
    [ErrorCode.SERVER_OVERLOAD]: 'Server overloaded',
    [ErrorCode.REQUEST_FAILED]: 'Request failed',
    [ErrorCode.RESPONSE_PARSE_ERROR]: 'Response parse error',

    // 分片错误
    [ErrorCode.CHUNK_UPLOAD_FAILED]: 'Chunk upload failed',
    [ErrorCode.CHUNK_SIZE_INVALID]: 'Invalid chunk size',
    [ErrorCode.CHUNK_OUT_OF_RANGE]: 'Chunk index out of range',
    [ErrorCode.INVALID_CHUNK_SIZE]: 'Invalid chunk size',

    // 存储错误
    [ErrorCode.STORAGE_ERROR]: 'Storage error',
    [ErrorCode.STORAGE_FULL]: 'Storage full',
    [ErrorCode.QUOTA_EXCEEDED]: 'Storage quota exceeded',
    [ErrorCode.STORAGE_READ_ERROR]: 'Storage read error',
    [ErrorCode.STORAGE_WRITE_ERROR]: 'Storage write error',

    // 插件错误
    [ErrorCode.PLUGIN_ERROR]: 'Plugin error',
    [ErrorCode.PLUGIN_NOT_FOUND]: 'Plugin not found',
    [ErrorCode.PLUGIN_INITIALIZATION_FAILED]: 'Plugin initialization failed',
    [ErrorCode.PLUGIN_CONFLICT]: 'Plugin conflict',

    // Worker错误
    [ErrorCode.WORKER_ERROR]: 'Worker error',
    [ErrorCode.WORKER_NOT_SUPPORTED]: 'Web Worker not supported',
    [ErrorCode.WORKER_TERMINATED]: 'Worker terminated',
    [ErrorCode.WORKER_TIMEOUT]: 'Worker timed out',

    // 安全错误
    [ErrorCode.SECURITY_ERROR]: 'Security error',
    [ErrorCode.AUTHENTICATION_FAILED]: 'Authentication failed',
    [ErrorCode.AUTHORIZATION_FAILED]: 'Authorization failed',
    [ErrorCode.TOKEN_EXPIRED]: 'Token expired',
    [ErrorCode.SIGNATURE_INVALID]: 'Invalid signature',
  },
};

/**
 * 获取本地化的错误消息
 * @param code 错误代码
 * @param locale 语言代码
 * @param message 默认消息
 * @returns 本地化的错误消息
 */
export function getLocalizedErrorMessage(
  code: ErrorCode | string,
  locale: string = 'zh-CN',
  message?: string,
): string {
  const localizedMessages = errorMessages[locale] || errorMessages['zh-CN'];
  return localizedMessages[code] || message || String(code);
}
