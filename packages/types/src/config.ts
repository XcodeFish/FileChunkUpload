/**
 * 配置选项类型定义
 * 包含上传器各种配置选项
 * @packageDocumentation
 */

/**
 * 日志级别枚举
 * 表示日志输出的不同级别
 */
export enum LogLevel {
  /** 调试 */
  DEBUG = 'debug',
  /** 信息 */
  INFO = 'info',
  /** 警告 */
  WARN = 'warn',
  /** 错误 */
  ERROR = 'error',
  /** 静默（不输出日志） */
  SILENT = 'silent',
}

/**
 * 日志格式枚举
 * 表示日志输出的格式
 */
export enum LogFormat {
  /** 格式化输出 */
  PRETTY = 'pretty',
  /** JSON格式 */
  JSON = 'json',
}

/**
 * 日志配置接口
 * 配置日志记录的行为
 */
export interface ILoggerConfig {
  /** 日志级别 */
  level?: LogLevel;
  /** 日志格式 */
  format?: LogFormat;
  /** 是否启用 */
  enabled?: boolean;
  /** 日志过滤器，只输出指定类别的日志 */
  filter?: string[];
}

/**
 * 开发者模式配置接口
 * 配置开发环境下的调试功能
 */
export interface IDevModeConfig {
  /** 是否启用开发者模式 */
  enabled: boolean;
  /** 日志配置 */
  logger?: ILoggerConfig;
  /** 是否启用性能监控 */
  performanceMonitoring?: boolean;
  /** 是否记录网络请求 */
  networkLogging?: boolean;
  /** 是否记录Worker操作 */
  workerLogging?: boolean;
  /** 是否追踪插件调用链 */
  pluginTracing?: boolean;
}

/**
 * 重试配置接口
 * 配置上传失败后的重试策略
 */
export interface IRetryConfig {
  /** 是否启用重试 */
  enabled?: boolean;
  /** 最大重试次数 */
  maxRetries?: number;
  /** 每个分片最大重试次数 */
  maxRetriesPerChunk?: number;
  /** 基础延迟时间（毫秒） */
  baseDelay?: number;
  /** 最大延迟时间（毫秒） */
  maxDelay?: number;
  /** 是否使用指数退避算法 */
  useExponentialBackoff?: boolean;
  /** 是否使用智能决策 */
  useSmartDecision?: boolean;
  /** 最低成功率阈值 */
  minSuccessRate?: number;
  /** 网络质量阈值 */
  networkQualityThreshold?: {
    /** 最低速度（Mbps） */
    minSpeed?: number;
    /** 最大RTT（毫秒） */
    maxRtt?: number;
  };
  /** 特定错误类型的最大重试次数 */
  errorTypeRetries?: {
    /** 网络错误 */
    network?: number;
    /** 服务器错误 */
    server?: number;
    /** 超时错误 */
    timeout?: number;
    /** 未知错误 */
    unknown?: number;
  };
  /** 是否持久化重试状态 */
  persistRetryState?: boolean;
  /** 是否发送重试事件通知 */
  notifyOnRetry?: boolean;
}

/**
 * 分片上传配置接口
 * 配置文件分片上传的行为
 */
export interface IChunkConfig {
  /** 分片大小（字节） */
  chunkSize?: number;
  /** 并发上传数 */
  concurrency?: number;
  /** 是否按顺序上传分片 */
  sequential?: boolean;
  /** 分片索引基数（0或1） */
  indexBase?: 0 | 1;
  /** 分片大小计算策略 */
  chunkSizeStrategy?: 'fixed' | 'adaptive';
  /** 每个分片最大重试次数 */
  maxRetries?: number;
}

/**
 * 存储配置接口
 * 配置上传状态和断点续传的存储方式
 */
export interface IStorageConfig {
  /** 存储类型 */
  type?: 'localStorage' | 'indexedDB' | 'memory';
  /** 数据库名称（IndexedDB） */
  dbName?: string;
  /** 存储对象名称（IndexedDB） */
  storeName?: string;
  /** 键前缀（localStorage） */
  keyPrefix?: string;
  /** 过期时间（毫秒） */
  expiration?: number;
  /** 是否启用 */
  enabled?: boolean;
}

/**
 * 上传配置接口
 * 配置文件上传的所有行为
 */
export interface IUploadConfig {
  /** 上传目标URL */
  target: string;
  /** 请求方法 */
  method?: 'POST' | 'PUT';
  /** 请求头 */
  headers?: Record<string, string>;
  /** 额外的表单字段 */
  formData?: Record<string, unknown>;
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 是否使用表单数据 */
  useFormData?: boolean;
  /** 文件字段名 */
  fileFieldName?: string;
  /** 分片上传配置 */
  chunk?: IChunkConfig;
  /** 重试配置 */
  retry?: IRetryConfig;
  /** 存储配置 */
  storage?: IStorageConfig;
  /** 开发者模式配置 */
  devMode?: IDevModeConfig | boolean;
  /** 是否使用断点续传 */
  resumable?: boolean;
  /** 是否启用秒传 */
  fastUpload?: boolean;
  /** 文件处理函数 */
  fileFilter?: (file: File) => boolean | Promise<boolean>;
  /** 进度回调函数 */
  onProgress?: (progress: number) => void;
  /** 状态变化回调函数 */
  onStatusChange?: (status: string) => void;
  /** 错误回调函数 */
  onError?: (error: Error) => void;
  /** 成功回调函数 */
  onSuccess?: (result: Record<string, unknown>) => void;
  /** 上传前回调函数 */
  beforeUpload?: (file: File) => File | Promise<File> | false | Promise<false>;
  /** 上传后回调函数 */
  afterUpload?: (result: Record<string, unknown>) => void;
  /** API版本 */
  apiVersion?: string;
  /** 预处理器 */
  preprocessors?: Array<(file: File) => File | Promise<File>>;
  /** 后处理器 */
  postprocessors?: Array<
    (result: Record<string, unknown>) => Record<string, unknown> | Promise<Record<string, unknown>>
  >;
}
