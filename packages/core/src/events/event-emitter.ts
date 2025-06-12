import { Logger } from '../developer-mode/logger';
import { LogLevel } from '../developer-mode/types';

import {
  EventHandler,
  EventHandlerError,
  EventName,
  HandlerTimeoutError,
  IEventContext,
  IEventEmitOptions,
  IEventEmitter,
  IEventHandlerWithPriority,
  IEventOptions,
  Namespace,
  NamespacedEvent,
} from './types';

/**
 * 默认事件选项
 */
const DEFAULT_EVENT_OPTIONS: IEventOptions = {
  once: false,
  priority: 10,
  filter: () => true,
  timeout: 30000, // 默认30秒超时
  catchError: true,
};

/**
 * 创建上下文对象
 */
function createEventContext(
  eventName: EventName,
  options?: IEventEmitOptions,
  namespace?: Namespace,
): IEventContext {
  // 用于控制事件传播
  let propagationStopped = false;

  return {
    eventName,
    timestamp: Date.now(),
    source: options?.source,
    meta: options?.meta || {},
    namespace,
    stopPropagation: () => {
      propagationStopped = true;
    },
    isPropagationStopped: () => propagationStopped,
  };
}

/**
 * 命名空间事件发射器
 * 提供命名空间隔离的事件机制
 */
class NamespacedEventEmitter implements IEventEmitter {
  private parentEmitter: EventEmitter;
  private namespace: Namespace;

  /**
   * 创建命名空间事件发射器
   * @param parent 父事件发射器
   * @param namespace 命名空间
   */
  constructor(parent: EventEmitter, namespace: Namespace) {
    this.parentEmitter = parent;
    this.namespace = namespace;
  }

  /**
   * 创建带命名空间的事件名称
   * @param event 原始事件名
   * @returns 带命名空间的事件名
   */
  private namespacedEvent(event: EventName): NamespacedEvent<string> {
    return `${this.namespace}:${event}`;
  }

  on<TData = unknown>(
    event: EventName,
    handler: EventHandler<TData>,
    options?: IEventOptions,
  ): () => void {
    return this.parentEmitter.on(this.namespacedEvent(event), handler, options);
  }

  once<TData = unknown>(
    event: EventName,
    handler: EventHandler<TData>,
    options?: Omit<IEventOptions, 'once'>,
  ): () => void {
    return this.parentEmitter.once(this.namespacedEvent(event), handler, options);
  }

  off<TData = unknown>(event: EventName, handler?: EventHandler<TData>): void {
    this.parentEmitter.off(this.namespacedEvent(event), handler);
  }

  async emit<TData = unknown>(
    event: EventName,
    data?: TData,
    options?: IEventEmitOptions,
  ): Promise<void> {
    const namespacedEvent = this.namespacedEvent(event);

    // 创建命名空间相关的发布选项
    const namespacedOptions: IEventEmitOptions = {
      ...options,
      // 添加命名空间标识
      meta: {
        ...(options?.meta || {}),
        namespace: this.namespace,
      },
    };

    await this.parentEmitter.emit(namespacedEvent, data, namespacedOptions);

    // 如果没有设置仅命名空间触发，则同时触发全局事件
    if (!options?.namespaceOnly) {
      // 标记是来自命名空间的事件
      const globalOptions: IEventEmitOptions = {
        ...options,
        meta: {
          ...(options?.meta || {}),
          namespace: this.namespace,
          fromNamespace: true,
        },
      };

      await this.parentEmitter.emit(event, data, globalOptions);
    }
  }

  emitSync<TData = unknown>(
    event: EventName,
    data?: TData,
    options?: Omit<IEventEmitOptions, 'sync'>,
  ): void {
    const namespacedEvent = this.namespacedEvent(event);

    // 创建命名空间相关的发布选项
    const namespacedOptions: Omit<IEventEmitOptions, 'sync'> = {
      ...options,
      // 添加命名空间标识
      meta: {
        ...(options?.meta || {}),
        namespace: this.namespace,
      },
    };

    this.parentEmitter.emitSync(namespacedEvent, data, namespacedOptions);

    // 如果没有设置仅命名空间触发，则同时触发全局事件
    if (!options?.namespaceOnly) {
      // 标记是来自命名空间的事件
      const globalOptions: Omit<IEventEmitOptions, 'sync'> = {
        ...options,
        meta: {
          ...(options?.meta || {}),
          namespace: this.namespace,
          fromNamespace: true,
        },
      };

      this.parentEmitter.emitSync(event, data, globalOptions);
    }
  }

