/**
 * 插件生命周期管理
 * 负责处理插件生命周期钩子的调用和执行顺序
 */
import {
  IPlugin,
  IPluginLifecycle,
  IFileUploaderCore,
  IEventEmitter,
} from '@file-chunk-uploader/types';

import { Logger } from '../developer-mode/logger';

/**
 * 钩子执行模式
 */
export type HookExecutionMode = 'sequential' | 'parallel' | 'parallel-merge';

/**
 * 钩子合并策略
 */
export type HookResultMergeStrategy = 'object-merge' | 'array-concat' | 'last-wins' | 'custom';

/**
 * 钩子处理函数类型
 */
export type HookFunction = (...args: unknown[]) => unknown;

/**
 * 钩子结果合并处理函数类型
 */
export type HookResultMergeHandler = (results: unknown[]) => unknown;

/**
 * 钩子执行超时配置
 */
export interface HookTimeoutConfig {
  /** 是否启用超时 */
  enabled: boolean;
  /** 超时时间（毫秒） */
  timeout: number;
  /** 超时动作 */
  action: 'warn' | 'error' | 'abort' | 'ignore';
}

/**
 * 插件生命周期管理器类
 * 处理插件钩子的调用和执行顺序管理
 */
export class PluginLifecycleManager {
  /** 生命周期钩子执行顺序配置 */
  private lifecycleOrder: Record<keyof IPluginLifecycle, HookExecutionMode> = {
    init: 'sequential',
    beforeUpload: 'sequential',
    beforeChunkUpload: 'sequential',
    afterChunkUpload: 'parallel',
    afterUpload: 'parallel',
    onError: 'sequential',
    onPause: 'parallel',
    onResume: 'parallel',
    onCancel: 'parallel',
    onProgress: 'parallel',
    onRetryStart: 'parallel',
    onRetrySuccess: 'parallel',
    onRetryFailed: 'parallel',
    cleanup: 'sequential',
  };

  /** 钩子超时配置 */
  private hookTimeouts: Record<string, HookTimeoutConfig> = {
    // 默认配置
    default: { enabled: true, timeout: 5000, action: 'warn' },
    // 特定钩子配置
    init: { enabled: true, timeout: 10000, action: 'warn' },
    beforeUpload: { enabled: true, timeout: 8000, action: 'warn' },
    beforeChunkUpload: { enabled: true, timeout: 3000, action: 'warn' },
    afterChunkUpload: { enabled: true, timeout: 3000, action: 'warn' },
    afterUpload: { enabled: true, timeout: 8000, action: 'warn' },
    cleanup: { enabled: true, timeout: 5000, action: 'warn' },
  };

  /** 日志记录器 */
  private logger: Logger;

  /** 性能监控启用状态 */
  private perfMonitoringEnabled: boolean = true;

  /** 钩子合并策略 */
  private hookMergeStrategies: Record<string, HookResultMergeStrategy> = {
    // 默认策略配置
    beforeUpload: 'last-wins',
    beforeChunkUpload: 'last-wins',
    afterChunkUpload: 'object-merge',
    afterUpload: 'object-merge',
  };

  /** 自定义合并策略 */
  private customMergeHandlers: Record<string, HookResultMergeHandler> = {};

  /**
   * 创建插件生命周期管理器实例
   * @param uploader 上传器实例
   * @param logger 日志记录器实例
   */
  constructor(
    private uploader: IFileUploaderCore,
    logger: Logger,
  ) {
    this.logger = logger;
  }

  /**
   * 设置钩子执行模式
   * @param hookName 钩子名称
   * @param mode 执行模式
   */
  public setHookExecutionMode(hookName: keyof IPluginLifecycle, mode: HookExecutionMode): void {
    this.lifecycleOrder[hookName] = mode;
  }

  /**
   * 设置钩子超时配置
   * @param hookName 钩子名称，使用'default'设置默认值
   * @param config 超时配置
   */
  public setHookTimeout(hookName: string, config: Partial<HookTimeoutConfig>): void {
    const currentConfig = this.hookTimeouts[hookName] || { ...this.hookTimeouts.default };
    this.hookTimeouts[hookName] = { ...currentConfig, ...config };
  }

