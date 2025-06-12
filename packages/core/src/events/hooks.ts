import { Logger } from '../developer-mode/logger';
import { LogLevel } from '../developer-mode/types';

import { EventName, HandlerTimeoutError, IEventOptions, IHook } from './types';

/**
 * 默认钩子选项
 */
const DEFAULT_HOOK_OPTIONS: IEventOptions = {
  once: false,
  priority: 10,
  filter: () => true,
  timeout: 30000, // 默认30秒超时
};

/**
 * 钩子处理函数类型
 */
type HookHandler<TData, TResult> = (data: TData) => TResult | Promise<TResult>;

/**
 * 聚合钩子执行错误
 */
export class AggregateHookError extends Error {
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
  constructor(hookName: string, errors: unknown[]) {
    super(`钩子执行过程中发生 ${errors.length} 个错误: ${hookName}`);
    this.name = 'AggregateHookError';
    this.errors = errors;
    this.hookName = hookName;
  }
}

/**
 * 钩子系统实现
 * 提供注册和调用钩子函数的机制
 */
export class Hook<TData = unknown, TResult = void> implements IHook<TData, TResult> {
  private handlers: Array<HookHandler<TData, TResult>> = [];
  private options: Map<HookHandler<TData, TResult>, IEventOptions> = new Map();
  // 使用WeakMap存储超时定时器，当处理器被垃圾回收时，不会阻止回收
  private timeoutTimers: WeakMap<HookHandler<TData, TResult>, NodeJS.Timeout> = new WeakMap();
  // 缓存排序后的处理器列表，提高性能
  private sortedHandlers: Array<HookHandler<TData, TResult>> | null = null;
  private sortVersion = 0;
  private logger?: Logger;
  private readonly name: string;

  /**
   * 创建钩子实例
   * @param name 钩子名称
   * @param enableLogging 是否启用日志
   */
  constructor(name: string, enableLogging = false) {
    this.name = name;

    if (enableLogging) {
      this.logger = new Logger({
        level: LogLevel.DEBUG,
        colorize: true,
      });
    }
  }

  /**
   * 注册钩子处理函数
   * @param handler 处理函数
   * @param options 选项
   * @returns 取消注册函数
   */
  public register(handler: HookHandler<TData, TResult>, options?: IEventOptions): () => void {
    const finalOptions = { ...DEFAULT_HOOK_OPTIONS, ...options };

    this.handlers.push(handler);
    this.options.set(handler, finalOptions);

    // 增加排序版本，使缓存失效
    this.sortVersion++;
    this.sortedHandlers = null;

    this.logDebug(`注册钩子处理函数: ${this.name}`, {
      priority: finalOptions.priority,
      once: finalOptions.once,
      hasFilter: !!finalOptions.filter,
      timeout: finalOptions.timeout,
    });

    // 返回取消注册函数
    return () => this.unregister(handler);
  }

  /**
   * 批量注册钩子处理函数
   * @param handlers 处理函数数组
   * @param options 选项
   * @returns 取消注册函数数组
   */
  public registerBatch(
    handlers: Array<HookHandler<TData, TResult>>,
    options?: IEventOptions,
  ): Array<() => void> {
    return handlers.map(handler => this.register(handler, options));
  }

  /**
   * 执行所有钩子处理函数（顺序执行）
   * @param data 输入数据
   * @returns 所有处理函数的结果数组
   */
  public async call(data: TData): Promise<TResult[]> {
    const results: TResult[] = [];
    const onceHandlers: Array<HookHandler<TData, TResult>> = [];

    this.logDebug(`调用钩子: ${this.name}`, data);

    // 获取已排序的处理函数
    const currentHandlers = this.getSortedHandlers();

    for (const handler of currentHandlers) {
      const options = this.options.get(handler)!;

      // 检查过滤条件
      if (options.filter && !options.filter(data)) {
        continue;
      }

      // 收集一次性处理函数
      if (options.once) {
        onceHandlers.push(handler);
      }

      try {
        this.logDebug(`执行钩子处理函数: ${this.name}`, { priority: options.priority });
        const startTime = performance.now();

        // 设置超时处理
        const timeoutPromise = this.createTimeoutPromise(handler, options.timeout);

        // 执行处理函数并等待结果或超时
        const result = await Promise.race([Promise.resolve(handler(data)), timeoutPromise]);

        // 清理超时定时器
        this.clearHandlerTimeout(handler);

        results.push(result);

        const duration = performance.now() - startTime;
        this.logDebug(`钩子处理函数完成: ${this.name}`, {
          duration,
          priority: options.priority,
        });
      } catch (error) {
        // 清理超时定时器
        this.clearHandlerTimeout(handler);

        // 记录错误
        if (error instanceof HandlerTimeoutError) {
          this.logError(`钩子处理函数超时: ${this.name}`, {
            error,
            timeout: options.timeout,
          });
        } else {
          this.logError(`钩子处理函数异常: ${this.name}`, { error });
        }
        // 继续执行其他处理函数
      }
    }

    // 移除一次性处理函数
    for (const handler of onceHandlers) {
      this.unregister(handler);
    }

    return results;
  }

