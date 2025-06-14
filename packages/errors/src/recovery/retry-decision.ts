/**
 * 重试决策器
 * 负责智能重试决策逻辑，包括是否应该重试、重试延迟计算等
 * @packageDocumentation
 */

import { IUploadError } from '@file-chunk-uploader/types';

import { DEFAULT_RETRY_CONFIG, ExtendedRetryConfig } from './retry-default-config';
import { ExtendedErrorContext, NetworkInfo, RetryManagerOptions } from './retry-types';

/**
 * 错误类型到错误类别的映射
 */
export const ERROR_TYPE_MAP: Record<string, 'network' | 'server' | 'timeout' | 'unknown'> = {
  network_error: 'network',
  network_disconnect: 'network',
  server_error: 'server',
  server_overload: 'server',
  server_timeout: 'timeout',
  timeout: 'timeout',
  unknown_error: 'unknown',
};

/**
 * 错误分析结果接口
 */
export interface ErrorAnalysisResult {
  /** 错误类型 */
  errorType: 'network' | 'server' | 'timeout' | 'unknown';
  /** 是否建议重试 */
  shouldRetry: boolean;
  /** 推荐的延迟时间 */
  recommendedDelay: number;
  /** 推荐的重试次数 */
  recommendedRetryCount?: number;
  /** 错误详情 */
  details?: Record<string, any>;
}

/**
 * 网络质量接口
 */
export interface NetworkQuality {
  /** 质量等级 */
  quality: 'good' | 'fair' | 'poor' | 'offline';
  /** 在线状态 */
  online: boolean;
  /** 网络类型 */
  type: string;
  /** 速度估计 */
  speedEstimate: number;
  /** RTT估计 */
  rttEstimate: number;
  /** 最后更新时间 */
  timestamp: number;
}

/**
 * 重试决策器类（简化版）
 * 用于决定是否应该重试、如何重试
 */
export class RetryDecisionMaker {
  /**
   * 重试配置
   */
  private config: ExtendedRetryConfig;

  /**
   * 构造函数
   * @param options 重试管理器选项
   */
  constructor(options: RetryManagerOptions = {}) {
    // 合并默认配置和用户配置
    this.config = {
      ...DEFAULT_RETRY_CONFIG,
      ...options.config,
      // 确保嵌套属性也被正确合并
      networkQualityThreshold: {
        ...DEFAULT_RETRY_CONFIG.networkQualityThreshold,
        ...options.config?.networkQualityThreshold,
      },
      errorTypeRetries: {
        ...DEFAULT_RETRY_CONFIG.errorTypeRetries,
        ...options.config?.errorTypeRetries,
      },
    } as ExtendedRetryConfig;
  }

  /**
   * 决定是否应该重试
   * @param context 错误上下文
   * @param error 错误对象
   * @returns 是否应该重试
   */
  shouldRetry(context: ExtendedErrorContext, error: IUploadError): boolean {
    // 如果重试功能被禁用，不进行重试
    if (this.config.enabled === false) {
      return false;
    }

    // 检查是否已超过最大重试次数
    const maxRetries = this.config.maxRetries || DEFAULT_RETRY_CONFIG.maxRetries || 3;
    if (context.retryCount >= maxRetries) {
      return false;
    }

    // 检查错误是否可重试
    if (error && !error.retryable) {
      return false;
    }

    // 检查特定分片的重试次数限制
    if (context.chunkIndex !== undefined && this.config.maxRetriesPerChunk !== undefined) {
      const chunkRetries = context.chunkRetries?.[context.chunkIndex] ?? 0;
      if (chunkRetries >= this.config.maxRetriesPerChunk) {
        return false;
      }
    }

    return true;
  }

  /**
   * 计算重试延迟时间
   * @param retryCount 当前重试次数
   * @param error 错误对象（可选）
   * @returns 延迟时间（毫秒）
   */
  calculateRetryDelay(retryCount: number, error?: IUploadError): number {
    // 获取配置参数
    const baseDelay = this.config.baseDelay || DEFAULT_RETRY_CONFIG.baseDelay || 1000;
    const maxDelay = this.config.maxDelay || DEFAULT_RETRY_CONFIG.maxDelay || 30000;
    const useExponentialBackoff =
      this.config.useExponentialBackoff ?? DEFAULT_RETRY_CONFIG.useExponentialBackoff ?? true;

    let delay: number;

    if (useExponentialBackoff) {
      // 指数退避算法: baseDelay * 2^retryCount
      delay = baseDelay * Math.pow(2, retryCount);
    } else {
      // 线性增长: baseDelay * (retryCount + 1)
      delay = baseDelay * (retryCount + 1);
    }

    // 增加随机抖动以避免并发重试
    const jitter = Math.random() * baseDelay * 0.1;
    delay += jitter;

    // 特殊错误类型处理
    if (error) {
      if (error.code.toLowerCase() === 'server_overload') {
        // 服务器过载，使用更长延迟
        delay = Math.max(delay * 1.5, 5000);
      } else if (error.code.toLowerCase() === 'network_disconnect') {
        // 网络断开，使用较短延迟以便快速恢复
        delay = Math.min(delay, 2000);
      }
    }

    // 确保不超过最大延迟
    return Math.min(delay, maxDelay);
  }

  /**
   * 更新重试统计
   * @param context 错误上下文
   * @param error 错误对象
   */
  updateRetryStats(context: ExtendedErrorContext, error: IUploadError): void {
    // 简化版实现，实际可以添加统计逻辑
    context.lastError = error;
    context.retryCount = context.retryCount + 1 || 1;
    context.startTime = Date.now();

    // 更新分片重试次数
    if (context.chunkIndex !== undefined) {
      if (!context.chunkRetries) {
        context.chunkRetries = {};
      }
      context.chunkRetries[context.chunkIndex] =
        (context.chunkRetries[context.chunkIndex] || 0) + 1;
    }
  }

  /**
   * 更新重试成功统计
   * @param context 错误上下文
   */
  updateRetrySuccessStats(context: ExtendedErrorContext): void {
    // 简化版实现，实际可以添加成功统计逻辑
    context.successfulRetries = (context.successfulRetries || 0) + 1;
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    // 简化版实现，清理资源
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

/**
 * 获取基于网络状况的重试决策
 * @param networkInfo 网络信息
 * @returns 是否应该重试
 */
export function shouldRetryBasedOnNetwork(networkInfo: NetworkInfo): boolean {
  // 如果离线，则不建议重试
  if (!networkInfo.online) {
    return false;
  }

  // 如果RTT过高，网络质量差，建议减少重试
  if (networkInfo.rtt > 1000) {
    return false;
  }

  return true;
}
