/**
 * 开发者模式主类
 * 集成日志系统和插件跟踪器
 */
import { Logger } from './logger';
import { PluginTracer } from './plugin-tracer';
import { IDeveloperModeConfig, LogLevel } from './types';

/**
 * 通用配置深度合并函数
 * 将用户配置与默认配置合并，确保必填属性存在
 */
function mergeWithDefaults<T extends Record<string, any>>(
  defaultConfig: T,
  userConfig?: Partial<T>,
): T {
  if (!userConfig) {
    return { ...defaultConfig };
  }

  const result = { ...defaultConfig };

  // 遍历用户配置的所有属性
  for (const key in userConfig) {
    if (Object.prototype.hasOwnProperty.call(userConfig, key)) {
      const value = userConfig[key];

      // 如果是对象且不是null，进行递归合并
      if (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        defaultConfig[key] !== null &&
        typeof defaultConfig[key] === 'object'
      ) {
        // 递归合并嵌套对象
        result[key] = mergeWithDefaults(defaultConfig[key], value);
      } else if (value !== undefined) {
        // 对于非对象或undefined值，直接使用用户配置
        result[key] = value;
      }
    }
  }

  return result;
}

/**
 * 开发者模式单例
 */
export class DeveloperMode {
  private static instance: DeveloperMode;
  private config: IDeveloperModeConfig;
  private logger: Logger;
  private pluginTracer: PluginTracer;
  private performanceMarks: Record<string, number> = {};
  private performanceMeasures: Record<string, { duration: number; memory?: any }> = {};

  /**
   * 获取单例实例
   */
  public static getInstance(): DeveloperMode {
    if (!DeveloperMode.instance) {
      DeveloperMode.instance = new DeveloperMode();
    }
    return DeveloperMode.instance;
  }

  /**
   * 私有构造函数
   */
  private constructor() {
    // 默认配置
    this.config = {
      enabled: false,
      logger: {
        level: LogLevel.INFO,
        colorize: true,
      },
      pluginTracer: {
        enabled: false,
      },
      consoleApiEnabled: false,
      performanceTracking: {
        enabled: false,
        sampleRate: 0.1,
        trackMemory: false,
      },
      breakOnError: false,
    };

    // 创建默认实例
    this.logger = new Logger(this.config.logger);
    this.pluginTracer = new PluginTracer(
      this.config.pluginTracer || { enabled: false },
      this.logger,
    );

    // 如果在浏览器环境且需要捕获未处理的错误
    if (typeof window !== 'undefined') {
      this.setupErrorHandling();
    }
  }

  /**
   * 初始化开发者模式
   */
  init(config?: Partial<IDeveloperModeConfig>): void {
    if (config) {
      this.configure(config);
    }

    if (this.config.enabled) {
      this.logger.info('core', '开发者模式已初始化', this.config);

      if (this.config.consoleApiEnabled) {
        this.setupConsoleApi();
      }
    }
  }

  /**
   * 配置开发者模式
   */
  configure(config: Partial<IDeveloperModeConfig>): void {
    const wasEnabled = this.config.enabled;

    // 使用通用合并函数合并配置
    this.config = mergeWithDefaults(this.config, config);

    // 更新子组件配置
    if (this.config.logger) {
      this.logger.configure(this.config.logger);
    }

    if (this.config.pluginTracer) {
      this.pluginTracer.configure(this.config.pluginTracer);
    }

    // 记录配置变更
    if (!wasEnabled && this.config.enabled) {
      this.logger.info('core', '开发者模式已启用', this.config);
    } else if (wasEnabled && !this.config.enabled) {
      this.logger.info('core', '开发者模式已禁用');
    } else if (this.config.enabled) {
      this.logger.debug('core', '开发者模式配置已更新', config);
    }

    // 设置控制台API
    if (this.config.enabled && this.config.consoleApiEnabled) {
      this.setupConsoleApi();
    }
  }

  /**
   * 启用开发者模式
   */
  enable(): void {
    this.configure({ enabled: true });
  }

  /**
   * 禁用开发者模式
   */
  disable(): void {
    this.configure({ enabled: false });
  }

  /**
   * 获取日志记录器
   */
  getLogger(): Logger {
    return this.logger;
  }

  /**
   * 获取插件跟踪器
   */
  getPluginTracer(): PluginTracer {
    return this.pluginTracer;
  }

  /**
   * 获取当前配置
   */
  getConfig(): IDeveloperModeConfig {
    return { ...this.config };
  }

