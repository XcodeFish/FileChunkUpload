/**
 * 插件管理器
 * 负责插件的注册、卸载、钩子调用和插件间依赖管理
 */
import {
  IPlugin,
  IPluginManager,
  IFileUploaderCore,
  IEventEmitter,
  IPluginLifecycle,
} from '@file-chunk-uploader/types';

import { Logger } from '../developer-mode/logger';

// 导入拆分出的模块
import { PluginConflictResolver, ConflictResolutionStrategy } from './plugin-conflict-resolver';
import { PluginDependencyManager } from './plugin-dependency-manager';
import { PluginHealthMonitor } from './plugin-health';
import { PluginLifecycleManager, HookExecutionMode } from './plugin-lifecycle';
import { PluginTraceVisualizer } from './plugin-trace-visualizer';
import { isVersionCompatible, detectPluginConflict, getPluginApiRequirement } from './plugin-utils';

/**
 * 插件事件数据类型
 */
interface PluginEventData {
  /** 插件实例 */
  plugin: IPlugin;
  /** 钩子名称 */
  hookName: string;
  /** 执行耗时 */
  duration?: number;
  /** 错误信息 */
  error?: Error | unknown;
}

/**
 * 插件配置类型
 */
interface PluginConfig {
  [key: string]: unknown;
}

/**
 * 可更新配置的插件接口
 */
interface IPluginWithConfig extends IPlugin {
  updateConfig?: (config: PluginConfig) => void;
}

/**
 * 上传器API接口，扩展了API版本信息
 */
interface IFileUploaderWithApi extends Omit<IFileUploaderCore, 'apiVersion'> {
  apiVersion?: string;
}

/**
 * 插件管理器选项
 */
export interface PluginManagerOptions {
  /** 是否启用健康监控 */
  enableHealthMonitoring?: boolean;
  /** 是否启用优先级控制 */
  enablePriorityControl?: boolean;
  /** 是否启用插件状态管理 */
  enableStateManagement?: boolean;
  /** 是否检查API版本兼容性 */
  checkApiCompatibility?: boolean;
  /** 是否启用调用链追踪 */
  enableTracing?: boolean;
  /** 冲突解决全局策略 */
  conflictStrategy?: ConflictResolutionStrategy;
}

/**
 * 插件状态
 */
export enum PluginState {
  ENABLED = 'enabled',
  DISABLED = 'disabled',
  PENDING = 'pending',
  FAILED = 'failed',
}

/**
 * 插件优先级
 */
export enum PluginPriority {
  HIGHEST = 0,
  HIGH = 25,
  NORMAL = 50,
  LOW = 75,
  LOWEST = 100,
}

/**
 * 插件优先级配置
 */
export interface PluginPriorityConfig {
  /** 插件名称 */
  name: string;
  /** 优先级 */
  priority: number;
}

/**
 * 插件管理器
 * 负责管理插件的注册、卸载和钩子调用
 */
export class PluginManager implements IPluginManager {
  /** 已注册的插件 */
  private plugins: Map<string, IPlugin> = new Map();

  /** 插件优先级映射 */
  private pluginPriorities: Map<string, number> = new Map();

  /** 插件状态映射 */
  private pluginStates: Map<string, PluginState> = new Map();

  /** 禁用的插件集合 */
  private disabledPlugins: Set<string> = new Set();

  /** 上传器实例 */
  private uploader: IFileUploaderCore;

  /** 事件发射器 */
  private eventEmitter: IEventEmitter;

  /** 日志记录器 */
  private logger: Logger;

  /** 插件依赖管理器 */
  private dependencyManager: PluginDependencyManager;

  /** 插件生命周期管理器 */
  private lifecycleManager: PluginLifecycleManager;

  /** 插件健康监控器 */
  private healthMonitor: PluginHealthMonitor;

  /** 插件冲突解决器 */
  private conflictResolver: PluginConflictResolver;

  /** 插件调用链可视化器 */
  private traceVisualizer?: PluginTraceVisualizer;

  /** 配置选项 */
  private options: PluginManagerOptions;

  /** 插件配置缓存 */
  private pluginConfigs: Map<string, PluginConfig> = new Map();

