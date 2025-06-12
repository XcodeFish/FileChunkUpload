/**
 * 事件系统模块入口
 * 提供事件发射、订阅、钩子机制等功能
 *
 * @example
 * ```typescript
 * // 使用全局事件总线
 * import { eventBus, UploadEventType } from '@file-chunk-upload/core/events';
 *
 * // 订阅事件
 * const unsubscribe = eventBus.on(UploadEventType.UPLOAD_PROGRESS, (data) => {
 *   console.log(`上传进度: ${data.progress}%`);
 * });
 *
 * // 触发事件
 * eventBus.emit(UploadEventType.UPLOAD_PROGRESS, { progress: 50 });
 *
 * // 取消订阅
 * unsubscribe();
 * ```
 */
import { EventBus } from './event-bus';
import { EventEmitter } from './event-emitter';
import { Hook } from './hooks';
import {
  IEventEmitter,
  EventHandler,
  IEventOptions,
  IHook,
  UploadEventType,
  HookType,
  EventName,
  Namespace,
  NamespacedEvent,
  HandlerTimeoutError,
  IEventHandlerWithPriority,
} from './types';

// 导出实现类
export {
  EventEmitter,
  EventBus,
  Hook,

  // 枚举类型
  UploadEventType,
  HookType,

  // 错误类型
  HandlerTimeoutError,
};

// 导出类型定义
export type {
  IEventEmitter,
  EventHandler,
  IEventOptions,
  IHook,
  EventName,
  Namespace,
  NamespacedEvent,
  IEventHandlerWithPriority,
};

/**
 * 创建全局事件总线实例
 * 整个应用共享一个事件总线实例，便于模块间通信
 */
export const eventBus = EventBus.getInstance();

/**
 * 创建命名空间事件总线工厂函数
 * 用于创建特定命名空间的事件发射器
 *
 * @param namespace 命名空间
 * @returns 命名空间下的事件发射器
 *
 * @example
 * ```typescript
 * // 创建上传模块命名空间事件发射器
 * const uploadEvents = createNamespacedEvents('upload');
 *
 * // 在命名空间下订阅事件
 * uploadEvents.on('progress', (data) => {
 *   console.log(`上传进度: ${data.progress}%`);
 * });
 *
 * // 在命名空间下触发事件
 * uploadEvents.emit('progress', { progress: 50 });
 * ```
 */
export function createNamespacedEvents(namespace: Namespace): IEventEmitter {
  if (!namespace || namespace.trim() === '') {
    throw new Error('命名空间不能为空');
  }
  return eventBus.createNamespaced(namespace);
}

/**
 * 创建事件名称带命名空间
 *
 * @param namespace 命名空间
 * @param eventName 事件名称
 * @returns 带命名空间的事件名称
 *
 * @example
 * ```typescript
 * const event = createNamespacedEventName('upload', 'progress');
 * // 结果: "upload:progress"
 * ```
 */
export function createNamespacedEventName<T extends string>(
  namespace: Namespace,
  eventName: T,
): NamespacedEvent<T> {
  if (!namespace || namespace.trim() === '') {
    throw new Error('命名空间不能为空');
  }
  if (!eventName || eventName.trim() === '') {
    throw new Error('事件名称不能为空');
  }
  return `${namespace}:${eventName}`;
}

/**
 * 快速创建一个钩子实例
 *
 * @param hookName 钩子名称
 * @param enableLogging 是否启用日志
 * @returns 钩子实例
 *
 * @example
 * ```typescript
 * // 创建上传前钩子
 * const beforeUploadHook = createHook('beforeUpload');
 *
 * // 注册处理函数
 * beforeUploadHook.register((file) => {
 *   // 在上传前处理文件
 *   return file;
 * });
 *
 * // 以瀑布流方式调用钩子
 * const processedFile = await beforeUploadHook.waterfall(originalFile);
 * ```
 */
export function createHook<TData = unknown, TResult = void>(
  hookName: string,
  enableLogging = false,
): IHook<TData, TResult> {
  return new Hook<TData, TResult>(hookName, enableLogging);
}
