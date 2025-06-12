/**
 * 插件健康监控
 * 负责监控插件状态、性能和健康状况
 */
import { IPlugin } from '@file-chunk-uploader/types';

import { Logger } from '../developer-mode/logger';

/**
 * 插件健康状态枚举
 */
export enum PluginHealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  FAILED = 'failed',
}

/**
 * 插件执行性能数据
 */
export interface IPluginPerformanceData {
  /** 各钩子平均执行时间（毫秒） */
  avgExecutionTime: Record<string, number>;
  /** 各钩子执行次数 */
  executionCount: Record<string, number>;
  /** 各钩子错误次数 */
  errorCount: Record<string, number>;
  /** 总执行次数 */
  totalExecutions: number;
  /** 总错误次数 */
  totalErrors: number;
  /** 错误率 */
  errorRate: number;
  /** 最大执行时间 */
  maxExecutionTime: Record<string, number>;
  /** 最后执行时间 */
  lastExecutionTime: number;
}

/**
 * 插件健康信息
 */
export interface IPluginHealth {
  /** 插件名称 */
  name: string;
  /** 插件版本 */
  version: string;
  /** 健康状态 */
  status: PluginHealthStatus;
  /** 最后错误 */
  lastError?: Error;
  /** 错误时间 */
  lastErrorTime?: number;
  /** 性能数据 */
  performance?: IPluginPerformanceData;
  /** 插件启用状态 */
  enabled: boolean;
  /** 最后更新时间 */
  lastUpdateTime: number;
}

/**
 * 插件健康监控器
 * 监控插件状态和性能
 */
export class PluginHealthMonitor {
  /** 插件健康数据 */
  private healthData: Map<string, IPluginHealth> = new Map();

  /** 性能数据保存时间（毫秒） */
  private dataRetentionTime: number = 24 * 60 * 60 * 1000; // 默认24小时

  /** 错误阈值 - 当错误率超过此值时将状态设置为降级 */
  private degradedThreshold: number = 0.1; // 10%

  /** 错误阈值 - 当错误率超过此值时将状态设置为失败 */
  private failedThreshold: number = 0.3; // 30%

  /** 日志记录器 */
  private logger: Logger;

  /**
   * 创建插件健康监控器实例
   * @param logger 日志记录器实例
   */
  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * 设置健康监控阈值
   * @param options 阈值配置
   */
  public setThresholds(options: {
    degradedThreshold?: number;
    failedThreshold?: number;
    dataRetentionTime?: number;
  }): void {
    if (options.degradedThreshold !== undefined) {
      this.degradedThreshold = options.degradedThreshold;
    }
    if (options.failedThreshold !== undefined) {
      this.failedThreshold = options.failedThreshold;
    }
    if (options.dataRetentionTime !== undefined) {
      this.dataRetentionTime = options.dataRetentionTime;
    }
  }

  /**
   * 初始化插件健康数据
   * @param plugin 插件实例
   */
  public initPluginHealth(plugin: IPlugin): void {
    this.healthData.set(plugin.name, {
      name: plugin.name,
      version: plugin.version,
      status: PluginHealthStatus.HEALTHY,
      enabled: true,
      performance: {
        avgExecutionTime: {},
        executionCount: {},
        errorCount: {},
        totalExecutions: 0,
        totalErrors: 0,
        errorRate: 0,
        maxExecutionTime: {},
        lastExecutionTime: Date.now(),
      },
      lastUpdateTime: Date.now(),
    });
  }

