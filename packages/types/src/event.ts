/**
 * 事件系统类型定义
 * 包含事件发射器和事件类型
 * @packageDocumentation
 */
import { IFileInfo, IUploadProgress, IUploadResult } from './base';
import { IRetryFailedInfo, IRetryStartInfo, IRetrySuccessInfo } from './plugin';

/**
 * 命名空间定义
 */
export type Namespace = string;

/**
 * 命名空间格式化工具类型
 */
export type NamespacedEvent<T extends string> = `${Namespace}:${T}`;

/**
 * 事件名称枚举
 * 定义系统中所有可能的事件类型
 */
export enum EventName {
  // 上传生命周期事件
  UPLOAD_START = 'upload:start',
  UPLOAD_PROGRESS = 'upload:progress',
  UPLOAD_SUCCESS = 'upload:success',
  UPLOAD_ERROR = 'upload:error',
  UPLOAD_COMPLETE = 'upload:complete',
  UPLOAD_PAUSE = 'upload:pause',
  UPLOAD_RESUME = 'upload:resume',
  UPLOAD_CANCEL = 'upload:cancel',

  // 分片上传事件
  CHUNK_START = 'chunk:start',
  CHUNK_PROGRESS = 'chunk:progress',
  CHUNK_SUCCESS = 'chunk:success',
  CHUNK_ERROR = 'chunk:error',
  CHUNK_COMPLETE = 'chunk:complete',

  // 重试事件
  RETRY_START = 'retry:start',
  RETRY_SUCCESS = 'retry:success',
  RETRY_FAILED = 'retry:failed',
  RETRY_WAITING = 'retry:waiting',
  RETRY_ADJUSTING = 'retry:adjusting',

  // 网络事件
  NETWORK_ONLINE = 'network:online',
  NETWORK_OFFLINE = 'network:offline',
  NETWORK_SPEED_CHANGE = 'network:speed-change',
  NETWORK_REQUEST = 'network:request',
  NETWORK_RESPONSE = 'network:response',
  NETWORK_ERROR = 'network:error',

  // Worker事件
  WORKER_TASK = 'worker:task',
  WORKER_RESULT = 'worker:result',
  WORKER_ERROR = 'worker:error',

  // 插件事件
  PLUGIN_BEFORE = 'plugin:before',
  PLUGIN_AFTER = 'plugin:after',
  PLUGIN_ERROR = 'plugin:error',

  // 存储事件
  STORAGE_SAVE = 'storage:save',
  STORAGE_LOAD = 'storage:load',
  STORAGE_REMOVE = 'storage:remove',
  STORAGE_ERROR = 'storage:error',

  // 其他事件
  FILE_FILTER = 'file:filter',
  FILE_HASH = 'file:hash',
  FILE_TRANSFORM = 'file:transform',

  // 生命周期事件
  UPLOADER_INITIALIZED = 'uploader:initialized',
  UPLOADER_DESTROYED = 'uploader:destroyed',

  // 文件操作事件
  FILE_ADDED = 'file:added',
  FILE_REMOVED = 'file:removed',
  FILES_ADDED = 'files:added',
}

/**
 * 预定义的钩子类型
 */
export enum HookType {
  // 文件处理钩子
  BEFORE_FILE_ADD = 'hook:before_file_add',
  AFTER_FILE_ADD = 'hook:after_file_add',
  BEFORE_FILE_REMOVE = 'hook:before_file_remove',

  // 上传钩子
  BEFORE_UPLOAD = 'hook:before_upload',
  AFTER_UPLOAD = 'hook:after_upload',
  BEFORE_PAUSE = 'hook:before_pause',
  BEFORE_RESUME = 'hook:before_resume',
  BEFORE_CANCEL = 'hook:before_cancel',

  // 分片钩子
  BEFORE_CHUNK_UPLOAD = 'hook:before_chunk_upload',
  AFTER_CHUNK_UPLOAD = 'hook:after_chunk_upload',

  // 错误处理钩子
  ON_ERROR = 'hook:on_error',
  BEFORE_RETRY = 'hook:before_retry',
}

/**
 * 事件处理器上下文
 */
export interface IEventContext {
  /**
   * 事件名称
   */
  eventName: EventName | string;

  /**
   * 触发时间
   */
  timestamp: number;

  /**
   * 事件源
   */
  source?: string;

  /**
   * 获取元数据
   */
  meta: Record<string, unknown>;