  onBatch<TData = unknown>(
    events: EventName[],
    handler: EventHandler<TData>,
    options?: IEventOptions,
  ): Array<() => void> {
    return events.map(event => this.on(event, handler, options));
  }

  hasListeners(event: EventName): boolean {
    return this.parentEmitter.hasListeners(this.namespacedEvent(event));
  }

  getEventNames(): EventName[] {
    const prefix = `${this.namespace}:`;
    return this.parentEmitter
      .getEventNames()
      .filter(name => name.startsWith(prefix))
      .map(name => name.substring(prefix.length) as EventName);
  }

  removeAllListeners(): void {
    const prefix = `${this.namespace}:`;
    const namespacedEvents = this.parentEmitter
      .getEventNames()
      .filter(name => name.startsWith(prefix));

    namespacedEvents.forEach(event => {
      this.parentEmitter.off(event);
    });
  }

  createNamespacedEmitter(namespace: Namespace): IEventEmitter {
    // 嵌套命名空间，使用冒号连接
    return new NamespacedEventEmitter(this.parentEmitter, `${this.namespace}:${namespace}`);
  }
}

/**
 * 事件发射器实现
 */
export class EventEmitter implements IEventEmitter {
  private events: Map<EventName, IEventHandlerWithPriority[]> = new Map();
  private logger?: Logger;
  // 使用WeakMap存储超时定时器，当处理器被垃圾回收时，不会阻止回收
  private timeoutTimers: WeakMap<EventHandler<unknown>, NodeJS.Timeout> = new WeakMap();
  // 缓存排序后的处理器列表，提高性能
  private sortedHandlersCache: Map<
    EventName,
    {
      version: number;
      handlers: IEventHandlerWithPriority[];
    }
  > = new Map();
  private sortVersions: Map<EventName, number> = new Map();
  // 命名空间相关
  private namespace?: Namespace;

  /**
   * 创建事件发射器
   * @param enableLogging 是否启用日志记录
   * @param namespace 指定命名空间
   */
  constructor(enableLogging = false, namespace?: Namespace) {
    if (enableLogging) {
      this.logger = new Logger({
        level: LogLevel.DEBUG,
        colorize: true,
      });
    }
    this.namespace = namespace;
  }

  /**
   * 创建命名空间事件发射器
   * @param namespace 命名空间
   * @returns 命名空间事件发射器
   */
  public createNamespacedEmitter(namespace: Namespace): IEventEmitter {
    return new NamespacedEventEmitter(this, namespace);
  }

  /**
   * 注册事件监听器
   * @param event 事件名
   * @param handler 事件处理函数
   * @param options 选项
   * @returns 取消订阅函数
   */
  public on<TData = unknown>(
    event: EventName,
    handler: EventHandler<TData>,
    options?: IEventOptions,
  ): () => void {
    const finalOptions: IEventOptions = { ...DEFAULT_EVENT_OPTIONS, ...options };

    // 生成唯一ID（如果没有提供）
    if (!finalOptions.id) {
      finalOptions.id = `handler_${Math.random().toString(36).substring(2, 9)}`;
    }

    // 确保事件处理器数组存在
    if (!this.events.has(event)) {
      this.events.set(event, []);
      this.sortVersions.set(event, 0);
    } else {
      // 增加排序版本，使缓存失效
      const version = (this.sortVersions.get(event) || 0) + 1;
      this.sortVersions.set(event, version);
      this.sortedHandlersCache.delete(event);
    }

    const handlers = this.events.get(event)!;

    // 创建处理器包装对象
    const handlerWithPriority: IEventHandlerWithPriority = {
      handler: handler as EventHandler<unknown>,
      priority: finalOptions.priority!,
      once: finalOptions.once!,
      filter: finalOptions.filter,
      timeout: finalOptions.timeout,
      context: finalOptions.context,
      id: finalOptions.id,
    };

    handlers.push(handlerWithPriority);

    this.logDebug(`注册事件处理函数: ${event}`, {
      priority: finalOptions.priority,
      once: finalOptions.once,
      handlerId: finalOptions.id,
    });

    // 返回取消订阅函数
    return () => {
      this.removeHandler(event, handler as EventHandler<unknown>);
    };
  }

