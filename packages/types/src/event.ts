/**
 * 事件系统类型定义
 * 包含事件发射器和事件类型
 * @packageDocumentation
 */
import { IFileInfo, IUploadProgress, IUploadResult } from './base';
import { IRetryFailedInfo, IRetryStartInfo, IRetrySuccessInfo } from './plugin';

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
}

/**
 * 事件处理函数类型
 * 表示事件监听回调函数
 */
export type EventHandler<T = unknown> = (data: T) => void;

/**
 * 事件选项接口
 * 配置事件监听器的行为
 */
export interface IEventOptions {
  /** 是否只触发一次 */
  once?: boolean;
  /** 事件优先级 */
  priority?: number;
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
  once<T>(eventName: string, handler: EventHandler<T>, options?: IEventOptions): this;

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
   * @returns 是否有监听器被触发
   */
  emit<T>(eventName: string, data?: T): boolean;

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
}