  /**
   * 停止事件传播
   */
  stopPropagation: () => void;

  /**
   * 检查事件传播是否已停止
   */
  isPropagationStopped: () => boolean;

  /**
   * 命名空间
   */
  namespace?: Namespace;
}

/**
 * 事件处理函数类型
 * 表示事件监听回调函数
 */
export type EventHandler<T = unknown> = (data: T, context?: IEventContext) => void | Promise<void>;

/**
 * 事件处理器与优先级
 */
export interface IEventHandlerWithPriority<TData = unknown> {
  /**
   * 事件处理函数
   */
  handler: EventHandler<TData>;

  /**
   * 优先级，越小优先级越高
   */
  priority: number;

  /**
   * 是否只执行一次
   */
  once: boolean;

  /**
   * 过滤条件，返回 true 才会调用处理器
   */
  filter?: (data: TData) => boolean;

  /**
   * 超时时间（毫秒）
   */
  timeout?: number;

  /**
   * 事件处理器绑定的上下文
   */
  context?: unknown;

  /**
   * 处理器唯一标识
   */
  id?: string;

  /**
   * 是否捕获并处理处理器抛出的错误
   * 默认: true
   */
  catchError?: boolean;
}

/**
 * 事件选项接口
 * 配置事件监听器的行为
 */
export interface IEventOptions {
  /** 是否只触发一次 */
  once?: boolean;

  /**
   * 事件处理优先级 (数字越小优先级越高)
   */
  priority?: number;

  /**
   * 事件过滤条件
   */
  filter?: <T>(data: T) => boolean;

  /**
   * 处理器执行超时时间（毫秒），超过此时间将记录警告日志
   */
  timeout?: number;

  /**
   * 处理器绑定的上下文
   */
  context?: unknown;

  /**
   * 处理器唯一标识
   */
  id?: string;

  /**
   * 是否捕获并处理处理器抛出的错误
   * 默认: true
   */
  catchError?: boolean;
}

/**
 * 事件发布选项
 */
export interface IEventEmitOptions {
  /**
   * 是否同步发布
   */
  sync?: boolean;

  /**
   * 事件源
   */
  source?: string;

  /**
   * 元数据
   */
  meta?: Record<string, unknown>;

  /**
   * 是否仅在当前命名空间触发
   * 默认: false (会同时触发全局命名空间下的处理器)
   */
  namespaceOnly?: boolean;

  /**
   * 超时时间（毫秒）
   * 如果提供，则等待所有处理器执行的总时间不会超过此值
   */
  timeout?: number;

  /**
   * 错误处理回调
   * 当事件处理过程中发生错误时调用
   */
  errorCallback?: (errors: Array<{ error: unknown; handlerId?: string }>) => void;
}

/**
 * 事件监听器接口
 * 表示已注册的事件监听器
 */
export interface IEventListener<T = unknown> {
  /** 事件处理函数 */
  handler: EventHandler<T>;
  /** 事件选项 */
  options: IEventOptions;
}

/**
 * 事件发射器接口
 * 实现事件的注册、移除和触发
 */
export interface IEventEmitter {
  /**
   * 添加事件监听器
   * @param eventName 事件名称
   * @param handler 事件处理函数
   * @param options 事件选项
   * @returns this 实例，用于链式调用
   */
  on<T>(eventName: string, handler: EventHandler<T>, options?: IEventOptions): this;

  /**
   * 添加只触发一次的事件监听器
   * @param eventName 事件名称
   * @param handler 事件处理函数
   * @param options 事件选项
   * @returns this 实例，用于链式调用
   */
  once<T>(eventName: string, handler: EventHandler<T>, options?: Omit<IEventOptions, 'once'>): this;

  /**
   * 移除事件监听器
   * @param eventName 事件名称
   * @param handler 事件处理函数，如果不提供则移除该事件的所有监听器
   * @returns this 实例，用于链式调用
   */
  off(eventName: string, handler?: EventHandler<unknown>): this;

  /**
   * 触发事件
   * @param eventName 事件名称
   * @param data 事件数据
   * @param options 发布选项
   * @returns 是否有监听器被触发
   */
  emit<T>(eventName: string, data?: T, options?: IEventEmitOptions): boolean | Promise<void>;

  /**
   * 同步触发事件
   *
   * @param event 事件名
   * @param data 事件数据
   * @param options 发布选项
   */
  emitSync<TData = unknown>(
    event: string,
    data?: TData,
    options?: Omit<IEventEmitOptions, 'sync'>,
  ): void;