  /**
   * 记录插件钩子执行
   * @param pluginName 插件名称
   * @param hookName 钩子名称
   * @param duration 执行时间（毫秒）
   * @param error 错误（如果有）
   */
  public recordHookExecution(
    pluginName: string,
    hookName: string,
    duration: number,
    error?: Error,
  ): void {
    const health = this.healthData.get(pluginName);
    if (!health) return;

    const now = Date.now();
    health.lastUpdateTime = now;

    // 更新性能数据
    if (health.performance) {
      const perf = health.performance;

      // 增加执行次数
      perf.executionCount[hookName] = (perf.executionCount[hookName] || 0) + 1;
      perf.totalExecutions++;

      // 更新平均执行时间
      const prevAvg = perf.avgExecutionTime[hookName] || 0;
      const prevCount = perf.executionCount[hookName] - 1;
      perf.avgExecutionTime[hookName] =
        prevCount > 0 ? (prevAvg * prevCount + duration) / perf.executionCount[hookName] : duration;

      // 更新最大执行时间
      perf.maxExecutionTime[hookName] = Math.max(perf.maxExecutionTime[hookName] || 0, duration);

      perf.lastExecutionTime = now;

      // 如果有错误，记录错误
      if (error) {
        perf.errorCount[hookName] = (perf.errorCount[hookName] || 0) + 1;
        perf.totalErrors++;
        perf.errorRate = perf.totalErrors / perf.totalExecutions;

        health.lastError = error;
        health.lastErrorTime = now;

        // 更新健康状态
        this.updateHealthStatus(pluginName);
      }
    }
  }

  /**
   * 更新插件健康状态
   * @param pluginName 插件名称
   */
  public updateHealthStatus(pluginName: string): void {
    const health = this.healthData.get(pluginName);
    if (!health || !health.performance) return;

    const errorRate = health.performance.errorRate;

    // 根据错误率更新状态
    if (errorRate >= this.failedThreshold) {
      health.status = PluginHealthStatus.FAILED;
      this.logger.warn(
        'plugin-health',
        `插件 "${pluginName}" 状态变为失败，错误率: ${(errorRate * 100).toFixed(1)}%`,
      );
    } else if (errorRate >= this.degradedThreshold) {
      health.status = PluginHealthStatus.DEGRADED;
      this.logger.warn(
        'plugin-health',
        `插件 "${pluginName}" 状态变为降级，错误率: ${(errorRate * 100).toFixed(1)}%`,
      );
    } else {
      health.status = PluginHealthStatus.HEALTHY;
    }
  }

  /**
   * 更新插件启用状态
   * @param pluginName 插件名称
   * @param enabled 是否启用
   */
  public updatePluginStatus(pluginName: string, enabled: boolean): void {
    const health = this.healthData.get(pluginName);
    if (!health) return;

    health.enabled = enabled;
    health.lastUpdateTime = Date.now();
  }

  /**
   * 获取插件健康信息
   * @param pluginName 插件名称（可选，不提供则返回所有插件的健康信息）
   * @returns 健康信息
   */
  public getPluginHealth(pluginName?: string): IPluginHealth | IPluginHealth[] {
    if (pluginName) {
      const health = this.healthData.get(pluginName);
      return health
        ? { ...health }
        : {
            name: pluginName,
            version: 'unknown',
            status: PluginHealthStatus.FAILED,
            enabled: false,
            lastUpdateTime: Date.now(),
          };
    }

    // 返回所有插件的健康信息
    return Array.from(this.healthData.values()).map(health => ({ ...health }));
  }

  /**
   * 移除插件健康数据
   * @param pluginName 插件名称
   */
  public removePluginHealth(pluginName: string): void {
    this.healthData.delete(pluginName);
  }

  /**
   * 清理过期数据
   */
  public cleanupExpiredData(): void {
    const now = Date.now();
    const cutoffTime = now - this.dataRetentionTime;

    for (const [pluginName, health] of this.healthData.entries()) {
      if (health.lastUpdateTime < cutoffTime) {
        this.healthData.delete(pluginName);
      }
    }
  }

