/**
 * @file-chunk-uploader/types 包的 mock 文件
 */

/**
 * 错误代码枚举
 * 定义所有可能的错误类型代码
 */
export enum ErrorCode {
  // 通用错误
  UNKNOWN_ERROR = 'unknown_error',
  NOT_IMPLEMENTED = 'not_implemented',
  OPERATION_CANCELED = 'operation_canceled',
  TIMEOUT = 'timeout',
  INVALID_PARAMETER = 'invalid_parameter',

  // 文件错误
  FILE_NOT_FOUND = 'file_not_found',
  FILE_TOO_LARGE = 'file_too_large',
  FILE_TYPE_NOT_ALLOWED = 'file_type_not_allowed',
  FILE_EMPTY = 'file_empty',
  FILE_CORRUPTED = 'file_corrupted',
  FILE_READ_ERROR = 'file_read_error',

  // 网络错误
  NETWORK_ERROR = 'network_error',
  NETWORK_DISCONNECT = 'network_disconnect',
  SERVER_ERROR = 'server_error',
  SERVER_TIMEOUT = 'server_timeout',
  SERVER_OVERLOAD = 'server_overload',
  REQUEST_FAILED = 'request_failed',
  RESPONSE_PARSE_ERROR = 'response_parse_error',

  // 分片错误
  CHUNK_UPLOAD_FAILED = 'chunk_upload_failed',
  CHUNK_SIZE_INVALID = 'chunk_size_invalid',
  CHUNK_OUT_OF_RANGE = 'chunk_out_of_range',
  INVALID_CHUNK_SIZE = 'invalid_chunk_size',
  CHUNK_ERROR = 'chunk_error',

  // 存储错误
  STORAGE_ERROR = 'storage_error',
  STORAGE_FULL = 'storage_full',
  QUOTA_EXCEEDED = 'quota_exceeded',
  STORAGE_READ_ERROR = 'storage_read_error',
  STORAGE_WRITE_ERROR = 'storage_write_error',

  // 插件错误
  PLUGIN_ERROR = 'plugin_error',
  PLUGIN_NOT_FOUND = 'plugin_not_found',
  PLUGIN_INITIALIZATION_FAILED = 'plugin_initialization_failed',
  PLUGIN_CONFLICT = 'plugin_conflict',

  // Worker错误
  WORKER_ERROR = 'worker_error',
  WORKER_NOT_SUPPORTED = 'worker_not_supported',
  WORKER_TERMINATED = 'worker_terminated',
  WORKER_TIMEOUT = 'worker_timeout',

  // 安全错误
  SECURITY_ERROR = 'security_error',
  AUTHENTICATION_FAILED = 'authentication_failed',
  AUTHORIZATION_FAILED = 'authorization_failed',
  TOKEN_EXPIRED = 'token_expired',
  SIGNATURE_INVALID = 'signature_invalid',

  // 兼容旧代码
  TIMEOUT_ERROR = 'timeout_error',
  ABORT_ERROR = 'abort_error',
  AUTH_ERROR = 'auth_error',
}

/**
 * 上传错误接口
 * 表示上传过程中可能发生的错误
 */
export interface IUploadError extends Error {
  /** 错误代码 */
  code: ErrorCode | string;
  /** 原始错误 */
  originalError?: Error;
  /** 是否可重试 */
  retryable: boolean;
  /** 文件ID */
  fileId?: string;
  /** 分片索引 */
  chunkIndex?: number;
  /** 详细信息 */
  details?: Record<string, unknown>;
  /** 是否已处理 */
  handled?: boolean;
  /** 触发错误的操作 */
  operation?: string;
  /** 错误时间戳 */
  timestamp: number;
}

/**
 * 错误上下文接口
 * 提供错误发生时的环境和状态信息
 */
export interface IErrorContext {
  /** 文件ID */
  fileId?: string;
  /** 分片索引 */
  chunkIndex?: number;
  /** 重试次数 */
  retryCount: number;
  /** 分片重试次数映射 */
  chunkRetries?: Record<number, number>;
  /** 成功重试次数 */
  successfulRetries?: number;
  /** 失败重试次数 */
  failedRetries?: number;
  /** 分片大小 */
  chunkSize?: number;
  /** 最后一次错误 */
  lastError?: Error;
  /** 操作类型 */
  operation?: string;
  /** 上下文时间戳 */
  timestamp: number;
}
