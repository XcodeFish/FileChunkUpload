/**
 * 错误类型定义
 * 包含上传错误和错误处理相关接口
 * @packageDocumentation
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
  OPERATION_FAILED = 'operation_failed',
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

  // 存储错误
  STORAGE_ERROR = 'storage_error',
  STORAGE_FULL = 'storage_full',
  QUOTA_EXCEEDED = 'quota_exceeded',
  STORAGE_READ_ERROR = 'storage_read_error',
  STORAGE_WRITE_ERROR = 'storage_write_error',

  // 上传错误
  UPLOAD_FAILED = 'upload_failed',

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

/**
 * 错误动作类型
 * 表示遇到错误时可能采取的动作类型
 */
export type ErrorActionType = 'retry' | 'fail' | 'wait_for_connection' | 'adjust_and_retry';

/**
 * 错误动作接口
 * 描述发生错误时应该执行的动作
 */
export interface IErrorAction {
  /** 动作类型 */
  type: ErrorActionType;
  /** 动作消息 */
  message: string;
  /** 延迟时间（毫秒，仅retry类型） */
  delay?: number;
  /** 是否可恢复（仅fail类型） */
  recoverable?: boolean;
  /** 新分片大小（仅adjust_and_retry类型） */
  newChunkSize?: number;
}

/**
 * 错误处理器接口
 * 负责处理上传过程中的各种错误
 */
export interface IErrorHandler {
  /**
   * 处理错误
   * @param error 上传错误
   * @param context 错误上下文
   * @returns 错误处理动作
   */
  handle(error: IUploadError, context: IErrorContext): IErrorAction;

  /**
   * 获取错误报告
   * @param timeWindow 时间窗口（毫秒）
   * @returns 错误统计报告
   */
  aggregateErrors(timeWindow?: number): IErrorReport;
}

/**
 * 错误恢复管理器接口
 * 负责管理错误重试和恢复策略
 */
export interface IErrorRecoveryManager {
  /**
   * 处理错误
   * @param error 上传错误
   * @param context 错误上下文
   */
  handleError(error: IUploadError, context: IErrorContext): Promise<void>;

  /**
   * 处理重试成功
   * @param context 错误上下文
   */
  handleRetrySuccess(context: IErrorContext): Promise<void>;

  /**
   * 清理资源
   */
  cleanup(): Promise<void>;
}

/**
 * 错误报告接口
 * 提供错误统计和分析信息
 */
export interface IErrorReport {
  /** 错误总数 */
  count: number;
  /** 错误类型统计 */
  types: Record<string, number>;
  /** 详细错误记录（可选） */
  details?: Array<{
    /** 错误代码 */
    code: string;
    /** 错误消息 */
    message: string;
    /** 文件ID */
    fileId?: string;
    /** 时间戳 */
    timestamp: number;
    /** 是否重试 */
    retried?: boolean;
  }>;
}

/**
 * 重试统计接口
 * 记录重试历史和网络条件
 */
export interface IRetryStats {
  /** 成功次数 */
  successCount: number;
  /** 失败次数 */
  failCount: number;
  /** 最后重试时间 */
  lastRetryTime: number;
  /** 网络条件记录 */
  networkConditions: Array<{
    /** 记录时间 */
    time: number;
    /** 是否在线 */
    online: boolean;
    /** 网络类型 */
    type: 'wifi' | 'cellular' | 'ethernet' | 'unknown';
    /** 网络速度（Mbps） */
    speed: number;
    /** RTT（毫秒） */
    rtt: number;
  }>;
}

/**
 * 恢复任务接口
 * 表示等待执行的错误恢复任务
 */
export interface IRecoveryTask {
  /** 任务ID */
  id: string;
  /** 文件ID */
  fileId: string;
  /** 分片索引 */
  chunkIndex?: number;
  /** 任务类型 */
  type: 'retry' | 'network_recovery' | 'adjust_chunk';
  /** 计划执行时间 */
  scheduledTime: number;
  /** 延迟时间（毫秒） */
  delay: number;
  /** 错误上下文 */
  context: IErrorContext;
  /** 错误对象 */
  error: IUploadError;
  /** 任务处理函数 */
  handler: () => Promise<void>;
  /** 是否已处理 */
  handled: boolean;
  /** 创建时间 */
  createdAt: number;
}