  /**
   * 创建插件管理器实例
   * @param uploader 上传器实例
   * @param eventEmitter 事件发射器
   * @param logger 日志记录器
   * @param options 插件管理器选项
   */
  constructor(
    uploader: IFileUploaderCore,
    eventEmitter: IEventEmitter,
    logger: Logger,
    options: PluginManagerOptions = {},
  ) {
    this.uploader = uploader;
    this.eventEmitter = eventEmitter;
    this.logger = logger;

    this.options = {
      enableHealthMonitoring: true,
      enablePriorityControl: true,
      enableStateManagement: true,
      checkApiCompatibility: true,
      enableTracing: true,
      conflictStrategy: ConflictResolutionStrategy.USE_LATEST,
      ...options,
    };

    // 初始化依赖管理器
    this.dependencyManager = new PluginDependencyManager(logger);

    // 初始化生命周期管理器
    this.lifecycleManager = new PluginLifecycleManager(uploader, logger);

    // 初始化健康监控器
    this.healthMonitor = new PluginHealthMonitor(logger);

    // 初始化冲突解决器
    this.conflictResolver = new PluginConflictResolver(logger, this.options.conflictStrategy);

    // 初始化调用链可视化器
    if (this.options.enableTracing) {
      this.traceVisualizer = new PluginTraceVisualizer(logger);
    }

    // 注册事件监听
    this.setupEventListeners();

    // 设置默认优先级
    this.setDefaultPriorities();
  }

  /**
   * 设置事件监听器
   * @private
   */
  private setupEventListeners(): void {
    // 监听插件钩子执行
    this.eventEmitter.on('plugin:before', (data: PluginEventData) => {
      // 只有在启用了追踪的情况下才记录
      if (this.traceVisualizer && data.hookName && data.plugin) {
        // 钩子开始执行，此时还不记录
      }
    });

    this.eventEmitter.on('plugin:after', (data: PluginEventData) => {
      // 只有在启用了追踪的情况下才记录
      if (this.traceVisualizer && data.hookName && data.plugin && data.duration !== undefined) {
        this.traceVisualizer.recordHookCall(data.hookName, data.plugin, data.duration, 'success');
      }
    });

    this.eventEmitter.on('plugin:error', (data: PluginEventData) => {
      // 只有在启用了追踪的情况下才记录
      if (this.traceVisualizer && data.hookName && data.plugin && data.error) {
        this.traceVisualizer.recordHookCall(
          data.hookName,
          data.plugin,
          data.duration || 0,
          'error',
          data.error instanceof Error ? data.error : new Error(String(data.error)),
        );
      }
    });

    // 记录性能数据
    this.eventEmitter.on('plugin:performance', (data: PluginEventData) => {
      if (
        this.options.enableHealthMonitoring &&
        data.hookName &&
        data.plugin &&
        data.duration !== undefined
      ) {
        this.healthMonitor.recordHookExecution(
          data.plugin.name,
          data.hookName,
          data.duration,
          data.error instanceof Error ? data.error : undefined,
        );
      }
    });
  }