  /**
   * 设置钩子合并策略
   * @param hookName 钩子名称
   * @param strategy 合并策略
   * @param customHandler 自定义合并处理函数（当strategy为'custom'时必须提供）
   */
  public setHookMergeStrategy(
    hookName: string,
    strategy: HookResultMergeStrategy,
    customHandler?: HookResultMergeHandler,
  ): void {
    this.hookMergeStrategies[hookName] = strategy;

    if (strategy === 'custom') {
      if (!customHandler) {
        throw new Error(`自定义合并策略必须提供处理函数`);
      }
      this.customMergeHandlers[hookName] = customHandler;
    }
  }

  /**
   * 设置性能监控状态
   * @param enabled 是否启用性能监控
   */
  public setPerfMonitoring(enabled: boolean): void {
    this.perfMonitoringEnabled = enabled;
  }

  /**
   * 调用生命周期钩子
   * @param hookName 钩子名称
   * @param initialValue 初始值
   * @param plugins 要调用的插件列表
   * @param disabledPlugins 禁用的插件集合
   * @param args 其他参数
   * @returns 处理后的值
   */
  public async invokeHook<T>(
    hookName: keyof IPluginLifecycle,
    initialValue: T,
    plugins: IPlugin[],
    disabledPlugins: Set<string>,
    eventEmitter: IEventEmitter,
    ...args: unknown[]
  ): Promise<T> {
    // 过滤掉禁用的插件
    const activePlugins = plugins.filter(plugin => !disabledPlugins.has(plugin.name));

    // 获取执行模式
    const executionMode = this.lifecycleOrder[hookName] || 'sequential';

    // 创建性能标记
    const perfMarkStart = `plugin-hook-${hookName}-start`;
    const perfMarkEnd = `plugin-hook-${hookName}-end`;

    try {
      // 开始性能标记
      if (this.perfMonitoringEnabled && typeof performance !== 'undefined' && performance.mark) {
        performance.mark(perfMarkStart);
      }

      // 记录调用链跟踪
      this.logger.debug('plugin-trace', `执行插件钩子: ${String(hookName)}`);

      if (executionMode === 'sequential') {
        // 顺序执行
        return await this.invokeSequentialHook(
          hookName,
          initialValue,
          activePlugins,
          eventEmitter,
          args,
        );
      } else if (executionMode === 'parallel-merge') {
        // 并行执行并合并结果
        return await this.invokeParallelMergeHook(
          hookName,
          initialValue,
          activePlugins,
          eventEmitter,
          args,
        );
      } else {
        // 并行执行
        await this.invokeParallelHook(hookName, activePlugins, eventEmitter, args);
        return initialValue;
      }
    } finally {
      // 结束性能标记
      if (this.perfMonitoringEnabled && typeof performance !== 'undefined' && performance.mark) {
        performance.mark(perfMarkEnd);
        try {
          performance.measure(`plugin-hook-${hookName}`, perfMarkStart, perfMarkEnd);
        } catch (e) {
          // 忽略测量错误
        }
      }
    }
  }

  /**
   * 获取插件的钩子函数
   * @param plugin 插件实例
   * @param hookName 钩子名称
   * @returns 钩子函数或undefined
   */
  public getPluginHook(
    plugin: IPlugin,
    hookName: keyof IPluginLifecycle,
  ): HookFunction | undefined {
    // 优先使用lifecycle中的钩子
    if (plugin.lifecycle && hookName in plugin.lifecycle) {
      return plugin.lifecycle[hookName] as HookFunction;
    }

    // 其次使用hooks对象中的钩子
    if (plugin.hooks && hookName in plugin.hooks) {
      return plugin.hooks[String(hookName)] as HookFunction;
    }

    return undefined;
  }