  /**
   * 批量注册事件监听器
   *
   * @param events 事件名称数组
   * @param handler 事件处理函数
   * @param options 选项
   * @returns 取消订阅函数数组
   */
  onBatch<TData = unknown>(
    events: string[],
    handler: EventHandler<TData>,
    options?: IEventOptions,
  ): Array<() => void>;

  /**
   * 获取事件监听器
   * @param eventName 事件名称
   * @returns 该事件的所有监听器
   */
  listeners(eventName: string): Array<IEventListener>;

  /**
   * 是否有事件监听器
   * @param eventName 事件名称
   * @returns 是否存在监听器
   */
  hasListeners(eventName: string): boolean;

  /**
   * 移除所有事件监听器
   * @param eventName 事件名称，如果不提供则移除所有事件的监听器
   * @returns this 实例，用于链式调用
   */
  removeAllListeners(eventName?: string): this;

  /**
   * 获取所有已注册的事件名称
   *
   * @returns 事件名称数组
   */
  getEventNames(): string[];

  /**
   * 创建命名空间事件发射器
   *
   * @param namespace 命名空间
   * @returns 带命名空间的事件发射器
   */
  createNamespacedEmitter(namespace: Namespace): IEventEmitter;
}

/**
 * 钩子接口
 */
export interface IHook<TData = unknown, TResult = void> {
  /**
   * 注册钩子处理函数
   *
   * @param handler 钩子处理函数
   * @param options 选项
   * @returns 取消注册函数
   */
  register(
    handler: (data: TData) => TResult | Promise<TResult>,
    options?: IEventOptions,
  ): () => void;

  /**
   * 批量注册钩子处理函数
   *
   * @param handlers 钩子处理函数数组
   * @param options 选项
   * @returns 取消注册函数数组
   */
  registerBatch(
    handlers: Array<(data: TData) => TResult | Promise<TResult>>,
    options?: IEventOptions,
  ): Array<() => void>;

  /**
   * 触发钩子并等待所有处理函数完成
   *
   * @param data 输入数据
   * @returns 所有处理函数的结果数组
   */
  call(data: TData): Promise<TResult[]>;

  /**
   * 并行执行所有钩子处理函数
   *
   * @param data 输入数据
   * @returns 所有处理函数的结果数组
   */
  parallel(data: TData): Promise<TResult[]>;

  /**
   * 通过瀑布流方式触发钩子，每个处理函数接收上一个函数的返回值
   *
   * @param initialData 初始数据
   * @returns 最终处理结果
   */
  waterfall(initialData: TData): Promise<TData>;

  /**
   * 移除钩子处理函数
   *
   * @param handler 要移除的处理函数
   */
  unregister(handler: (data: TData) => TResult | Promise<TResult>): void;
}

/**
 * 事件处理器超时错误
 */
export class HandlerTimeoutError extends Error {
  /**
   * 超时的事件名称
   */
  readonly eventName: string;

  /**
   * 超时时间（毫秒）
   */
  readonly timeout: number;

  /**
   * 创建处理器超时错误
   *
   * @param event 事件名称
   * @param timeout 超时时间
   */
  constructor(event: string, timeout: number) {
    super(`事件处理器超时: ${event} (${timeout}ms)`);
    this.name = 'HandlerTimeoutError';
    this.eventName = event;
    this.timeout = timeout;
  }
}

/**
 * 事件处理器错误
 */
export class EventHandlerError extends Error {
  /**
   * 原始错误
   */
  readonly originalError: unknown;

  /**
   * 事件名称
   */
  readonly eventName: string;

  /**
   * 处理器ID
   */
  readonly handlerId?: string;

  /**
   * 创建事件处理器错误
   *
   * @param event 事件名称
   * @param originalError 原始错误
   * @param handlerId 处理器ID
   */
  constructor(event: string, originalError: unknown, handlerId?: string) {
    const idInfo = handlerId ? ` (处理器ID: ${handlerId})` : '';
    super(`事件处理器执行失败: ${event}${idInfo}`);
    this.name = 'EventHandlerError';
    this.originalError = originalError;
    this.eventName = event;
    this.handlerId = handlerId;
  }
}

/**
 * 上传开始事件数据接口
 * 表示文件开始上传时的事件数据
 */
export interface IUploadStartEvent {
  /** 文件信息 */
  file: IFileInfo;
  /** 开始时间 */
  startTime: number;
}

