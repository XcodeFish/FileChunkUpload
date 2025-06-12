/**
 * 插件调用链跟踪器
 * 用于跟踪插件的调用链和性能
 */
import { Logger } from './logger';
import { IPluginTraceEvent, IPluginTracerConfig, LogLevel } from './types';

/**
 * 插件调用链跟踪器
 */
export class PluginTracer {
  private config: IPluginTracerConfig;
  private traceEvents: IPluginTraceEvent[] = [];
  private traceMap: Map<string, IPluginTraceEvent> = new Map();
  private logger: Logger;
  private activeTraces: Set<string> = new Set();

  /**
   * 创建插件跟踪器实例
   */
  constructor(config: IPluginTracerConfig, logger: Logger) {
    // 默认配置
    const defaultConfig: IPluginTracerConfig = {
      enabled: true,
      traceLimit: 1000,
      logHookEvents: true,
      performanceThreshold: 50, // 50ms性能阈值
    };

    this.config = { ...defaultConfig, ...config };
    this.logger = logger;
  }

  /**
   * 配置跟踪器
   */
  configure(config: Partial<IPluginTracerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 创建跟踪ID
   */
  private createTraceId(pluginId: string, hookName: string): string {
    return `${pluginId}:${hookName}:${Date.now()}:${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * 开始跟踪插件调用
   */
  startTrace(pluginId: string, hookName: string, data?: any): string {
    if (!this.config.enabled) {
      return '';
    }

    const traceId = this.createTraceId(pluginId, hookName);
    const startTime = performance.now();

    const traceEvent: IPluginTraceEvent = {
      pluginId,
      hookName,
      startTime,
      data,
    };

    this.traceMap.set(traceId, traceEvent);
    this.activeTraces.add(traceId);

    if (this.config.logHookEvents) {
      this.logger.debug('plugin', `插件调用开始: ${pluginId}.${hookName}`, { traceId, data });
    }

    return traceId;
  }

  /**
   * 根据跟踪事件情况确定日志级别和消息
   * 提取为独立方法，提高可读性和可维护性
   */
  private determineLogLevel(
    traceEvent: IPluginTraceEvent,
    duration: number,
    error?: Error,
  ): {
    level: LogLevel;
    message: string;
  } {
    if (error) {
      return {
        level: LogLevel.ERROR,
        message: `插件调用错误: ${traceEvent.pluginId}.${traceEvent.hookName} (${duration.toFixed(
          2,
        )}ms)`,
      };
    }

    if (this.config.performanceThreshold && duration > this.config.performanceThreshold) {
      return {
        level: LogLevel.WARN,
        message: `插件调用缓慢: ${traceEvent.pluginId}.${traceEvent.hookName} (${duration.toFixed(
          2,
        )}ms)`,
      };
    }

    return {
      level: LogLevel.DEBUG,
      message: `插件调用完成: ${traceEvent.pluginId}.${traceEvent.hookName} (${duration.toFixed(
        2,
      )}ms)`,
    };
  }

  /**
   * 结束跟踪插件调用
   */
  endTrace(traceId: string, error?: Error, result?: any): void {
    if (!this.config.enabled || !traceId) {
      return;
    }

    const traceEvent = this.traceMap.get(traceId);
    if (!traceEvent) {
      this.logger.warn('plugin', `找不到跟踪ID: ${traceId}`);
      return;
    }

    const endTime = performance.now();
    const duration = endTime - traceEvent.startTime;

    // 更新跟踪事件
    traceEvent.endTime = endTime;
    traceEvent.duration = duration;
    if (error) {
      traceEvent.error = error;
    }

    // 记录完成的跟踪事件
    this.activeTraces.delete(traceId);
    this.traceEvents.push({ ...traceEvent });

    // 限制跟踪事件历史数量
    if (this.config.traceLimit && this.traceEvents.length > this.config.traceLimit) {
      this.traceEvents.shift();
    }

    // 记录日志 - 使用提取的方法确定日志级别
    if (this.config.logHookEvents) {
      const { level, message } = this.determineLogLevel(traceEvent, duration, error);

      // 根据级别调用对应的日志方法
      switch (level) {
        case LogLevel.ERROR:
          this.logger.error('plugin', message, { traceId, error, result });
          break;
        case LogLevel.WARN:
          this.logger.warn('plugin', message, { traceId, result });
          break;
        default:
          this.logger.debug('plugin', message, { traceId, result });
      }
    }
  }

  /**
   * 获取所有跟踪事件
   */
  getTraceEvents(): IPluginTraceEvent[] {
    return [...this.traceEvents];
  }

  /**
   * 获取特定插件的跟踪事件
   */
  getPluginTraces(pluginId: string): IPluginTraceEvent[] {
    return this.traceEvents.filter(event => event.pluginId === pluginId);
  }

  /**
   * 获取特定钩子的跟踪事件
   */
  getHookTraces(hookName: string): IPluginTraceEvent[] {
    return this.traceEvents.filter(event => event.hookName === hookName);
  }

  /**
   * 获取正在活跃的跟踪
   */
  getActiveTraces(): IPluginTraceEvent[] {
    return Array.from(this.activeTraces)
      .map(traceId => {
        const trace = this.traceMap.get(traceId);
        if (!trace) return null;
        return {
          ...trace,
          duration: performance.now() - trace.startTime,
        };
      })
      .filter(Boolean) as IPluginTraceEvent[];
  }

  /**
   * 获取性能分析
   */
  getPerformanceAnalysis(): {
    pluginStats: Record<string, { count: number; totalTime: number; avgTime: number }>;
    hookStats: Record<string, { count: number; totalTime: number; avgTime: number }>;
    slowestCalls: IPluginTraceEvent[];
  } {
    const pluginStats: Record<string, { count: number; totalTime: number; avgTime: number }> = {};
    const hookStats: Record<string, { count: number; totalTime: number; avgTime: number }> = {};

    // 只处理已完成的调用
    const completedTraces = this.traceEvents.filter(trace => trace.duration !== undefined);

    // 按插件和钩子统计
    completedTraces.forEach(trace => {
      const { pluginId, hookName, duration = 0 } = trace;

      // 更新插件统计
      if (!pluginStats[pluginId]) {
        pluginStats[pluginId] = { count: 0, totalTime: 0, avgTime: 0 };
      }
      pluginStats[pluginId].count++;
      pluginStats[pluginId].totalTime += duration;

      // 更新钩子统计
      if (!hookStats[hookName]) {
        hookStats[hookName] = { count: 0, totalTime: 0, avgTime: 0 };
      }
      hookStats[hookName].count++;
      hookStats[hookName].totalTime += duration;
    });

    // 计算平均时间
    Object.values(pluginStats).forEach(stat => {
      stat.avgTime = stat.count > 0 ? stat.totalTime / stat.count : 0;
    });

    Object.values(hookStats).forEach(stat => {
      stat.avgTime = stat.count > 0 ? stat.totalTime / stat.count : 0;
    });

    // 找出最慢的调用
    const slowestCalls = [...completedTraces]
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, 10);

    return {
      pluginStats,
      hookStats,
      slowestCalls,
    };
  }

  /**
   * 清除跟踪历史
   */
  clearTraces(): void {
    this.traceEvents = [];
    // 保留活跃跟踪
    const activeTtraceIds = Array.from(this.activeTraces);
    this.traceMap = new Map(
      activeTtraceIds.map(id => {
        const trace = this.traceMap.get(id);
        return [id, trace!];
      }),
    );
  }

  /**
   * 创建异步跟踪包装器
   * 用于自动跟踪异步函数的执行
   */
  async traceAsync<T>(
    pluginId: string,
    hookName: string,
    fn: () => Promise<T>,
    data?: any,
  ): Promise<T> {
    const traceId = this.startTrace(pluginId, hookName, data);

    try {
      const result = await fn();
      this.endTrace(traceId, undefined, result);
      return result;
    } catch (error) {
      this.endTrace(traceId, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * 创建同步跟踪包装器
   * 用于自动跟踪同步函数的执行
   */
  trace<T>(pluginId: string, hookName: string, fn: () => T, data?: any): T {
    const traceId = this.startTrace(pluginId, hookName, data);

    try {
      const result = fn();
      this.endTrace(traceId, undefined, result);
      return result;
    } catch (error) {
      this.endTrace(traceId, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
}
