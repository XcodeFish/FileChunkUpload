/**
 * 重试统计数据管理器
 * 负责管理和分析重试统计数据
 * @packageDocumentation
 */

import { IUploadError } from '@file-chunk-uploader/types';

import {
  NetworkDetector,
  RetryStats,
  ExtendedErrorContext,
  NetworkConditionRecord,
} from './retry-types';

/**
 * 重试统计数据管理器类
 * 负责记录、分析和管理重试统计数据
 */
export class RetryStatsManager {
  /**
   * 重试历史记录
   * 用于跟踪每个文件的重试成功/失败次数和网络状况
   */
  private retryHistory: Map<string, RetryStats> = new Map();

  /**
   * 网络检测器
   */
  private networkDetector: NetworkDetector;

  /**
   * 构造函数
   * @param networkDetector 网络检测器
   */
  constructor(networkDetector: NetworkDetector) {
    this.networkDetector = networkDetector;
  }

  /**
   * 获取重试统计数据
   * @param fileId 文件ID
   * @returns 重试统计数据
   */
  getRetryStats(fileId: string): RetryStats | undefined {
    return this.retryHistory.get(fileId);
  }

  /**
   * 设置重试统计数据
   * @param fileId 文件ID
   * @param stats 重试统计数据
   */
  setRetryStats(fileId: string, stats: RetryStats): void {
    this.retryHistory.set(fileId, stats);
  }

  /**
   * 更新重试统计数据
   * 记录网络状况和重试时间
   *
   * @param context 错误上下文
   * @param error 错误对象
   * @param _errorType 错误类型（未使用但保留参数以便将来扩展）
   */
  updateRetryStats(
    context: ExtendedErrorContext,
    error: IUploadError,
    _errorType: 'network' | 'server' | 'timeout' | 'unknown',
  ): void {
    const fileId = context.fileId;
    if (!fileId) return;

    let stats = this.retryHistory.get(fileId);
    if (!stats) {
      stats = {
        successCount: 0,
        failCount: 0,
        lastRetryTime: 0,
        networkConditions: [],
      };
      this.retryHistory.set(fileId, stats);
    }

    // 记录当前网络状况
    const networkInfo = this.networkDetector.getCurrentNetwork();
    const networkRecord: NetworkConditionRecord = {
      time: Date.now(),
      online: networkInfo.online,
      type: networkInfo.type || 'unknown',
      speed: networkInfo.speed || 0,
      rtt: networkInfo.rtt || 0,
    };
    stats.networkConditions.push(networkRecord);

    // 保留最近10条记录
    if (stats.networkConditions.length > 10) {
      stats.networkConditions.shift();
    }

    // 更新最后重试时间
    stats.lastRetryTime = Date.now();

    // 记录错误类型，用于后续分析
    if (context.lastError === undefined && error) {
      context.lastError = error;
    }

    // 更新失败计数
    stats.failCount += 1;
  }

  /**
   * 更新重试成功统计
   * 在重试成功时调用，更新成功计数和网络状况
   *
   * @param context 错误上下文
   */
  updateRetrySuccessStats(context: ExtendedErrorContext): void {
    const fileId = context.fileId;
    if (!fileId) return;

    let stats = this.retryHistory.get(fileId);
    if (!stats) {
      stats = {
        successCount: 1, // 初始化为1次成功
        failCount: 0,
        lastRetryTime: Date.now(),
        networkConditions: [],
      };
    } else {
      // 增加成功计数
      stats.successCount += 1;
      // 更新最后重试时间
      stats.lastRetryTime = Date.now();
    }

    // 记录当前网络状况
    const networkInfo = this.networkDetector.getCurrentNetwork();
    const networkRecord: NetworkConditionRecord = {
      time: Date.now(),
      online: networkInfo.online,
      type: networkInfo.type || 'unknown',
      speed: networkInfo.speed || 0,
      rtt: networkInfo.rtt || 0,
    };
    stats.networkConditions.push(networkRecord);

    // 保留最近10条记录
    if (stats.networkConditions.length > 10) {
      stats.networkConditions.shift();
    }

    // 更新重试历史记录
    this.retryHistory.set(fileId, stats);
  }

  /**
   * 更新重试成功计数
   * @param fileId 文件ID
   */
  incrementSuccessCount(fileId: string): void {
    const stats = this.retryHistory.get(fileId);
    if (stats) {
      stats.successCount++;
      stats.lastRetryTime = Date.now();
    } else {
      this.retryHistory.set(fileId, {
        successCount: 1,
        failCount: 0,
        lastRetryTime: Date.now(),
        networkConditions: [],
      });
    }
  }

  /**
   * 更新重试失败计数
   * @param fileId 文件ID
   */
  incrementFailCount(fileId: string): void {
    const stats = this.retryHistory.get(fileId);
    if (stats) {
      stats.failCount++;
      stats.lastRetryTime = Date.now();
    } else {
      this.retryHistory.set(fileId, {
        successCount: 0,
        failCount: 1,
        lastRetryTime: Date.now(),
        networkConditions: [],
      });
    }
  }

  /**
   * 检查成功率是否满足继续重试的条件
   *
   * @param fileId 文件ID
   * @param minSuccessRate 最低成功率阈值
   * @returns 是否满足条件
   */
  checkSuccessRate(fileId: string, minSuccessRate: number): boolean {
    const stats = this.retryHistory.get(fileId);
    if (!stats) return true; // 没有统计数据，默认允许重试

    const totalAttempts = stats.successCount + stats.failCount;
    if (totalAttempts < 5) return true; // 尝试次数少于5次，允许重试

    // 计算成功率
    const successRate = totalAttempts > 0 ? stats.successCount / totalAttempts : 0;

    // 如果成功率低于阈值，不建议重试
    return successRate >= minSuccessRate;
  }

  /**
   * 统计最近一段时间内的失败次数
   * @param fileId 文件ID
   * @param timeWindow 时间窗口（毫秒）
   * @returns 失败次数
   */
  countRecentFailures(fileId: string, timeWindow: number): number {
    const stats = this.retryHistory.get(fileId);
    if (!stats) return 0;

    const now = Date.now();
    const startTime = now - timeWindow;

    // 一个简单的估计，假设失败是均匀分布的
    // 在实际应用中，可以在RetryStats中存储详细的失败时间戳记录
    if (stats.lastRetryTime > startTime) {
      // 估计在时间窗口内的失败次数
      return stats.failCount;
    }
    return 0;
  }

  /**
   * 获取成功计数
   * @param fileId 文件ID
   * @returns 成功计数
   */
  getSuccessCount(fileId: string): number {
    const stats = this.retryHistory.get(fileId);
    return stats ? stats.successCount : 0;
  }

  /**
   * 获取失败计数
   * @param fileId 文件ID
   * @returns 失败计数
   */
  getFailCount(fileId: string): number {
    const stats = this.retryHistory.get(fileId);
    return stats ? stats.failCount : 0;
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.retryHistory.clear();
  }
}

/**
 * 创建重试统计数据管理器的工厂函数
 * @param networkDetector 网络检测器
 * @returns 重试统计数据管理器实例
 */
export function createRetryStatsManager(networkDetector: NetworkDetector): RetryStatsManager {
  return new RetryStatsManager(networkDetector);
}