  /**
   * 设置错误处理
   */
  private setupErrorHandling(): void {
    if (typeof window === 'undefined') {
      return;
    }

    const originalOnError = window.onerror;
    window.onerror = (message, source, lineno, colno, error) => {
      if (this.config.enabled) {
        this.logger.error('core', '未捕获的错误', {
          message,
          source,
          lineno,
          colno,
          error,
        });

        if (this.config.breakOnError && typeof console !== 'undefined') {
          console.trace('开发者模式检测到错误，执行中断');
          debugger; // eslint-disable-line no-debugger
        }
      }

      // 调用原始处理程序
      if (originalOnError) {
        return originalOnError.call(window, message, source, lineno, colno, error);
      }
      return false;
    };

    const originalOnUnhandledRejection = window.onunhandledrejection;
    window.onunhandledrejection = event => {
      if (this.config.enabled) {
        this.logger.error('core', '未处理的Promise拒绝', {
          reason: event.reason,
          promise: event.promise,
        });

        if (this.config.breakOnError && typeof console !== 'undefined') {
          console.trace('开发者模式检测到未处理的Promise拒绝，执行中断');
          debugger; // eslint-disable-line no-debugger
        }
      }

      // 调用原始处理程序
      if (originalOnUnhandledRejection) {
        return originalOnUnhandledRejection.call(window, event);
      }
    };
  }

  /**
   * 设置控制台API
   * 在全局对象中添加开发者工具API
   */
  private setupConsoleApi(): void {
    if (typeof window === 'undefined') {
      return;
    }

    const fcuDevTools = {
      enable: this.enable.bind(this),
      disable: this.disable.bind(this),
      getConfig: this.getConfig.bind(this),
      configure: this.configure.bind(this),
      logger: this.logger,
      pluginTracer: this.pluginTracer,
      getLogs: () => this.logger.getHistory(),
      clearLogs: () => this.logger.clearHistory(),
      getTraces: () => this.pluginTracer.getTraceEvents(),
      clearTraces: () => this.pluginTracer.clearTraces(),
      getPerformance: () => ({
        marks: this.performanceMarks,
        measures: this.performanceMeasures,
        analysis: this.pluginTracer.getPerformanceAnalysis(),
      }),
    };

    // 添加到全局对象
    (window as any).__FCU_DEV_TOOLS__ = fcuDevTools;

    if (this.config.enabled) {
      this.logger.info('core', '开发者控制台API已启用。使用 window.__FCU_DEV_TOOLS__ 访问');
    }
  }

  /**
   * 性能标记开始
   */
  markStart(name: string): void {
    if (!this.config.enabled || !this.config.performanceTracking?.enabled) {
      return;
    }

    // 抽样检测
    if (Math.random() > (this.config.performanceTracking.sampleRate || 1)) {
      return;
    }

    this.performanceMarks[name] = performance.now();

    // 如果支持内存API且启用了内存跟踪
    if (this.config.performanceTracking.trackMemory && (performance as any).memory) {
      (this.performanceMarks as any)[`${name}_memory`] = (performance as any).memory.usedJSHeapSize;
    }
  }

  /**
   * 性能标记结束
   */
  markEnd(name: string): void {
    if (
      !this.config.enabled ||
      !this.config.performanceTracking?.enabled ||
      !this.performanceMarks[name]
    ) {
      return;
    }

    const endTime = performance.now();
    const startTime = this.performanceMarks[name];
    const duration = endTime - startTime;

    let memoryDiff;
    if (
      this.config.performanceTracking.trackMemory &&
      (performance as any).memory &&
      (this.performanceMarks as any)[`${name}_memory`]
    ) {
      memoryDiff =
        (performance as any).memory.usedJSHeapSize -
        (this.performanceMarks as any)[`${name}_memory`];
    }

    this.performanceMeasures[name] = {
      duration,
      ...(memoryDiff !== undefined ? { memory: memoryDiff } : {}),
    };

    // 记录耗时较长的操作
    if (duration > 100) {
      // 100ms阈值
      this.logger.warn(
        'performance',
        `性能标记 "${name}" 耗时较长: ${duration.toFixed(2)}ms`,
        memoryDiff !== undefined
          ? { memoryChange: `${(memoryDiff / 1024 / 1024).toFixed(2)} MB` }
          : {},
      );
    } else {
      this.logger.debug(
        'performance',
        `性能标记 "${name}": ${duration.toFixed(2)}ms`,
        memoryDiff !== undefined
          ? { memoryChange: `${(memoryDiff / 1024 / 1024).toFixed(2)} MB` }
          : {},
      );
    }
  }

  /**
   * 获取性能标记
   */
  getPerformanceMarks(): Record<string, number> {
    return { ...this.performanceMarks };
  }

  /**
   * 获取性能测量
   */
  getPerformanceMeasures(): Record<string, { duration: number; memory?: any }> {
    return { ...this.performanceMeasures };
  }

  /**
   * 清除性能数据
   */
  clearPerformanceData(): void {
    this.performanceMarks = {};
    this.performanceMeasures = {};
  }
}