  /**
   * 批量注册事件监听器
   * @param events 事件名称数组
   * @param handler 事件处理函数
   * @param options 选项
   * @returns 取消订阅函数数组
   */
  public onBatch<TData = unknown>(
    events: EventName[],
    handler: EventHandler<TData>,
    options?: IEventOptions,
  ): Array<() => void> {
    return events.map(event => this.on(event, handler, options));
  }

  /**
   * 注册只执行一次的事件监听器
   * @param event 事件名
   * @param handler 事件处理函数
   * @param options 选项
   * @returns 取消订阅函数
   */
  public once<TData = unknown>(
    event: EventName,
    handler: EventHandler<TData>,
    options?: Omit<IEventOptions, 'once'>,
  ): () => void {
    return this.on(event, handler, { ...options, once: true });
  }

  /**
   * 移除事件监听器
   * @param event 事件名
   * @param handler 可选的特定处理函数
   */
  public off<TData = unknown>(event: EventName, handler?: EventHandler<TData>): void {
    if (!this.events.has(event)) return;

    if (!handler) {
      // 如果没有指定处理函数，则移除此事件的所有监听器
      const handlers = this.events.get(event)!;

      // 清除所有相关的超时定时器
      handlers.forEach(h => {
        const handler = h.handler as EventHandler<unknown>;
        this.clearHandlerTimeout(handler);
      });

      this.events.delete(event);
      this.sortedHandlersCache.delete(event);
      this.logDebug(`移除所有事件处理函数: ${event}`);
    } else {
      this.removeHandler(event, handler as EventHandler<unknown>);
    }
  }

  /**
   * 移除特定处理函数
   * @param event 事件名
   * @param handler 处理函数
   */
  private removeHandler(event: EventName, handler: EventHandler<unknown>): void {
    if (!this.events.has(event)) return;

    const handlers = this.events.get(event)!;
    const index = handlers.findIndex(h => h.handler === handler);

    if (index !== -1) {
      // 清除相关的超时定时器
      this.clearHandlerTimeout(handler);

      handlers.splice(index, 1);

      // 增加排序版本，使缓存失效
      const version = (this.sortVersions.get(event) || 0) + 1;
      this.sortVersions.set(event, version);
      this.sortedHandlersCache.delete(event);

      this.logDebug(`移除事件处理函数: ${event}`);

      // 如果没有处理函数了，删除整个事件条目
      if (handlers.length === 0) {
        this.events.delete(event);
      }
    }
  }

  /**
   * 异步触发事件
   * @param event 事件名
   * @param data 事件数据
   * @param options 发布选项
   */
  public async emit<TData = unknown>(
    event: EventName,
    data?: TData,
    options?: IEventEmitOptions,
  ): Promise<void> {
    if (!this.events.has(event)) {
      this.logDebug(`触发事件（没有监听器）: ${event}`);
      return;
    }

    this.logDebug(`异步触发事件: ${event}`);

    // 创建事件上下文
    const context = createEventContext(event, options, this.namespace);

    // 判断是否需要使用全局超时
    if (options?.timeout && options.timeout > 0) {
      try {
        // 使用Promise.race实现整体超时控制
        await Promise.race([
          this.executeHandlers(event, data, context),
          new Promise((_, reject) => {
            setTimeout(() => {
              reject(new HandlerTimeoutError(event, options.timeout!));
            }, options.timeout);
          }),
        ]);
      } catch (error) {
        if (error instanceof HandlerTimeoutError) {
          this.logWarn(`事件整体执行超时: ${event}`, { timeout: options.timeout });
        } else {
          this.logError(`事件处理过程中发生错误: ${event}`, { error });
        }
      }
    } else {
      // 普通执行，无整体超时控制
      await this.executeHandlers(event, data, context);
    }
  }

