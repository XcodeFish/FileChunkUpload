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
export declare class EventBus {
  private static instance;
  private emitter;
  /**
   * 创建事件总线实例
   * @param enableLogging 是否启用日志
   */
  private constructor();
  /**
   * 获取事件总线单例
   * @param enableLogging 是否启用日志
   * @returns 事件总线实例
   */
  static getInstance(enableLogging?: boolean): EventBus;
  /**
   * 重置事件总线（主要用于测试）
   */
  static reset(): void;
  /**
   * 获取底层事件发射器
   * @returns 事件发射器
   */
  getEmitter(): EventEmitter;
  /**
   * 创建命名空间事件发射器
   * @param namespace 命名空间
   * @returns 命名空间事件发射器
   */
  createNamespaced(namespace: Namespace): IEventEmitter;
  /**
   * 注册事件监听器
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
   * 注册一次性事件监听器
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
   * @param event 事件名
   * @param handler 可选的特定处理函数
   */
  off<TData = unknown>(event: EventName, handler?: EventHandler<TData>): void;
  /**
   * 异步触发事件
   * @param event 事件名
   * @param data 事件数据
   */
  emit<TData = unknown>(event: EventName, data?: TData): Promise<void>;
  /**
   * 同步触发事件
   * @param event 事件名
   * @param data 事件数据
   */
  emitSync<TData = unknown>(event: EventName, data?: TData): void;
  /**
   * 检查是否存在特定事件的监听器
   * @param event 事件名
   * @returns 是否有监听器
   */
  hasListeners(event: EventName): boolean;
  /**
   * 获取所有已注册的事件名称
   * @returns 事件名称数组
   */
  getEventNames(): EventName[];
  /**
   * 移除所有事件监听器
   */
  removeAllListeners(): void;
}
//# sourceMappingURL=event-bus.d.ts.map
