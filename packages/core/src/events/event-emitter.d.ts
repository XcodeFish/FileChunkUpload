import {
  EventHandler,
  EventName,
  IEventEmitOptions,
  IEventEmitter,
  IEventListener,
  IEventOptions,
  Namespace,
} from '@file-chunk-uploader/types';
/**
 * 事件发射器实现
 */
export declare class EventEmitter implements IEventEmitter {
  private events;
  private logger?;
  private timeoutTimers;
  private sortedHandlersCache;
  private sortVersions;
  private namespace?;
  /**
   * 创建事件发射器
   * @param enableLogging 是否启用日志记录
   * @param namespace 指定命名空间
   */
  constructor(enableLogging?: boolean, namespace?: Namespace);
  /**
   * 创建命名空间事件发射器
   * @param namespace 命名空间
   * @returns 命名空间事件发射器
   */
  createNamespacedEmitter(namespace: Namespace): IEventEmitter;
  /**
   * 注册事件监听器
   * @param event 事件名
   * @param handler 事件处理函数
   * @param options 选项
   * @returns this 实例，用于链式调用
   */
  on<TData = unknown>(
    event: EventName,
    handler: EventHandler<TData>,
    options?: IEventOptions,
  ): this;
  /**
   * 批量注册事件监听器
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
   * 注册只执行一次的事件监听器
   * @param event 事件名
   * @param handler 事件处理函数
   * @param options 选项
   * @returns this 实例，用于链式调用
   */
  once<TData = unknown>(
    event: EventName,
    handler: EventHandler<TData>,
    options?: Omit<IEventOptions, 'once'>,
  ): this;
  /**
   * 移除事件监听器
   * @param event 事件名
   * @param handler 可选的特定处理函数
   * @returns this 实例，用于链式调用
   */
  off(event: EventName, handler?: EventHandler<unknown>): this;
  /**
   * 移除特定处理函数
   * @param event 事件名
   * @param handler 处理函数
   */
  private removeHandler;
  /**
   * 异步触发事件
   * @param event 事件名
   * @param data 事件数据
   * @param options 发布选项
   */
  emit<TData = unknown>(event: EventName, data?: TData, options?: IEventEmitOptions): Promise<void>;
  /**
   * 执行事件处理器
   * @param event 事件名
   * @param data 事件数据
   * @param context 事件上下文
   */
  private executeHandlers;
  /**
   * 同步触发事件
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
   * 检查是否存在特定事件的监听器
   * @param event 事件名
   * @returns 是否有监听器
   */
  hasListeners(event: EventName): boolean;
  /**
   * 获取事件监听器
   * @param eventName 事件名称
   * @returns 该事件的所有监听器
   */
  listeners(eventName: string): Array<IEventListener>;
  /**
   * 获取所有已注册的事件名称
   * @returns 事件名称数组
   */
  getEventNames(): EventName[];
  /**
   * 获取已排序的事件处理器
   * @param event 事件名称
   * @returns 已排序的处理器数组
   */
  private getSortedHandlers;
  /**
   * 移除所有事件监听器
   * @param eventName 可选的事件名称，如不提供则移除所有事件监听器
   * @returns this 实例，用于链式调用
   */
  removeAllListeners(eventName?: string): this;
  /**
   * 创建超时Promise
   * @param handler 处理函数
   * @param event 事件名
   * @param timeout 超时时间（毫秒）
   * @param _handlerId 处理器ID
   */
  private createTimeoutPromise;
  /**
   * 清除处理器超时定时器
   * @param handler 处理函数
   */
  private clearHandlerTimeout;
  /**
   * 记录调试日志
   * @param message 消息
   * @param data 数据
   */
  private logDebug;
  /**
   * 记录警告日志
   * @param message 消息
   * @param data 数据
   */
  private logWarn;
  /**
   * 记录错误日志
   * @param message 消息
   * @param data 数据
   */
  private logError;
}
//# sourceMappingURL=event-emitter.d.ts.map