  /**
   * 注册插件
   * @param plugin 插件实例
   * @param config 插件配置
   * @returns 成功与否
   */
  public register(plugin: IPlugin, config?: PluginConfig): boolean {
    try {
      // 检查插件是否已注册
      if (this.plugins.has(plugin.name)) {
        this.logger.warn('plugin', `插件 "${plugin.name}" 已经注册，检查是否存在冲突`);

        // 检测冲突
        const installedPlugin = this.plugins.get(plugin.name)!;
        const conflicts = this.conflictResolver.detectConflicts(plugin, this.plugins);

        // 如果存在冲突，尝试解决
        if (conflicts.length > 0) {
          this.logger.info('plugin-conflict', `检测到 ${conflicts.length} 个冲突，尝试自动解决`);

          for (const conflict of conflicts) {
            try {
              const resolution = this.conflictResolver.resolveConflict(conflict);

              this.logger.info(
                'plugin-conflict',
                `冲突解决方案: ${conflict.details}, 解决策略: ${resolution.resolution}, 动作: ${resolution.action}`,
              );

              // 如果解决方案是使用新插件，则先卸载旧插件
              if (resolution.keepPlugin === plugin) {
                this.logger.info(
                  'plugin-conflict',
                  `将卸载已安装插件 "${installedPlugin.name}@${installedPlugin.version}" 并安装新版本 "${plugin.name}@${plugin.version}"`,
                );
                this.unregister(installedPlugin.name);
                // 继续安装流程
              } else {
                // 保留已安装插件，不安装新插件
                this.logger.info(
                  'plugin-conflict',
                  `保留已安装插件 "${installedPlugin.name}@${installedPlugin.version}", 不安装 "${plugin.name}@${plugin.version}"`,
                );
                return false;
              }
            } catch (err) {
              this.logger.error(
                'plugin-conflict',
                `解决冲突失败: ${err instanceof Error ? err.message : String(err)}`,
              );
              return false;
            }
          }
        }
      }

      this.logger.debug('plugin', `注册插件: ${plugin.name}@${plugin.version}`);

      // 检查API版本兼容性
      if (this.options.checkApiCompatibility) {
        this.checkApiCompatibility(plugin);
      }

      // 检查插件冲突
      this.checkConflicts(plugin);

      // 处理插件依赖关系
      this.dependencyManager.processPluginDependencies(plugin, this.plugins);

      // 保存插件和配置
      this.plugins.set(plugin.name, plugin);
      if (config !== undefined) {
        this.pluginConfigs.set(plugin.name, config);
      }

      // 设置插件状态
      this.pluginStates.set(plugin.name, PluginState.ENABLED);

      // 健康监控初始化
      if (this.options.enableHealthMonitoring) {
        this.healthMonitor.initPluginHealth(plugin);
      }

      // 调用链追踪
      if (this.options.enableTracing && this.traceVisualizer) {
        // 记录插件注册事件
        this.logger.debug('plugin-trace', `插件 "${plugin.name}@${plugin.version}" 已注册`);
      }

      // 初始化插件
      if (plugin.lifecycle?.init) {
        try {
          plugin.lifecycle.init(this.uploader);
        } catch (err) {
          this.logger.error('plugin', `插件 "${plugin.name}" 初始化失败`, err);

          // 更新健康状态
          if (this.options.enableHealthMonitoring) {
            this.healthMonitor.recordHookExecution(
              plugin.name,
              'init',
              0,
              err instanceof Error ? err : new Error(String(err)),
            );
          }

          // 插件初始化失败，将其状态设置为失败
          this.pluginStates.set(plugin.name, PluginState.FAILED);

          // 禁用失败的插件
          this.disabledPlugins.add(plugin.name);

          // 但仍然保留在已注册列表中，以便查看错误信息
          return false;
        }
      }

      this.logger.info('plugin', `插件 "${plugin.name}" 注册成功`);

      // 发送插件注册事件
      this.eventEmitter.emit('plugin:registered', {
        name: plugin.name,
        version: plugin.version,
        config,
      });

      return true;
    } catch (err) {
      this.logger.error('plugin', `插件 "${plugin.name}" 注册失败`, err);
      return false;
    }
  }

  /**
   * 卸载插件
   * @param pluginName 插件名称
   * @returns 成功与否
   */
  public unregister(pluginName: string): boolean {
    try {
      const plugin = this.plugins.get(pluginName);
      if (!plugin) {
        this.logger.warn('plugin', `插件 "${pluginName}" 未注册，无法卸载`);
        return false;
      }

      // 检查依赖关系
      if (this.dependencyManager.hasDependents(pluginName)) {
        const dependents = this.dependencyManager.getDependents(pluginName);
        throw new Error(
          `无法卸载插件 "${pluginName}"，因为其他插件依赖它: ${dependents.join(', ')}`,
        );
      }

      this.logger.debug('plugin', `卸载插件: ${pluginName}`);

      // 如果插件提供了清理方法，调用它
      if (plugin.lifecycle?.cleanup) {
        try {
          plugin.lifecycle.cleanup();
        } catch (err) {
          this.logger.warn('plugin', `插件 "${pluginName}" 清理过程中出错`, err);
          // 继续卸载流程，不因清理错误而中断
        }
      }

      // 从插件列表中移除
      this.plugins.delete(pluginName);

      // 从配置缓存中移除
      this.pluginConfigs.delete(pluginName);

      // 从状态映射中移除
      this.pluginStates.delete(pluginName);

      // 从禁用插件集合中移除
      this.disabledPlugins.delete(pluginName);

      // 从依赖关系图中移除
      this.dependencyManager.removePlugin(pluginName);

      // 从健康监控中移除
      if (this.options.enableHealthMonitoring) {
        this.healthMonitor.removePluginHealth(pluginName);
      }

      this.logger.info('plugin', `插件 "${pluginName}" 卸载成功`);

      // 发送插件卸载事件
      this.eventEmitter.emit('plugin:unregistered', {
        name: pluginName,
      });

      return true;
    } catch (err) {
      this.logger.error('plugin', `插件 "${pluginName}" 卸载失败`, err);
      return false;
    }
  }

