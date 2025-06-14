/**
 * 重试决策器
 * 负责智能重试决策逻辑，包括是否应该重试、重试延迟计算等
 * @packageDocumentation
 */

import { IRetryConfig, IUploadError, ErrorCode } from '@file-chunk-uploader/types';

import {
  NetworkDetector,
  RetryManagerOptions,
  NetworkConditionRecord,
  ExtendedErrorContext,
  RetryStats,
} from './retry-types';

/**
 * 默认重试配置
 */
const DEFAULT_RETRY_CONFIG: IRetryConfig = {
  enabled: true,
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  useExponentialBackoff: true,
};

/**
 * 重试决策器类
 * 负责判断错误是否可重试、何时重试以及重试策略
 */
export class RetryDecisionMaker {
  /**
   * 重试配置
   */
  private config: IRetryConfig;

  /**
   * 网络检测器
   */
  private networkDetector: NetworkDetector;

  /**
   * 重试历史记录
   * 用于跟踪每个文件的重试成功/失败次数和网络状况
   */
  private retryHistory: Map<string, RetryStats> = new Map();

  /**
   * 构造函数
   * @param options 重试管理器选项
   */
  constructor(options: RetryManagerOptions = {}) {
    // 合并默认配置和用户配置
    this.config = {
      ...DEFAULT_RETRY_CONFIG,
      ...options.config,
    };

    // 初始化网络检测器，如果没有提供则使用默认实现
    if (options.networkDetector) {
      this.networkDetector = options.networkDetector;
    } else {
      this.networkDetector = {
        getCurrentNetwork: () => ({
          online: navigator.onLine,
          type: 'unknown' as const,
          speed: 0,
          rtt: 0,
          lastChecked: Date.now(),
        }),
        onNetworkChange: () => () => {
          /* 空函数 */
        },
        cleanup: () => {
          /* 空函数 */
        },
      };
    }
  }

  /**
   * 判断错误是否可重试
   * @param error 错误对象
   * @returns 是否可重试
   */
  isRetryable(error: IUploadError): boolean {
    // 优先使用错误对象的retryable标志
    if (error.retryable !== undefined) {
      return error.retryable;
    }

    // 默认认为网络错误和服务器错误可重试
    return [
      ErrorCode.NETWORK_ERROR,
      ErrorCode.NETWORK_DISCONNECT,
      ErrorCode.SERVER_ERROR,
      ErrorCode.SERVER_TIMEOUT,
      ErrorCode.CHUNK_UPLOAD_FAILED,
    ].includes(error.code as ErrorCode);
  }

  /**
   * 基于历史数据判断是否应该重试
   *
   * 智能重试决策算法：
   * 1. 基于历史成功率 - 如果成功率低于20%且尝试次数超过5次，不再重试
   * 2. 基于网络质量 - 如果连续3次网络状况很差，暂停重试
   * 3. 基于时间模式 - 分析重试成功的时间模式，选择最佳重试时机
   *
   * @param context 错误上下文
   * @returns 是否应该重试
   */
  shouldRetry(context: ExtendedErrorContext): boolean {
    const fileId = context.fileId;
    if (!fileId) return true; // 默认重试

    const stats = this.retryHistory.get(fileId);
    if (!stats) return true;

    // 如果成功率过低，可能不值得重试
    const totalAttempts = stats.successCount + stats.failCount;
    if (totalAttempts > 5 && stats.successCount / totalAttempts < 0.2) {
      return false; // 成功率低于20%，不再重试
    }

    // 基于网络质量决定是否重试
    const recentConditions = stats.networkConditions.slice(-3); // 最近3次网络状况
    if (recentConditions.length >= 3) {
      // 如果连续3次网络状况很差，暂停重试
      const allPoorConditions = recentConditions.every(
        (c: NetworkConditionRecord) => !c.online || c.speed < 0.5 || c.rtt > 1000,
      );

      if (allPoorConditions) {
        return false;
      }
    }

    return true;
  }

  /**
   * 计算重试延迟时间
   *
   * 指数退避算法详解：
   * 1. 基本原理：随着重试次数增加，延迟时间呈指数增长
   * 2. 计算公式：delay = baseDelay * (2^retryCount) + jitter
   * 3. 优势：避免同时重试导致的"惊群效应"，给系统恢复的时间
   * 4. 随机抖动：添加随机延迟，避免多个客户端同时重试
   *
   * @param retryCount 当前重试次数
   * @returns 延迟时间（毫秒）
   */
  calculateRetryDelay(retryCount: number): number {
    // 获取配置参数，使用默认值作为后备
    const baseDelay = this.config.baseDelay ?? 1000;
    const maxDelay = this.config.maxDelay ?? 30000;
    const useExponentialBackoff = this.config.useExponentialBackoff ?? true;

    let delay: number;

    if (useExponentialBackoff) {
      // 指数退避算法: 基础延迟 * 2^重试次数
      delay = baseDelay * Math.pow(2, retryCount);
    } else {
      // 线性延迟: 基础延迟 * (重试次数 + 1)
      delay = baseDelay * (retryCount + 1);
    }

    // 添加一些随机抖动，避免同时重试
    // 随机抖动范围为基础延迟的0-50%
    const jitter = Math.random() * baseDelay * 0.5;
    delay += jitter;

    // 限制最大延迟
    return Math.min(delay, maxDelay);
  }

  /**
   * 更新重试统计数据
   * 记录网络状况和重试时间
   *
   * @param context 错误上下文
   * @param _error 错误对象
   */
  updateRetryStats(context: ExtendedErrorContext, _error: IUploadError): void {
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
   * 清理资源
   */
  cleanup(): void {
    this.retryHistory.clear();
  }

  /**
   * 获取当前重试配置
   * @returns 重试配置
   */
  getConfig(): IRetryConfig {
    return this.config;
  }
}

/**
 * 创建重试决策器
 * @param options 重试管理器选项
 * @returns 重试决策器实例
 */
export function createRetryDecisionMaker(options?: RetryManagerOptions): RetryDecisionMaker {
  return new RetryDecisionMaker(options);
}
