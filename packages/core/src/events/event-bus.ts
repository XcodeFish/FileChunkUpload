import {
  EventHandler,
  EventName,
  IEventEmitter,
  IEventOptions,
  Namespace,
} from '@file-chunk-uploader/types';

import { EventEmitter } from './event-emitter';

/**
 * 全局事件总线
 * 提供应用范围内的事件通信机制
 */
export class EventBus {
  private static instance: EventBus | null = null;
  private emitter: EventEmitter;

  /**
   * 创建事件总线实例
   * @param enableLogging 是否启用日志
   */
  private constructor(enableLogging = false) {
    this.emitter = new EventEmitter(enableLogging);
  }

  /**
   * 获取事件总线单例
   * @param enableLogging 是否启用日志
   * @returns 事件总线实例
   */
  public static getInstance(enableLogging = false): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus(enableLogging);
    }
    return EventBus.instance;
  }

  /**
   * 重置事件总线（主要用于测试）
   */
  public static reset(): void {
    if (EventBus.instance) {
      EventBus.instance.emitter.removeAllListeners();
      EventBus.instance = null;
    }
  }

  /**
   * 获取底层事件发射器
   * @returns 事件发射器
   */
  public getEmitter(): EventEmitter {
    return this.emitter;
  }

  /**
   * 创建命名空间事件发射器
   * @param namespace 命名空间
   * @returns 命名空间事件发射器
   */
  public createNamespaced(namespace: Namespace): IEventEmitter {
    return this.emitter.createNamespacedEmitter(namespace) as unknown as IEventEmitter;
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
    this.emitter.on(event, handler, options);
    return () => {
      this.off(event, handler);
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
    if (!events || events.length === 0) {
      return [];
    }

    return events.map(event => {
      this.emitter.on(event, handler, options);
      return () => {
        this.off(event, handler);
      };
    });
  }

  /**
   * 注册一次性事件监听器
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
    this.emitter.once(event, handler, options);
    return () => {
      this.off(event, handler);
    };
  }

  /**
   * 移除事件监听器
   * @param event 事件名
   * @param handler 可选的特定处理函数
   */
  public off<TData = unknown>(event: EventName, handler?: EventHandler<TData>): void {
    this.emitter.off(event, handler as EventHandler<unknown>);
  }

  /**
   * 异步触发事件
   * @param event 事件名
   * @param data 事件数据
   */
  public async emit<TData = unknown>(event: EventName, data?: TData): Promise<void> {
    await this.emitter.emit(event, data);
  }

  /**
   * 同步触发事件
   * @param event 事件名
   * @param data 事件数据
   */
  public emitSync<TData = unknown>(event: EventName, data?: TData): void {
    this.emitter.emitSync(event, data);
  }

  /**
   * 检查是否存在特定事件的监听器
   * @param event 事件名
   * @returns 是否有监听器
   */
  public hasListeners(event: EventName): boolean {
    return this.emitter.hasListeners(event);
  }

  /**
   * 获取所有已注册的事件名称
   * @returns 事件名称数组
   */
  public getEventNames(): EventName[] {
    return this.emitter.getEventNames() as unknown as EventName[];
  }

  /**
   * 移除所有事件监听器
   */
  public removeAllListeners(): void {
    this.emitter.removeAllListeners();
  }
}