  /**
   * 调用钩子
   * @param hookName 钩子名称
   * @param initialValue 初始值
   * @param args 传递给钩子的参数
   * @returns 钩子处理后的值
   */
  public async invokeHook<T>(
    hookName: keyof IPluginLifecycle,
    initialValue: T,
    ...args: unknown[]
  ): Promise<T> {
    // 启动跟踪会话
    if (this.traceVisualizer) {
      // 不需要每次调用都创建新会话，除非是重要的钩子
      if (hookName === 'beforeUpload' || hookName === 'afterUpload') {
        this.traceVisualizer.startNewSession();
      }
    }

    // 获取排序后的插件列表
    const sortedPlugins = this.getSortedPlugins();

    // 调用生命周期管理器的invokeHook方法
    return await this.lifecycleManager.invokeHook(
      hookName,
      initialValue,
      sortedPlugins,
      this.disabledPlugins,
      this.eventEmitter,
      ...args,
    );
  }

  /**
   * 获取所有已注册的插件
   * @returns 插件列表
   */
  public getPlugins(): IPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * 获取指定名称的插件
   * @param name 插件名称
   * @returns 插件实例或undefined
   */
  public getPlugin(name: string): IPlugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * 设置钩子执行模式
   * @param hookName 钩子名称
   * @param mode 执行模式
   */
  public setHookExecutionMode(hookName: keyof IPluginLifecycle, mode: HookExecutionMode): void {
    this.lifecycleManager.setHookExecutionMode(hookName, mode);
  }

  /**
   * 设置钩子超时配置
   * @param hookName 钩子名称
   * @param timeout 超时时间（毫秒）
   * @param action 超时动作
   */
  public setHookTimeout(
    hookName: string,
    timeout: number,
    action: 'warn' | 'error' | 'abort' | 'ignore',
  ): void {
    this.lifecycleManager.setHookTimeout(hookName, {
      enabled: true,
      timeout,
      action,
    });
  }

  /**
   * 设置插件优先级
   * @param configs 优先级配置数组
   */
  public setPriorities(configs: PluginPriorityConfig[]): void {
    for (const config of configs) {
      this.pluginPriorities.set(config.name, config.priority);
    }

    this.logger.info('plugin', `已更新 ${configs.length} 个插件的优先级`);
  }

  /**
   * 启用插件
   * @param pluginName 插件名称
   * @returns 成功与否
   */
  public enablePlugin(pluginName: string): boolean {
    if (!this.plugins.has(pluginName)) {
      this.logger.warn('plugin', `插件 "${pluginName}" 未注册，无法启用`);
      return false;
    }

    // 如果插件已经启用，直接返回成功
    if (!this.disabledPlugins.has(pluginName)) {
      return true;
    }

    const plugin = this.plugins.get(pluginName)!;

    try {
      // 从禁用列表移除
      this.disabledPlugins.delete(pluginName);

      // 更新插件状态
      this.pluginStates.set(pluginName, PluginState.ENABLED);

      // 如果插件有init钩子，重新调用
      if (plugin.lifecycle?.init) {
        plugin.lifecycle.init(this.uploader);
      }

      // 更新健康状态
      if (this.options.enableHealthMonitoring) {
        this.healthMonitor.updatePluginStatus(pluginName, true);
      }

      this.logger.info('plugin', `插件 "${pluginName}" 已启用`);

      // 发送插件启用事件
      this.eventEmitter.emit('plugin:enabled', {
        name: pluginName,
      });

      return true;
    } catch (err) {
      this.logger.error('plugin', `插件 "${pluginName}" 启用失败`, err);
      return false;
    }
  }