  /**
   * 并行执行所有钩子处理函数
   * @param data 输入数据
   * @returns 所有处理函数的结果数组
   * @throws {AggregateHookError} 如果有处理函数抛出错误
   */
  public async parallel(data: TData): Promise<TResult[]> {
    const onceHandlers: Array<HookHandler<TData, TResult>> = [];
    const errors: Array<{ error: unknown; handlerId?: string }> = [];

    this.logDebug(`并行调用钩子: ${this.name}`, data);

    // 获取已排序的处理函数
    const currentHandlers = this.getSortedHandlers();

    // 过滤处理函数并准备执行
    const handlerPromises = currentHandlers
      .filter(handler => {
        const options = this.options.get(handler)!;

        // 检查过滤条件
        if (options.filter && !options.filter(data)) {
          return false;
        }

        // 收集一次性处理函数
        if (options.once) {
          onceHandlers.push(handler);
        }

        return true;
      })
      .map(async (handler, _index) => {
        const options = this.options.get(handler)!;

        try {
          this.logDebug(`并行执行钩子处理函数: ${this.name}`, {
            priority: options.priority,
            handlerId: options.id,
          });
          const startTime = performance.now();

          // 设置超时处理
          const timeoutPromise = this.createTimeoutPromise(handler, options.timeout);

          // 执行处理函数并等待结果或超时
          const result = await Promise.race([Promise.resolve(handler(data)), timeoutPromise]);

          // 清理超时定时器
          this.clearHandlerTimeout(handler);

          const duration = performance.now() - startTime;
          this.logDebug(`并行钩子处理函数完成: ${this.name}`, {
            duration,
            priority: options.priority,
            handlerId: options.id,
          });

          return result;
        } catch (error) {
          // 清理超时定时器
          this.clearHandlerTimeout(handler);

          // 记录错误
          if (error instanceof HandlerTimeoutError) {
            this.logError(`并行钩子处理函数超时: ${this.name}`, {
              error,
              timeout: options.timeout,
              handlerId: options.id,
            });
          } else {
            this.logError(`并行钩子处理函数异常: ${this.name}`, {
              error,
              handlerId: options.id,
            });
          }

          // 收集错误信息
          errors.push({ error, handlerId: options.id });

          // 返回undefined，让Promise.all继续执行
          return undefined as unknown as TResult;
        }
      });

    // 等待所有处理函数完成
    const results = await Promise.all(handlerPromises);

    // 移除一次性处理函数
    for (const handler of onceHandlers) {
      this.unregister(handler);
    }

    // 如果有错误，抛出聚合错误
    if (errors.length > 0) {
      throw new AggregateHookError(this.name, errors);
    }

    // 过滤掉undefined结果（出错的处理函数）
    return results.filter(result => result !== undefined);
  }