  /**
   * 创建可超时的Promise
   * @param promise 原始Promise
   * @param hookName 钩子名称
   * @param pluginName 插件名称
   * @returns 可超时的Promise
   */
  private withTimeout<T>(promise: Promise<T>, hookName: string, pluginName: string): Promise<T> {
    // 获取超时配置
    const timeoutConfig = this.hookTimeouts[hookName] || this.hookTimeouts.default;

    // 如果未启用超时，直接返回原始Promise
    if (!timeoutConfig.enabled) {
      return promise;
    }

    // 创建超时Promise
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(() => {
          const timeoutError = new Error(
            `插件 "${pluginName}" 钩子 "${hookName}" 执行超时 (${timeoutConfig.timeout}ms)`,
          );

          // 根据配置的动作处理超时
          switch (timeoutConfig.action) {
            case 'warn':
              this.logger.warn('plugin-timeout', timeoutError.message);
              // 虽然警告，但不拒绝Promise，让原始Promise继续执行
              break;
            case 'error':
              this.logger.error('plugin-timeout', timeoutError.message);
              reject(timeoutError);
              break;
            case 'abort':
              this.logger.error('plugin-timeout', `中止执行: ${timeoutError.message}`);
              // 拒绝Promise并标记为需要中止
              timeoutError.name = 'HookTimeoutAbort';
              reject(timeoutError);
              break;
            case 'ignore':
              // 不做任何处理，让原始Promise继续执行
              break;
          }
        }, timeoutConfig.timeout);
      }),
    ]);
  }

  /**
   * 顺序执行钩子
   * @param hookName 钩子名称
   * @param initialValue 初始值
   * @param plugins 插件列表
   * @param args 钩子参数
   * @returns 处理后的值
   * @private
   */
  private async invokeSequentialHook<T>(
    hookName: keyof IPluginLifecycle,
    initialValue: T,
    plugins: IPlugin[],
    eventEmitter: IEventEmitter,
    args: unknown[],
  ): Promise<T> {
    let result = initialValue;

    for (const plugin of plugins) {
      const hook = this.getPluginHook(plugin, hookName) as HookFunction;

      if (hook) {
        // 记录单个插件钩子开始执行
        eventEmitter.emit('plugin:before', {
          hookName: String(hookName),
          plugin,
        });

        const startTime = Date.now();

        try {
          // 创建可超时的Promise
          const hookPromise = this.withTimeout(
            Promise.resolve(hook.call(plugin, result, ...args)),
            String(hookName),
            plugin.name,
          );

          // 执行钩子
          result = (await hookPromise) as T;
        } catch (err) {
          this.logger.error(
            'plugin',
            `插件 "${plugin.name}" 钩子 "${String(hookName)}" 执行出错`,
            err,
          );

          // 如果是超时中止错误，则中断整个链
          if (err instanceof Error && err.name === 'HookTimeoutAbort') {
            this.logger.error('plugin-timeout', `中止钩子链执行: ${String(hookName)}`);
            throw err;
          }

          // 触发错误事件
          eventEmitter.emit('plugin:error', {
            hookName: String(hookName),
            plugin,
            error: err,
          });
        } finally {
          // 计算执行时间
          const duration = Date.now() - startTime;

          // 记录单个插件钩子执行结束
          eventEmitter.emit('plugin:after', {
            hookName: String(hookName),
            plugin,
            duration,
          });

          // 记录性能指标
          eventEmitter.emit('plugin:performance', {
            hookName: String(hookName),
            plugin,
            duration,
          });
        }
      }
    }

    return result;
  }

  /**
   * 并行执行钩子
   * @param hookName 钩子名称
   * @param plugins 插件列表
   * @param args 钩子参数
   * @private
   */
  private async invokeParallelHook(
    hookName: keyof IPluginLifecycle,
    plugins: IPlugin[],
    eventEmitter: IEventEmitter,
    args: unknown[],
  ): Promise<void> {
    const hookPromises: Promise<void>[] = [];

    for (const plugin of plugins) {
      const hook = this.getPluginHook(plugin, hookName);

      if (hook) {
        // 记录单个插件钩子开始执行
        eventEmitter.emit('plugin:before', {
          hookName: String(hookName),
          plugin,
        });

        const startTime = Date.now();

        // 创建钩子执行Promise
        const hookPromise = (async () => {
          try {
            // 创建可超时的Promise
            await this.withTimeout(
              Promise.resolve(hook.call(plugin, ...args)),
              String(hookName),
              plugin.name,
            );
          } catch (err) {
            this.logger.error(
              'plugin',
              `插件 "${plugin.name}" 钩子 "${String(hookName)}" 执行出错`,
              err,
            );

            // 触发错误事件
            eventEmitter.emit('plugin:error', {
              hookName: String(hookName),
              plugin,
              error: err,
            });
          } finally {
            // 计算执行时间
            const duration = Date.now() - startTime;

            // 记录单个插件钩子执行结束
            eventEmitter.emit('plugin:after', {
              hookName: String(hookName),
              plugin,
              duration,
            });

            // 记录性能指标
            eventEmitter.emit('plugin:performance', {
              hookName: String(hookName),
              plugin,
              duration,
            });
          }
        })();

        hookPromises.push(hookPromise);
      }
    }

    await Promise.all(hookPromises);
  }

  /**
   * 并行执行钩子并合并结果
   * @param hookName 钩子名称
   * @param initialValue 初始值
   * @param plugins 插件列表
   * @param args 钩子参数
   * @returns 合并后的结果
   * @private
   */
  private async invokeParallelMergeHook<T>(
    hookName: keyof IPluginLifecycle,
    initialValue: T,
    plugins: IPlugin[],
    eventEmitter: IEventEmitter,
    args: unknown[],
  ): Promise<T> {
    const hookResults: unknown[] = [];
    const hookPromises: Promise<void>[] = [];

    for (const plugin of plugins) {
      const hook = this.getPluginHook(plugin, hookName);

      if (hook) {
        // 记录单个插件钩子开始执行
        eventEmitter.emit('plugin:before', {
          hookName: String(hookName),
          plugin,
        });

        const startTime = Date.now();

        // 创建钩子执行Promise
        const hookPromise = (async () => {
          try {
            // 创建可超时的Promise
            const result = await this.withTimeout(
              Promise.resolve(hook.call(plugin, initialValue, ...args)),
              String(hookName),
              plugin.name,
            );

            // 将结果添加到结果数组
            hookResults.push(result);
          } catch (err) {
            this.logger.error(
              'plugin',
              `插件 "${plugin.name}" 钩子 "${String(hookName)}" 执行出错`,
              err,
            );

            // 触发错误事件
            eventEmitter.emit('plugin:error', {
              hookName: String(hookName),
              plugin,
              error: err,
            });
          } finally {
            // 计算执行时间
            const duration = Date.now() - startTime;

            // 记录单个插件钩子执行结束
            eventEmitter.emit('plugin:after', {
              hookName: String(hookName),
              plugin,
              duration,
            });

            // 记录性能指标
            eventEmitter.emit('plugin:performance', {
              hookName: String(hookName),
              plugin,
              duration,
            });
          }
        })();

        hookPromises.push(hookPromise);
      }
    }

    // 等待所有钩子执行完成
    await Promise.all(hookPromises);

    // 合并结果
    return this.mergeHookResults(String(hookName), initialValue, hookResults);
  }

  /**
   * 合并钩子结果
   * @param hookName 钩子名称
   * @param initialValue 初始值
   * @param results 结果数组
   * @returns 合并后的结果
   * @private
   */
  private mergeHookResults<T>(hookName: string, initialValue: T, results: unknown[]): T {
    // 如果没有结果，直接返回初始值
    if (results.length === 0) {
      return initialValue;
    }

    // 获取合并策略
    const strategy = this.hookMergeStrategies[hookName] || 'last-wins';

    // 根据策略合并结果
    switch (strategy) {
      case 'last-wins': {
        // 使用最后一个结果
        const lastResult = results[results.length - 1];
        return lastResult as T;
      }

      case 'object-merge': {
        // 将所有结果合并为一个对象
        if (typeof initialValue === 'object' && initialValue !== null) {
          // 转换为Record类型并创建初始对象的副本
          const initialAsObj = initialValue as Record<string, unknown>;
          const initialCopy = Object.assign({}, initialAsObj);

          // 合并所有结果
          const mergedResult = results.reduce((merged, result) => {
            if (typeof result === 'object' && result !== null) {
              return Object.assign({}, merged, result as Record<string, unknown>);
            }
            return merged;
          }, initialCopy);

          return mergedResult as unknown as T;
        }
        const lastResult = results[results.length - 1];
        return lastResult as T;
      }

      case 'array-concat': {
        // 将所有结果连接为一个数组
        if (Array.isArray(initialValue)) {
          const resultArray = [...initialValue];

          for (const result of results) {
            if (Array.isArray(result)) {
              resultArray.push(...result);
            } else {
              resultArray.push(result);
            }
          }

          return resultArray as unknown as T;
        }
        const lastResult = results[results.length - 1];
        return lastResult as T;
      }

      case 'custom': {
        // 使用自定义处理函数
        const customHandler = this.customMergeHandlers[hookName];
        if (customHandler) {
          const customResult = customHandler(results);
          return customResult as T;
        }
        const lastResult = results[results.length - 1];
        return lastResult as T;
      }

      default: {
        // 默认使用最后一个结果
        const lastResult = results[results.length - 1];
        return lastResult as T;
      }
    }
  }
}
