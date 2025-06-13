/**
 * 性能指标记录模块
 * 负责记录和分析上传性能数据
 * @module chunk-strategy/performance-tracker
 */
import { IEventEmitter, ILogger } from '@file-chunk-uploader/types';

/**
 * 性能指标类型
 */
export type PerformanceMetricType =
  | 'init'
  | 'createChunks'
  | 'uploadStart'
  | 'chunkUpload'
  | 'merge'
  | 'complete'
  | 'error'
  | 'retry';

/**
 * 性能指标接口
 */
export interface IPerformanceMetric {
  /** 文件ID */
  fileId?: string;
  /** 指标类别 */
  category: string;
  /** 操作名称 */
  operation: string;
  /** 持续时间（毫秒） */
  duration: number;
  /** 时间戳 */
  timestamp: number;
  /** 额外数据 */
  data?: Record<string, any>;
}

/**
 * 性能指标统计
 */
export interface IPerformanceStats {
  /** 平均时间（毫秒） */
  average: number;
  /** 最小时间（毫秒） */
  min: number;
  /** 最大时间（毫秒） */
  max: number;
  /** 总时间（毫秒） */
  total: number;
  /** 样本数量 */
  count: number;
  /** 中位数（毫秒） */
  median?: number;
}

/**
 * 性能指标记录器类
 * 负责记录和分析上传性能数据
 */
export class PerformanceTracker {
  /** 性能指标记录 */
  private metrics: Map<string, IPerformanceMetric[]> = new Map();

  /**
   * 构造函数
   * @param eventEmitter 事件发射器
   * @param logger 日志记录器
   */
  constructor(
    private readonly eventEmitter?: IEventEmitter,
    private readonly logger?: ILogger,
  ) {
    // 订阅性能指标事件
    if (eventEmitter) {
      eventEmitter.on('performance:metric', this.recordMetric.bind(this));
    }
  }

  /**
   * 记录性能指标
   * @param metric 性能指标
   */
  public recordMetric(metric: IPerformanceMetric): void {
    const { category, operation } = metric;
    const key = `${category}:${operation}`;

    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }

    this.metrics.get(key)!.push(metric);

    this.logDebug(`记录性能指标: ${key}`, {
      duration: `${metric.duration.toFixed(2)}ms`,
      fileId: metric.fileId || 'unknown',
    });
  }

  /**
   * 开始计时
   * @param category 指标类别
   * @param operation 操作名称
   * @param fileId 文件ID
   * @returns 计时对象
   */
  public startTiming(category: string, operation: string, fileId?: string): { end: () => number } {
    const startTime = performance.now();

    return {
      end: () => {
        const endTime = performance.now();
        const duration = endTime - startTime;

        this.recordMetric({
          fileId,
          category,
          operation,
          duration,
          timestamp: Date.now(),
        });

        return duration;
      },
    };
  }

  /**
   * 获取性能统计
   * @param category 指标类别
   * @param operation 操作名称，可选
   * @returns 性能统计
   */
  public getStats(category: string, operation?: string): Record<string, IPerformanceStats> {
    const stats: Record<string, IPerformanceStats> = {};

    // 获取所有键
    const keys = Array.from(this.metrics.keys());

    // 过滤符合类别和操作的键
    const filteredKeys = keys.filter(key => {
      if (operation) {
        return key === `${category}:${operation}`;
      }
      return key.startsWith(`${category}:`);
    });

    // 计算统计值
    filteredKeys.forEach(key => {
      const metrics = this.metrics.get(key)!;
      const durations = metrics.map(m => m.duration).sort((a, b) => a - b);

      const total = durations.reduce((sum, d) => sum + d, 0);
      const count = durations.length;
      const average = total / count;
      const min = durations[0];
      const max = durations[durations.length - 1];
      const median =
        count % 2 === 0
          ? (durations[count / 2 - 1] + durations[count / 2]) / 2
          : durations[Math.floor(count / 2)];

      stats[key] = {
        average,
        min,
        max,
        total,
        count,
        median,
      };
    });

    return stats;
  }

  /**
   * 重置性能指标记录
   * @param category 指标类别，可选，不提供则重置所有
   * @param operation 操作名称，可选，不提供则重置指定类别的所有
   */
  public reset(category?: string, operation?: string): void {
    if (!category) {
      // 重置所有
      this.metrics.clear();
      this.logDebug('重置所有性能指标');
      return;
    }

    if (category && !operation) {
      // 重置指定类别的所有操作
      const keysToDelete: string[] = [];
      // 使用Array.from代替for...of循环
      Array.from(this.metrics.keys()).forEach(key => {
        if (key.startsWith(`${category}:`)) {
          keysToDelete.push(key);
        }
      });

      keysToDelete.forEach(key => this.metrics.delete(key));
      this.logDebug(`重置类别性能指标: ${category}`);
      return;
    }

    // 重置指定类别和操作
    const key = `${category}:${operation}`;
    this.metrics.delete(key);
    this.logDebug(`重置操作性能指标: ${key}`);
  }

  /**
   * 记录调试日志
   * @param message 日志消息
   * @param data 附加数据
   */
  private logDebug(message: string, data?: any): void {
    if (this.logger) {
      this.logger.debug('performance', message, data);
    }
  }
}
