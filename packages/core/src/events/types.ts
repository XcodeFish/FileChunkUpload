/**
 * 事件系统类型定义
 */

/**
 * 事件名称类型，包括预定义事件和自定义字符串
 */
export type EventName = keyof typeof UploadEventType | keyof typeof HookType | string;

/**
 * 命名空间定义
 */
export type Namespace = string;

/**
 * 命名空间格式化工具类型
 */
export type NamespacedEvent<T extends string> = `${Namespace}:${T}`;

/**
 * 事件处理器上下文
 */
export interface IEventContext {
  /**
   * 事件名称
   */
  eventName: EventName;

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
 * 事件处理器
 */
export type EventHandler<TData = unknown> = (
  data: TData,
  context?: IEventContext,
) => void | Promise<void>;

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
 * 事件选项
 */
export interface IEventOptions {
  /**
   * 是否只执行一次
   */
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
 * 事件发射器接口
 */
export interface IEventEmitter {
  /**
   * 注册事件监听器
   *
   * @param event 事件名
   * @param handler 事件处理函数
   * @param options 选项
   * @returns 取消订阅函数
   */
  on<TData = unknown>(
    event: EventName,
    handler: EventHandler<TData>,
    options?: IEventOptions,
  ): () => void;

  /**
   * 注册只执行一次的事件监听器
   *
   * @param event 事件名
   * @param handler 事件处理函数
   * @param options 选项
   * @returns 取消订阅函数
   */
  once<TData = unknown>(
    event: EventName,
    handler: EventHandler<TData>,
    options?: Omit<IEventOptions, 'once'>,
  ): () => void;

  /**
   * 移除事件监听器
   *
   * @param event 事件名
   * @param handler 事件处理函数（可选，如不提供则移除所有该事件的监听器）
   */
  off<TData = unknown>(event: EventName, handler?: EventHandler<TData>): void;

  /**
   * 触发事件
   *
   * @param event 事件名
   * @param data 事件数据
   * @param options 发布选项
   */
  emit<TData = unknown>(event: EventName, data?: TData, options?: IEventEmitOptions): Promise<void>;

  /**
   * 同步触发事件
   *
   * @param event 事件名
   * @param data 事件数据
   * @param options 发布选项
   */
  emitSync<TData = unknown>(
    event: EventName,
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
    events: EventName[],
    handler: EventHandler<TData>,
    options?: IEventOptions,
  ): Array<() => void>;

  /**
   * 检查是否存在特定事件的监听器
   *
   * @param event 事件名
   * @returns 是否有监听器
   */
  hasListeners(event: EventName): boolean;

  /**
   * 获取所有已注册的事件名称
   *
   * @returns 事件名称数组
   */
  getEventNames(): EventName[];

  /**
   * 移除所有事件监听器
   */
  removeAllListeners(): void;

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
 * 预定义的上传事件类型
 */
export enum UploadEventType {
  // 生命周期事件
  UPLOADER_INITIALIZED = 'uploader:initialized',
  UPLOADER_DESTROYED = 'uploader:destroyed',

  // 文件操作事件
  FILE_ADDED = 'file:added',
  FILE_REMOVED = 'file:removed',
  FILES_ADDED = 'files:added',

  // 上传状态事件
  UPLOAD_START = 'upload:start',
  UPLOAD_PROGRESS = 'upload:progress',
  UPLOAD_PAUSE = 'upload:pause',
  UPLOAD_RESUME = 'upload:resume',
  UPLOAD_CANCEL = 'upload:cancel',
  UPLOAD_SUCCESS = 'upload:success',
  UPLOAD_ERROR = 'upload:error',

  // 分片事件
  CHUNK_START = 'chunk:start',
  CHUNK_PROGRESS = 'chunk:progress',
  CHUNK_SUCCESS = 'chunk:success',
  CHUNK_ERROR = 'chunk:error',
  CHUNK_RETRY = 'chunk:retry',

  // 网络事件
  NETWORK_ONLINE = 'network:online',
  NETWORK_OFFLINE = 'network:offline',
  NETWORK_SPEED_CHANGE = 'network:speed_change',
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
 * 事件处理器超时错误
 */
export class HandlerTimeoutError extends Error {
  /**
   * 超时的事件名称
   */
  readonly eventName: EventName;

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
  constructor(event: EventName, timeout: number) {
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
  readonly eventName: EventName;

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
  constructor(event: EventName, originalError: unknown, handlerId?: string) {
    const idInfo = handlerId ? ` (处理器ID: ${handlerId})` : '';
    super(`事件处理器执行失败: ${event}${idInfo}`);
    this.name = 'EventHandlerError';
    this.originalError = originalError;
    this.eventName = event;
    this.handlerId = handlerId;
  }
}