/**
 * 上传进度事件数据接口
 * 表示文件上传进度更新时的事件数据
 */
export interface IUploadProgressEvent {
  /** 文件信息 */
  file: IFileInfo;
  /** 进度信息 */
  progress: IUploadProgress;
}

/**
 * 上传成功事件数据接口
 * 表示文件上传成功时的事件数据
 */
export interface IUploadSuccessEvent {
  /** 文件信息 */
  file: IFileInfo;
  /** 上传结果 */
  result: IUploadResult;
  /** 完成时间 */
  completeTime: number;
  /** 总耗时（毫秒） */
  duration: number;
}

/**
 * 上传错误事件数据接口
 * 表示文件上传失败时的事件数据
 */
export interface IUploadErrorEvent {
  /** 文件信息 */
  file: IFileInfo;
  /** 错误对象 */
  error: Error;
  /** 是否可恢复 */
  recoverable: boolean;
}

/**
 * 分片上传开始事件数据接口
 * 表示分片开始上传时的事件数据
 */
export interface IChunkStartEvent {
  /** 文件信息 */
  file: IFileInfo;
  /** 分片索引 */
  chunkIndex: number;
  /** 总分片数 */
  totalChunks: number;
  /** 分片大小 */
  chunkSize: number;
  /** 开始时间 */
  startTime: number;
}

/**
 * 分片上传进度事件数据接口
 * 表示分片上传进度更新时的事件数据
 */
export interface IChunkProgressEvent {
  /** 文件信息 */
  file: IFileInfo;
  /** 分片索引 */
  chunkIndex: number;
  /** 进度信息 */
  progress: IUploadProgress;
}

/**
 * 分片上传成功事件数据接口
 * 表示分片上传成功时的事件数据
 */
export interface IChunkSuccessEvent {
  /** 文件信息 */
  file: IFileInfo;
  /** 分片索引 */
  chunkIndex: number;
  /** 服务器响应 */
  response: Record<string, unknown>;
  /** 完成时间 */
  completeTime: number;
  /** 耗时（毫秒） */
  duration: number;
}

/**
 * 分片上传错误事件数据接口
 * 表示分片上传失败时的事件数据
 */
export interface IChunkErrorEvent {
  /** 文件信息 */
  file: IFileInfo;
  /** 分片索引 */
  chunkIndex: number;
  /** 错误对象 */
  error: Error;
  /** 是否可重试 */
  retryable: boolean;
}

/**
 * 网络状态事件数据接口
 * 表示网络状态变化时的事件数据
 */
export interface INetworkStatusEvent {
  /** 是否在线 */
  online: boolean;
  /** 网络类型 */
  type?: 'wifi' | 'cellular' | 'ethernet' | 'unknown';
  /** 网络速度（Mbps） */
  speed?: number;
  /** RTT（毫秒） */
  rtt?: number;
}

/**
 * 网络请求事件数据接口
 * 表示发送网络请求时的事件数据
 */
export interface INetworkRequestEvent {
  /** 请求方法 */
  method: string;
  /** 请求URL */
  url: string;
  /** 请求头 */
  headers?: Record<string, string>;
  /** 请求体 */
  body?: unknown;
  /** 请求ID */
  requestId: string;
  /** 开始时间 */
  startTime: number;
}

/**
 * 网络响应事件数据接口
 * 表示收到网络响应时的事件数据
 */
export interface INetworkResponseEvent {
  /** 状态码 */
  status: number;
  /** 响应状态文本 */
  statusText: string;
  /** 响应头 */
  headers?: Record<string, string>;
  /** 响应体 */
  body?: unknown;
  /** 请求ID */
  requestId: string;
  /** 结束时间 */
  endTime: number;
  /** 耗时（毫秒） */
  duration: number;
}

/**
 * Worker任务事件数据接口
 * 表示Worker任务开始执行时的事件数据
 */
export interface IWorkerTaskEvent {
  /** 任务类型 */
  type: string;
  /** 任务ID */
  taskId: string;
  /** 任务负载 */
  payload: unknown;
  /** 开始时间 */
  startTime: number;
}

/**
 * Worker结果事件数据接口
 * 表示Worker任务执行完成时的事件数据
 */
export interface IWorkerResultEvent {
  /** 任务类型 */
  type: string;
  /** 任务ID */
  taskId: string;
  /** 结果数据 */
  result: unknown;
  /** 结束时间 */
  endTime: number;
  /** 耗时（毫秒） */
  duration: number;
}