  /**
   * 禁用插件
   * @param pluginName 插件名称
   * @returns 成功与否
   */
  public disablePlugin(pluginName: string): boolean {
    if (!this.plugins.has(pluginName)) {
      this.logger.warn('plugin', `插件 "${pluginName}" 未注册，无法禁用`);
      return false;
    }

    // 如果插件已经禁用，直接返回成功
    if (this.disabledPlugins.has(pluginName)) {
      return true;
    }

    const plugin = this.plugins.get(pluginName)!;

    try {
      // 检查是否有依赖该插件的插件仍处于启用状态
      const dependents = this.dependencyManager.getDependents(pluginName);
      const enabledDependents = dependents.filter(name => !this.disabledPlugins.has(name));

      if (enabledDependents.length > 0) {
        throw new Error(
          `无法禁用插件 "${pluginName}"，因为它被以下启用的插件依赖: ${enabledDependents.join(
            ', ',
          )}`,
        );
      }

      // 如果插件有cleanup钩子，调用它
      if (plugin.lifecycle?.cleanup) {
        plugin.lifecycle.cleanup();
      }

      // 添加到禁用列表
      this.disabledPlugins.add(pluginName);

      // 更新插件状态
      this.pluginStates.set(pluginName, PluginState.DISABLED);

      // 更新健康状态
      if (this.options.enableHealthMonitoring) {
        this.healthMonitor.updatePluginStatus(pluginName, false);
      }

      this.logger.info('plugin', `插件 "${pluginName}" 已禁用`);

      // 发送插件禁用事件
      this.eventEmitter.emit('plugin:disabled', {
        name: pluginName,
      });

      return true;
    } catch (err) {
      this.logger.error('plugin', `插件 "${pluginName}" 禁用失败`, err);
      return false;
    }
  }

  /**
   * 获取插件状态
   * @param pluginName 插件名称
   * @returns 插件状态
   */
  public getPluginState(pluginName: string): PluginState | undefined {
    return this.pluginStates.get(pluginName);
  }

  /**
   * 获取插件配置
   * @param pluginName 插件名称
   * @returns 插件配置
   */
  public getPluginConfig<T = unknown>(pluginName: string): T | undefined {
    return this.pluginConfigs.get(pluginName) as T | undefined;
  }

  /**
   * 更新插件配置
   * @param pluginName 插件名称
   * @param config 配置对象
   * @returns 成功与否
   */
  public updatePluginConfig(pluginName: string, config: PluginConfig): boolean {
    if (!this.plugins.has(pluginName)) {
      this.logger.warn('plugin', `插件 "${pluginName}" 未注册，无法更新配置`);
      return false;
    }

    try {
      const plugin = this.plugins.get(pluginName)! as IPluginWithConfig;
      const oldConfig = this.pluginConfigs.get(pluginName);

      // 保存新配置
      this.pluginConfigs.set(pluginName, config);

      // 触发配置更新事件
      this.eventEmitter.emit('plugin:config', {
        name: pluginName,
        oldConfig,
        newConfig: config,
      });

      // 如果插件实现了配置更新方法，调用它
      if (typeof plugin.updateConfig === 'function') {
        plugin.updateConfig(config);
      }

      this.logger.info('plugin', `插件 "${pluginName}" 配置已更新`);
      return true;
    } catch (err) {
      this.logger.error('plugin', `插件 "${pluginName}" 更新配置失败`, err);
      return false;
    }
  }

  /**
   * 获取插件健康状态
   * @param pluginName 插件名称，不提供则返回所有插件的健康状态
   * @returns 健康状态
   */
  public getPluginHealth(pluginName?: string): unknown {
    if (!this.options.enableHealthMonitoring) {
      return { enabled: false, message: '健康监控未启用' };
    }

    return this.healthMonitor.getPluginHealth(pluginName);
  }

  /**
   * 获取插件性能报告
   * @returns 性能报告
   */
  public getPerformanceReport(): Record<string, unknown> {
    if (!this.options.enableHealthMonitoring) {
      return { enabled: false, message: '健康监控未启用' };
    }

    return this.healthMonitor.getPerformanceReport();
  }

  /**
   * 获取冲突解决策略
   */
  public getConflictStrategy(): ConflictResolutionStrategy {
    return this.options.conflictStrategy || ConflictResolutionStrategy.USE_LATEST;
  }

