import { IEventOptions, IHook } from '@file-chunk-uploader/types';
/**
 * 钩子处理函数类型
 */
type HookHandler<TData, TResult> = (data: TData) => TResult | Promise<TResult>;
/**
 * 聚合钩子执行错误
 */
export declare class AggregateHookError extends Error {
  /**
   * 原始错误数组
   */
  readonly errors: unknown[];
  /**
   * 钩子名称
   */
  readonly hookName: string;
  /**
   * 创建聚合钩子错误
   * @param hookName 钩子名称
   * @param errors 错误数组
   */
  constructor(hookName: string, errors: unknown[]);
}
/**
 * 钩子系统实现
 * 提供注册和调用钩子函数的机制
 */
export declare class Hook<TData = unknown, TResult = void> implements IHook<TData, TResult> {
  private handlers;
  private options;
  private timeoutTimers;
  private sortedHandlers;
  private sortVersion;
  private logger?;
  private readonly name;
  /**
   * 创建钩子实例
   * @param name 钩子名称
   * @param enableLogging 是否启用日志
   */
  constructor(name: string, enableLogging?: boolean);
  /**
   * 注册钩子处理函数
   * @param handler 处理函数
   * @param options 选项
   * @returns 取消注册函数
   */
  register(handler: HookHandler<TData, TResult>, options?: IEventOptions): () => void;
  /**
   * 批量注册钩子处理函数
   * @param handlers 处理函数数组
   * @param options 选项
   * @returns 取消注册函数数组
   */
  registerBatch(
    handlers: Array<HookHandler<TData, TResult>>,
    options?: IEventOptions,
  ): Array<() => void>;
  /**
   * 执行所有钩子处理函数（顺序执行）
   * @param data 输入数据
   * @returns 所有处理函数的结果数组
   */
  call(data: TData): Promise<TResult[]>;
  /**
   * 并行执行所有钩子处理函数
   * @param data 输入数据
   * @returns 所有处理函数的结果数组
   * @throws {AggregateHookError} 如果有处理函数抛出错误
   */
  parallel(data: TData): Promise<TResult[]>;
  /**
   * 通过瀑布流方式调用钩子处理函数
   * 每个处理函数的输出作为下一个函数的输入
   * @param initialData 初始数据
   * @returns 最后一个处理函数的结果
   */
  waterfall(initialData: TData): Promise<TData>;
  /**
   * 移除钩子处理函数
   * @param handler 要移除的处理函数
   */
  unregister(handler: HookHandler<TData, TResult>): void;
  /**
   * 创建超时Promise
   * @param handler 处理函数
   * @param timeout 超时时间（毫秒）
   */
  private createTimeoutPromise;
  /**
   * 清除处理器超时定时器
   * @param handler 处理函数
   */
  private clearHandlerTimeout;
  /**
   * 按优先级排序处理函数
   */
  private getSortedHandlers;
  /**
   * 类型守卫：检查瀑布流处理结果是否有效
   * @param result 瀑布流处理结果
   */
  private isValidWaterfallResult;
  /**
   * 记录调试日志
   * @param message 消息
   * @param data 数据
   */
  private logDebug;
  /**
   * 记录错误日志
   * @param message 消息
   * @param data 数据
   */
  private logError;
}
export {};
//# sourceMappingURL=hooks.d.ts.map