  /**
   * 通过瀑布流方式调用钩子处理函数
   * 每个处理函数的输出作为下一个函数的输入
   * @param initialData 初始数据
   * @returns 最后一个处理函数的结果
   */
  public async waterfall(initialData: TData): Promise<TData> {
    let result = initialData;
    const onceHandlers: Array<HookHandler<TData, TResult>> = [];

    this.logDebug(`瀑布流调用钩子: ${this.name}`, initialData);

    // 获取已排序的处理函数
    const currentHandlers = this.getSortedHandlers();

    for (const handler of currentHandlers) {
      const options = this.options.get(handler)!;

      // 检查过滤条件
      if (options.filter && !options.filter(result)) {
        continue;
      }

      // 收集一次性处理函数
      if (options.once) {
        onceHandlers.push(handler);
      }

      try {
        this.logDebug(`执行瀑布流钩子处理函数: ${this.name}`, {
          priority: options.priority,
          inputData: result,
        });
        const startTime = performance.now();

        // 设置超时处理
        const timeoutPromise = this.createTimeoutPromise(handler, options.timeout);

        // 执行处理函数并等待结果或超时
        const handlerResult = await Promise.race([
          Promise.resolve(handler(result)),
          timeoutPromise,
        ]);

        // 清理超时定时器
        this.clearHandlerTimeout(handler);

        // 强制类型转换确认安全转换
        // (优化: 使用类型守卫进行更安全的强制转换)
        if (this.isValidWaterfallResult<TData, TResult>(handlerResult)) {
          result = handlerResult;
        }

        const duration = performance.now() - startTime;
        this.logDebug(`瀑布流钩子处理函数完成: ${this.name}`, {
          duration,
          priority: options.priority,
          outputData: result,
        });
      } catch (error) {
        // 清理超时定时器
        this.clearHandlerTimeout(handler);

        // 记录错误
        if (error instanceof HandlerTimeoutError) {
          this.logError(`瀑布流钩子处理函数超时: ${this.name}`, {
            error,
            timeout: options.timeout,
          });
        } else {
          this.logError(`瀑布流钩子处理函数异常: ${this.name}`, { error });
        }
        // 继续执行其他处理函数
      }
    }

    // 移除一次性处理函数
    for (const handler of onceHandlers) {
      this.unregister(handler);
    }

    return result;
  }

  /**
   * 移除钩子处理函数
   * @param handler 要移除的处理函数
   */
  public unregister(handler: HookHandler<TData, TResult>): void {
    const index = this.handlers.indexOf(handler);
    if (index !== -1) {
      // 清除可能存在的超时定时器
      this.clearHandlerTimeout(handler);

      this.handlers.splice(index, 1);
      this.options.delete(handler);

      // 增加排序版本，使缓存失效
      this.sortVersion++;
      this.sortedHandlers = null;

      this.logDebug(`移除钩子处理函数: ${this.name}`);
    }
  }

  /**
   * 创建超时Promise
   * @param handler 处理函数
   * @param timeout 超时时间（毫秒）
   */
  private createTimeoutPromise(
    handler: HookHandler<TData, TResult>,
    timeout?: number,
  ): Promise<never> {
    if (!timeout || timeout <= 0) return new Promise(() => {});

    return new Promise((_, reject) => {
      const timer = setTimeout(() => {
        const error = new HandlerTimeoutError(this.name as EventName, timeout);
        reject(error);
      }, timeout);

      this.timeoutTimers.set(handler, timer);
    });
  }

  /**
   * 清除处理器超时定时器
   * @param handler 处理函数
   */
  private clearHandlerTimeout(handler: HookHandler<TData, TResult>): void {
    const timer = this.timeoutTimers.get(handler);
    if (timer) {
      clearTimeout(timer);
      this.timeoutTimers.delete(handler);
    }
  }

  /**
   * 按优先级排序处理函数
   */
  private getSortedHandlers(): Array<HookHandler<TData, TResult>> {
    // 如果缓存有效，直接返回
    if (this.sortedHandlers) {
      return this.sortedHandlers;
    }

    // 重新排序
    const sorted = [...this.handlers].sort((a, b) => {
      const optionsA = this.options.get(a)!;
      const optionsB = this.options.get(b)!;
      return (optionsA.priority || 10) - (optionsB.priority || 10);
    });

    // 更新缓存
    this.sortedHandlers = sorted;

    return sorted;
  }

  /**
   * 类型守卫：检查瀑布流处理结果是否有效
   * @param result 瀑布流处理结果
   */
  private isValidWaterfallResult<T, R>(result: R | T): result is T {
    return result !== undefined && result !== null;
  }

  /**
   * 记录调试日志
   * @param message 消息
   * @param data 数据
   */
  private logDebug(message: string, data?: any): void {
    this.logger?.debug('event', message, data);
  }

  /**
   * 记录错误日志
   * @param message 消息
   * @param data 数据
   */
  private logError(message: string, data?: any): void {
    this.logger?.error('event', message, data);
  }
}