/**
 * 插件钩子事件数据接口
 * 表示插件钩子执行前后的事件数据
 */
export interface IPluginHookEvent {
  /** 插件名称 */
  pluginName: string;
  /** 钩子名称 */
  hookName: string;
  /** 执行时间 */
  time: number;
  /** 执行耗时（毫秒，仅afterHook有） */
  duration?: number;
}

/**
 * 文件哈希事件数据接口
 * 表示文件哈希计算完成时的事件数据
 */
export interface IFileHashEvent {
  /** 文件信息 */
  file: IFileInfo;
  /** 哈希算法 */
  algorithm: string;
  /** 哈希值 */
  hash: string;
  /** 计算耗时（毫秒） */
  duration: number;
}

/**
 * 事件数据映射
 * 定义每个事件名称对应的事件数据类型
 */
export interface IEventDataMap {
  [EventName.UPLOAD_START]: IUploadStartEvent;
  [EventName.UPLOAD_PROGRESS]: IUploadProgressEvent;
  [EventName.UPLOAD_SUCCESS]: IUploadSuccessEvent;
  [EventName.UPLOAD_ERROR]: IUploadErrorEvent;
  [EventName.UPLOAD_COMPLETE]: IUploadSuccessEvent | IUploadErrorEvent;
  [EventName.UPLOAD_PAUSE]: IFileInfo;
  [EventName.UPLOAD_RESUME]: IFileInfo;
  [EventName.UPLOAD_CANCEL]: IFileInfo;

  [EventName.CHUNK_START]: IChunkStartEvent;
  [EventName.CHUNK_PROGRESS]: IChunkProgressEvent;
  [EventName.CHUNK_SUCCESS]: IChunkSuccessEvent;
  [EventName.CHUNK_ERROR]: IChunkErrorEvent;
  [EventName.CHUNK_COMPLETE]: IChunkSuccessEvent | IChunkErrorEvent;

  [EventName.RETRY_START]: IRetryStartInfo;
  [EventName.RETRY_SUCCESS]: IRetrySuccessInfo;
  [EventName.RETRY_FAILED]: IRetryFailedInfo;
  [EventName.RETRY_WAITING]: { fileId: string; reason: string };
  [EventName.RETRY_ADJUSTING]: {
    fileId: string;
    chunkIndex: number;
    oldChunkSize: number;
    newChunkSize: number;
  };

  [EventName.NETWORK_ONLINE]: INetworkStatusEvent;
  [EventName.NETWORK_OFFLINE]: INetworkStatusEvent;
  [EventName.NETWORK_SPEED_CHANGE]: INetworkStatusEvent;
  [EventName.NETWORK_REQUEST]: INetworkRequestEvent;
  [EventName.NETWORK_RESPONSE]: INetworkResponseEvent;
  [EventName.NETWORK_ERROR]: { requestId: string; error: Error };

  [EventName.WORKER_TASK]: IWorkerTaskEvent;
  [EventName.WORKER_RESULT]: IWorkerResultEvent;
  [EventName.WORKER_ERROR]: { taskId: string; error: Error };

  [EventName.PLUGIN_BEFORE]: IPluginHookEvent;
  [EventName.PLUGIN_AFTER]: IPluginHookEvent;
  [EventName.PLUGIN_ERROR]: { pluginName: string; hookName: string; error: Error };

  [EventName.STORAGE_SAVE]: { key: string; value: unknown };
  [EventName.STORAGE_LOAD]: { key: string; value: unknown };
  [EventName.STORAGE_REMOVE]: { key: string };
  [EventName.STORAGE_ERROR]: { operation: string; key: string; error: Error };

  [EventName.FILE_FILTER]: { file: File; accepted: boolean; reason?: string };
  [EventName.FILE_HASH]: IFileHashEvent;
  [EventName.FILE_TRANSFORM]: { originalFile: File; transformedFile: File; transformName: string };

  // 生命周期事件
  [EventName.UPLOADER_INITIALIZED]: { timestamp: number };
  [EventName.UPLOADER_DESTROYED]: { timestamp: number };

  // 文件操作事件
  [EventName.FILE_ADDED]: { file: IFileInfo };
  [EventName.FILE_REMOVED]: { file: IFileInfo };
  [EventName.FILES_ADDED]: { files: IFileInfo[] };
}