  /**
   * 执行事件处理器
   * @param event 事件名
   * @param data 事件数据
   * @param context 事件上下文
   */
  private async executeHandlers<TData>(
    event: EventName,
    data?: TData,
    context?: IEventContext,
  ): Promise<void> {
    const sortedHandlers = this.getSortedHandlers(event);
    const onceHandlers: EventHandler<unknown>[] = [];
    // 收集所有错误
    const errors: Array<{ error: unknown; handlerId?: string }> = [];

    for (const handlerInfo of sortedHandlers) {
      // 检查事件传播是否已停止
      if (context && (context as any).isPropagationStopped?.()) {
        this.logDebug(`事件传播已停止: ${event}`);
        break;
      }

      // 检查过滤条件
      if (handlerInfo.filter && !handlerInfo.filter(data as unknown)) {
        continue;
      }

      // 收集一次性处理函数
      if (handlerInfo.once) {
        onceHandlers.push(handlerInfo.handler);
      }

      try {
        this.logDebug(`执行事件处理函数: ${event}`, {
          priority: handlerInfo.priority,
          handlerId: handlerInfo.id,
        });
        const startTime = performance.now();

        // 设置超时处理
        const timeoutPromise = this.createTimeoutPromise(
          handlerInfo.handler,
          event,
          handlerInfo.timeout,
          handlerInfo.id,
        );

        // 执行处理函数并等待结果或超时
        await Promise.race([
          // 绑定上下文
          Promise.resolve(handlerInfo.handler.call(handlerInfo.context, data as unknown, context)),
          timeoutPromise,
        ]);

        // 清理超时定时器
        this.clearHandlerTimeout(handlerInfo.handler);

        const duration = performance.now() - startTime;
        this.logDebug(`事件处理函数完成: ${event}`, {
          duration,
          priority: handlerInfo.priority,
          handlerId: handlerInfo.id,
        });
      } catch (error) {
        // 清理超时定时器
        this.clearHandlerTimeout(handlerInfo.handler);

        // 处理错误，根据选项决定是否继续执行后续处理器
        const catchError = handlerInfo.catchError !== undefined ? handlerInfo.catchError : true;

        if (error instanceof HandlerTimeoutError) {
          this.logError(`事件处理函数超时: ${event}`, {
            error,
            timeout: handlerInfo.timeout,
            handlerId: handlerInfo.id,
          });

          // 收集错误
          errors.push({
            error,
            handlerId: handlerInfo.id,
          });
        } else {
          // 创建事件处理器错误
          const handlerError = new EventHandlerError(event, error, handlerInfo.id);

          this.logError(`事件处理函数异常: ${event}`, {
            error: handlerError,
            handlerId: handlerInfo.id,
          });

          // 收集错误
          errors.push({
            error: handlerError,
            handlerId: handlerInfo.id,
          });

          // 如果设置不捕获错误，则向上抛出
          if (!catchError) {
            throw handlerError;
          }
        }
      }
    }

    // 移除一次性处理函数
    for (const handler of onceHandlers) {
      this.removeHandler(event, handler);
    }

    // 如果有错误且上下文中有错误处理回调，则调用回调
    if (errors.length > 0 && context?.meta?.errorCallback) {
      try {
        const errorCallback = context.meta.errorCallback as (
          errors: Array<{ error: unknown; handlerId?: string }>,
        ) => void;
        errorCallback(errors);
      } catch (callbackError) {
        this.logError(`错误回调执行失败: ${event}`, { error: callbackError });
      }
    }
  }

  /**
   * 同步触发事件
   * @param event 事件名
   * @param data 事件数据
   * @param options 发布选项
   */
  public emitSync<TData = unknown>(
    event: EventName,
    data?: TData,
    options?: Omit<IEventEmitOptions, 'sync'>,
  ): void {
    if (!this.events.has(event)) {
      this.logDebug(`同步触发事件（没有监听器）: ${event}`);
      return;
    }

    this.logDebug(`同步触发事件: ${event}`);

    // 创建事件上下文
    const context = createEventContext(event, options as IEventEmitOptions, this.namespace);

    const sortedHandlers = this.getSortedHandlers(event);
    const onceHandlers: EventHandler<unknown>[] = [];
    // 收集所有错误
    const errors: Array<{ error: unknown; handlerId?: string }> = [];

    for (const handlerInfo of sortedHandlers) {
      // 检查事件传播是否已停止
      if (context && (context as any).isPropagationStopped?.()) {
        this.logDebug(`事件传播已停止: ${event}`);
        break;
      }

      // 检查过滤条件
      if (handlerInfo.filter && !handlerInfo.filter(data as unknown)) {
        continue;
      }

      // 收集一次性处理函数
      if (handlerInfo.once) {
        onceHandlers.push(handlerInfo.handler);
      }

      try {
        this.logDebug(`同步执行事件处理函数: ${event}`, {
          priority: handlerInfo.priority,
          handlerId: handlerInfo.id,
        });
        const startTime = performance.now();

        // 同步执行处理函数
        handlerInfo.handler.call(handlerInfo.context, data as unknown, context);

        const duration = performance.now() - startTime;
        this.logDebug(`同步事件处理函数完成: ${event}`, {
          duration,
          priority: handlerInfo.priority,
          handlerId: handlerInfo.id,
        });
      } catch (error) {
        // 处理错误，根据选项决定是否继续执行后续处理器
        const catchError = handlerInfo.catchError !== undefined ? handlerInfo.catchError : true;

        const handlerError = new EventHandlerError(event, error, handlerInfo.id);

        this.logError(`同步事件处理函数异常: ${event}`, {
          error: handlerError,
          handlerId: handlerInfo.id,
        });

        // 收集错误
        errors.push({
          error: handlerError,
          handlerId: handlerInfo.id,
        });

        // 如果设置不捕获错误，则向上抛出
        if (!catchError) {
          throw handlerError;
        }
      }
    }

    // 移除一次性处理函数
    for (const handler of onceHandlers) {
      this.removeHandler(event, handler);
    }

    // 如果有错误且上下文中有错误处理回调，则调用回调
    if (errors.length > 0 && context?.meta?.errorCallback) {
      try {
        const errorCallback = context.meta.errorCallback as (
          errors: Array<{ error: unknown; handlerId?: string }>,
        ) => void;
        errorCallback(errors);
      } catch (callbackError) {
        this.logError(`错误回调执行失败: ${event}`, { error: callbackError });
      }
    }
  }