  /**
   * 获取性能报告
   * @returns 性能报告
   */
  public getPerformanceReport(): Record<string, unknown> {
    if (this.healthData.size === 0) {
      return { message: '没有插件健康数据' };
    }

    // 定义性能报告数据类型
    interface PerformanceReportData {
      summary: {
        totalPlugins: number;
        healthyPlugins: number;
        degradedPlugins: number;
        failedPlugins: number;
        disabledPlugins: number;
        totalErrors: number;
        avgErrorRate: number;
      };
      pluginStats: Array<{
        name: string;
        version: string;
        status: PluginHealthStatus;
        errorRate: number;
        avgExecutionTime: number;
        enabled: boolean;
      }>;
      topSlowPlugins: Array<{
        name: string;
        avgExecutionTime: number;
        slowestHook: string;
        slowestTime: number;
      }>;
      topErrorPlugins: Array<{
        name: string;
        errorRate: number;
        totalErrors: number;
      }>;
    }

    // 创建性能报告
    const reportData: PerformanceReportData = {
      summary: {
        totalPlugins: this.healthData.size,
        healthyPlugins: 0,
        degradedPlugins: 0,
        failedPlugins: 0,
        disabledPlugins: 0,
        totalErrors: 0,
        avgErrorRate: 0,
      },
      pluginStats: [],
      topSlowPlugins: [],
      topErrorPlugins: [],
    };

    let totalErrorRate = 0;

    // 计算统计数据
    for (const health of this.healthData.values()) {
      // 按状态统计插件数量
      if (!health.enabled) {
        reportData.summary.disabledPlugins++;
      } else if (health.status === PluginHealthStatus.HEALTHY) {
        reportData.summary.healthyPlugins++;
      } else if (health.status === PluginHealthStatus.DEGRADED) {
        reportData.summary.degradedPlugins++;
      } else if (health.status === PluginHealthStatus.FAILED) {
        reportData.summary.failedPlugins++;
      }

      // 如果无性能数据，跳过
      if (!health.performance) continue;

      // 累计错误数和错误率
      reportData.summary.totalErrors += health.performance.totalErrors;
      totalErrorRate += health.performance.errorRate;

      // 计算平均执行时间
      const avgTimeValues = Object.values(health.performance.avgExecutionTime);
      const avgExecutionTime =
        avgTimeValues.length > 0
          ? avgTimeValues.reduce((sum, time) => sum + time, 0) / avgTimeValues.length
          : 0;

      // 添加到插件统计数据
      reportData.pluginStats.push({
        name: health.name,
        version: health.version,
        status: health.status,
        errorRate: health.performance.errorRate,
        avgExecutionTime,
        enabled: health.enabled,
      });

      // 找出最慢的钩子
      let slowestHook = '';
      let slowestTime = 0;
      for (const [hook, time] of Object.entries(health.performance.maxExecutionTime)) {
        if (time > slowestTime) {
          slowestTime = time;
          slowestHook = hook;
        }
      }

      // 添加到慢插件列表
      if (avgExecutionTime > 0) {
        reportData.topSlowPlugins.push({
          name: health.name,
          avgExecutionTime,
          slowestHook,
          slowestTime,
        });
      }

      // 添加到高错误率插件列表
      if (health.performance.errorRate > 0) {
        reportData.topErrorPlugins.push({
          name: health.name,
          errorRate: health.performance.errorRate,
          totalErrors: health.performance.totalErrors,
        });
      }
    }

    // 计算平均错误率
    reportData.summary.avgErrorRate =
      this.healthData.size > 0 ? totalErrorRate / this.healthData.size : 0;

    // 排序慢插件列表（降序）
    reportData.topSlowPlugins.sort((a, b) => b.avgExecutionTime - a.avgExecutionTime);
    // 只保留前5个
    reportData.topSlowPlugins = reportData.topSlowPlugins.slice(0, 5);

    // 排序错误率高的插件列表（降序）
    reportData.topErrorPlugins.sort((a, b) => b.errorRate - a.errorRate);
    // 只保留前5个
    reportData.topErrorPlugins = reportData.topErrorPlugins.slice(0, 5);

    // 转换为Record<string, unknown>类型
    return reportData as unknown as Record<string, unknown>;
  }

  /**
   * 重置插件健康状态
   * @param pluginName 插件名称
   */
  public resetPluginHealth(pluginName: string): void {
    const health = this.healthData.get(pluginName);
    if (!health) return;

    health.status = PluginHealthStatus.HEALTHY;
    health.lastError = undefined;
    health.lastErrorTime = undefined;

    if (health.performance) {
      health.performance.totalErrors = 0;
      health.performance.errorCount = {};
      health.performance.errorRate = 0;
    }

    health.lastUpdateTime = Date.now();
  }
}