  /**
   * 设置冲突解决策略
   * @param strategy 全局冲突解决策略
   */
  public setConflictStrategy(strategy: ConflictResolutionStrategy): void {
    this.options.conflictStrategy = strategy;
    this.conflictResolver.setGlobalStrategy(strategy);
  }

  /**
   * 为特定插件设置冲突解决策略
   * @param pluginName 插件名称
   * @param strategy 冲突解决策略
   */
  public setPluginConflictStrategy(pluginName: string, strategy: ConflictResolutionStrategy): void {
    this.conflictResolver.setPluginStrategy(pluginName, strategy);
  }

  /**
   * 获取插件调用链可视化HTML
   * @returns HTML字符串或错误消息
   */
  public getPluginTraceVisualization(): string {
    if (!this.options.enableTracing || !this.traceVisualizer) {
      return '<p>调用链追踪未启用</p>';
    }

    return this.traceVisualizer.generateVisualizationHtml();
  }

  /**
   * 获取插件调用链可视化数据
   * @returns 可视化数据对象
   */
  public getPluginTraceData(): Record<string, unknown> {
    if (!this.options.enableTracing || !this.traceVisualizer) {
      return { enabled: false, message: '调用链追踪未启用' };
    }

    return this.traceVisualizer.generateVisualizationChartData();
  }

  /**
   * 获取按优先级排序的插件列表
   * @returns 排序后的插件列表
   * @private
   */
  private getSortedPlugins(): IPlugin[] {
    return Array.from(this.plugins.values()).sort((a, b) => {
      const priorityA = this.pluginPriorities.get(a.name) ?? PluginPriority.NORMAL;
      const priorityB = this.pluginPriorities.get(b.name) ?? PluginPriority.NORMAL;
      return priorityA - priorityB;
    });
  }

  /**
   * 设置默认优先级
   * @private
   */
  private setDefaultPriorities(): void {
    // 内置插件的默认优先级
    this.pluginPriorities.set('core', PluginPriority.HIGHEST);
    this.pluginPriorities.set('logger', PluginPriority.HIGHEST + 1);
    this.pluginPriorities.set('error-handler', PluginPriority.HIGH);
    this.pluginPriorities.set('chunk-upload', PluginPriority.NORMAL);
    this.pluginPriorities.set('resume-upload', PluginPriority.NORMAL);
    this.pluginPriorities.set('network', PluginPriority.NORMAL);
    this.pluginPriorities.set('analytics', PluginPriority.LOW);
    this.pluginPriorities.set('ui', PluginPriority.LOWEST);
  }

  /**
   * 检查API兼容性
   * @param plugin 插件实例
   * @throws 如果API不兼容则抛出错误
   * @private
   */
  private checkApiCompatibility(plugin: IPlugin): void {
    const apiRequirement = getPluginApiRequirement(plugin);
    const uploader = this.uploader as IFileUploaderWithApi;
    const currentApiVersion = uploader.apiVersion || '1.0.0';

    if (!isVersionCompatible(currentApiVersion, apiRequirement.version, apiRequirement.mode)) {
      throw new Error(
        `插件 "${plugin.name}" 要求API版本 ${apiRequirement.version}（${apiRequirement.mode}兼容），但当前API版本为 ${currentApiVersion}`,
      );
    }
  }

  /**
   * 检查插件冲突
   * @param plugin 插件实例
   * @throws 如果有冲突且无法自动解决则抛出错误
   * @private
   */
  private checkConflicts(plugin: IPlugin): void {
    for (const installedPlugin of this.plugins.values()) {
      if (installedPlugin.name === plugin.name) {
        continue; // 同名插件的冲突在register方法中已处理
      }

      const conflictResult = detectPluginConflict(plugin, installedPlugin);
      if (conflictResult.hasConflict) {
        this.logger.warn('plugin', `检测到潜在冲突: ${conflictResult.details}`);

        // 对于非版本冲突，默认允许共存，但记录警告
        if (conflictResult.type !== 'version') {
          this.logger.warn(
            'plugin',
            `允许功能可能重叠的插件共存: "${plugin.name}" 和 "${installedPlugin.name}"`,
          );
        }
      }
    }
  }
}