  /**
   * 检查是否存在特定事件的监听器
   * @param event 事件名
   * @returns 是否有监听器
   */
  public hasListeners(event: EventName): boolean {
    return this.events.has(event) && this.events.get(event)!.length > 0;
  }

  /**
   * 获取所有已注册的事件名称
   * @returns 事件名称数组
   */
  public getEventNames(): EventName[] {
    return Array.from(this.events.keys());
  }

  /**
   * 获取已排序的事件处理器
   * @param event 事件名称
   * @returns 已排序的处理器数组
   */
  private getSortedHandlers(event: EventName): IEventHandlerWithPriority[] {
    if (!this.events.has(event)) {
      return [];
    }

    const currentVersion = this.sortVersions.get(event) || 0;
    const cachedResult = this.sortedHandlersCache.get(event);

    // 如果缓存有效，直接返回
    if (cachedResult && cachedResult.version === currentVersion) {
      return cachedResult.handlers;
    }

    // 重新排序
    const handlers = this.events.get(event)!;
    const sorted = [...handlers].sort((a, b) => a.priority - b.priority);

    // 更新缓存
    this.sortedHandlersCache.set(event, {
      version: currentVersion,
      handlers: sorted,
    });

    return sorted;
  }

  /**
   * 移除所有事件监听器
   */
  public removeAllListeners(): void {
    // 清除所有超时定时器
    this.events.forEach((handlers, event) => {
      handlers.forEach(h => {
        this.clearHandlerTimeout(h.handler);
      });
      this.logDebug(`移除所有事件处理函数: ${event}`);
    });

    // 清空事件映射
    this.events.clear();
    this.sortedHandlersCache.clear();
    this.sortVersions.clear();
    this.logDebug('移除所有事件监听器');
  }

  /**
   * 创建超时Promise
   * @param handler 处理函数
   * @param event 事件名
   * @param timeout 超时时间（毫秒）
   * @param _handlerId 处理器ID
   */
  private createTimeoutPromise(
    handler: EventHandler<unknown>,
    event: EventName,
    timeout?: number,
    _handlerId?: string,
  ): Promise<never> {
    if (!timeout || timeout <= 0) return new Promise(() => {});

    return new Promise((_, reject) => {
      const timer = setTimeout(() => {
        reject(new HandlerTimeoutError(event, timeout));
      }, timeout);

      this.timeoutTimers.set(handler, timer);
    });
  }

  /**
   * 清除处理器超时定时器
   * @param handler 处理函数
   */
  private clearHandlerTimeout(handler: EventHandler<unknown>): void {
    const timer = this.timeoutTimers.get(handler);
    if (timer) {
      clearTimeout(timer);
      this.timeoutTimers.delete(handler);
    }
  }

  /**
   * 记录调试日志
   * @param message 消息
   * @param data 数据
   */
  private logDebug(message: string, data?: unknown): void {
    this.logger?.debug('event', message, data);
  }

  /**
   * 记录警告日志
   * @param message 消息
   * @param data 数据
   */
  private logWarn(message: string, data?: unknown): void {
    this.logger?.warn('event', message, data);
  }

  /**
   * 记录错误日志
   * @param message 消息
   * @param data 数据
   */
  private logError(message: string, data?: unknown): void {
    this.logger?.error('event', message, data);
  }
}
