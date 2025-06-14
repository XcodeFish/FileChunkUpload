/**
 * 重试决策器
 * 负责智能重试决策逻辑，包括是否应该重试、重试延迟计算等
 * @packageDocumentation
 */

import { IUploadError } from '@file-chunk-uploader/types';

import { DEFAULT_RETRY_CONFIG, ExtendedRetryConfig } from './retry-default-config';
import { RetryErrorAnalyzer, createRetryErrorAnalyzer } from './retry-error-analyzer';
import { RetryQualityAnalyzer, createRetryQualityAnalyzer } from './retry-quality-analyzer';
import { RetryStatsManager, createRetryStatsManager } from './retry-stats-manager';
import { RetryManagerOptions, ExtendedErrorContext, NetworkInfo } from './retry-types';

/**
 * 重试决策器类
 * 使用组合模式整合网络质量分析、重试统计数据管理和错误分析
 * 以提供智能的重试决策
 */
export class RetryDecisionMaker {
  /**
   * 重试配置
   */
  private config: ExtendedRetryConfig;

  /**
   * 网络质量分析器
   */
  private qualityAnalyzer: RetryQualityAnalyzer;

  /**
   * 重试统计数据管理器
   */
  private statsManager: RetryStatsManager;

  /**
   * 错误分析器
   */
  private errorAnalyzer: RetryErrorAnalyzer;

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

    // 创建网络检测器
    const networkDetector = options.networkDetector || createDefaultNetworkDetector();

    // 初始化子模块
    this.qualityAnalyzer = createRetryQualityAnalyzer(networkDetector, this.config);
    this.statsManager = createRetryStatsManager(networkDetector);
    this.errorAnalyzer = createRetryErrorAnalyzer();
  }

  /**
   * 基于历史数据判断是否应该重试
   *
   * 智能重试决策算法：
   * 1. 基于历史成功率 - 如果成功率低于阈值且尝试次数超过阈值，不再重试
   * 2. 基于网络质量 - 如果网络状况不佳，可能会调整重试策略或暂停重试
   * 3. 基于错误类型 - 针对不同类型的错误采用不同的重试策略
   * 4. 自适应重试次数 - 动态调整最大重试次数，根据历史成功率和网络状况
   *
   * @param context 错误上下文
   * @param error 错误对象
   * @returns 是否应该重试
   */
  shouldRetry(context: ExtendedErrorContext, error: IUploadError): boolean {
    // 如果重试功能被禁用，不进行重试
    if (this.config.enabled === false) {
      return false;
    }

    const fileId = context.fileId;
    if (!fileId) return true; // 默认重试

    // 检查是否已达到重试次数上限
    if (!this.checkRetryCount(context, error)) {
      return false;
    }

    // 如果没有启用智能决策，直接返回true
    if (this.config.useSmartDecision === false) {
      return true;
    }

    // 1. 基于历史成功率的决策
    const minSuccessRate = this.config.minSuccessRate || DEFAULT_RETRY_CONFIG.minSuccessRate!;
    if (!this.statsManager.checkSuccessRate(fileId, minSuccessRate)) {
      return false;
    }

    // 2. 基于网络质量的决策
    const stats = this.statsManager.getRetryStats(fileId);
    if (stats && !this.qualityAnalyzer.checkNetworkQuality(stats.networkConditions)) {
      return false;
    }

    // 3. 基于错误类型的决策
    return this.errorAnalyzer.isErrorRetryable(error);
  }

  /**
   * 检查重试次数是否超过限制
   * 自适应调整最大重试次数
   *
   * @param context 错误上下文
   * @param error 错误对象
   * @returns 是否未超过重试次数限制
   */
  private checkRetryCount(context: ExtendedErrorContext, error: IUploadError): boolean {
    // 全局最大重试次数限制
    const globalMaxRetries = this.config.maxRetries ?? DEFAULT_RETRY_CONFIG.maxRetries!;
    const fileId = context.fileId;
    if (!fileId) return true; // 无法判断，默认通过

    // 获取错误类型
    const errorType = this.errorAnalyzer.getErrorType(error);

    // 获取针对该错误类型的最大重试次数
    let typeMaxRetries =
      this.config.errorTypeRetries?.[errorType] ??
      DEFAULT_RETRY_CONFIG.errorTypeRetries?.[errorType] ??
      globalMaxRetries;

    // 自适应调整最大重试次数
    if (this.config.useSmartDecision !== false) {
      // 获取网络质量
      const currentNetworkQuality = this.qualityAnalyzer.getNetworkQuality();

      // 根据网络质量调整重试次数
      switch (currentNetworkQuality.quality) {
        case 'good':
          // 好的网络下增加重试次数
          typeMaxRetries = Math.min(typeMaxRetries + 2, 10);
          break;
        case 'fair':
          // 一般网络下保持不变
          break;
        case 'poor':
          // 差的网络下减少重试次数，但保证至少有1次重试机会
          typeMaxRetries = Math.max(typeMaxRetries - 2, 1);
          break;
        case 'offline':
          // 离线状态下，最多只尝试1次
          typeMaxRetries = 1;
          break;
      }

      // 根据错误类型和其重试成功历史再次调整
      const successCount = this.statsManager.getSuccessCount(fileId);
      const failCount = this.statsManager.getFailCount(fileId);

      if (failCount > 0 && successCount === 0) {
        // 如果从来没有成功过，减少重试次数
        typeMaxRetries = Math.max(1, Math.floor(typeMaxRetries / 2));
      } else if (successCount > failCount) {
        // 如果成功多于失败，增加重试次数
        typeMaxRetries = Math.min(typeMaxRetries + 1, 10);
      }
    }

    // 检查特定分片的重试次数限制
    const maxRetriesPerChunk = this.config.maxRetriesPerChunk;
    if (context.chunkIndex !== undefined && maxRetriesPerChunk !== undefined) {
      const chunkRetries = context.chunkRetries?.[context.chunkIndex] ?? 0;
      if (chunkRetries >= maxRetriesPerChunk) {
        return false;
      }
    }

    // 决策：是否未达到该错误类型的重试上限
    return context.retryCount < typeMaxRetries;
  }

  /**
   * 计算重试延迟时间
   *
   * 指数退避算法详解：
   * 1. 基本原理：随着重试次数增加，延迟时间呈指数增长
   * 2. 计算公式：delay = baseDelay * (2^retryCount) + jitter
   * 3. 优势：避免同时重试导致的"惊群效应"，给系统恢复的时间
   * 4. 网络自适应：根据网络状况调整延迟
   * 5. 错误类型自适应：不同错误类型有不同的基础延迟
   *
   * @param retryCount 当前重试次数
   * @param error 错误对象（可选）
   * @returns 延迟时间（毫秒）
   */
  calculateRetryDelay(retryCount: number, error?: IUploadError): number {
    // 获取配置参数，使用默认值作为后备
    const baseDelay = this.config.baseDelay ?? DEFAULT_RETRY_CONFIG.baseDelay!;
    const maxDelay = this.config.maxDelay ?? DEFAULT_RETRY_CONFIG.maxDelay!;
    const useExponentialBackoff =
      this.config.useExponentialBackoff ?? DEFAULT_RETRY_CONFIG.useExponentialBackoff!;

    // 根据错误类型调整基础延迟
    let adjustedBaseDelay = baseDelay;
    let errorTypeFactor = 1.0;

    if (error) {
      const errorType = this.errorAnalyzer.getErrorType(error);
      errorTypeFactor = this.errorAnalyzer.getErrorTypeDelayFactor(errorType);
      adjustedBaseDelay = baseDelay * errorTypeFactor;

      // 特殊错误处理：服务器过载错误使用更长的基础延迟
      const errorAnalysis = this.errorAnalyzer.analyzeError(error);
      if (!errorAnalysis.shouldRetry) {
        // 如果分析结果建议不重试，返回一个很长的延迟
        return maxDelay;
      }

      // 使用推荐的延迟作为基础
      if (errorAnalysis.recommendedDelay > 0) {
        adjustedBaseDelay = errorAnalysis.recommendedDelay;
      }
    }

    // 根据网络质量调整延迟
    const networkQuality = this.qualityAnalyzer.getNetworkQuality();
    const networkBasedDelay = this.qualityAnalyzer.calculateNetworkBasedWaitTime(networkQuality);

    // 将网络质量因素纳入计算
    let delay: number;
    if (useExponentialBackoff) {
      // 指数退避算法
      delay = adjustedBaseDelay * Math.pow(2, retryCount);

      // 将网络质量纳入考量，网络越差，延迟越长
      // 为了避免延迟过长，我们使用加权平均
      delay = (delay + networkBasedDelay) / 2;
    } else {
      // 线性增长算法
      delay = adjustedBaseDelay * (retryCount + 1);

      // 将网络质量纳入考量
      delay = (delay + networkBasedDelay) / 2;
    }

    // 添加随机抖动避免同时重试
    // 默认抖动因子为0.1
    const defaultJitterFactor = 0.1;
    // 由于配置中没有 jitterFactor，直接使用默认值
    const jitterFactor = defaultJitterFactor;
    // 随着重试次数增加，减小jitter范围，使延迟更加可预测
    const adjustedJitterFactor = jitterFactor / (1 + retryCount * 0.2);
    const jitter = delay * adjustedJitterFactor * (Math.random() * 2 - 1);
    delay += jitter;

    // 确保不超过最大延迟
    return Math.min(delay, maxDelay);
  }

  /**
   * 更新重试统计数据
   * 记录网络状况和重试时间
   *
   * @param context 错误上下文
   * @param error 错误对象
   */
  updateRetryStats(context: ExtendedErrorContext, error: IUploadError): void {
    // 获取错误类型
    const errorType = this.errorAnalyzer.getErrorType(error);

    // 使用统计管理器更新重试数据
    this.statsManager.updateRetryStats(context, error, errorType);
  }

  /**
   * 更新重试成功统计
   * 在重试成功时调用，更新成功计数和网络状况
   *
   * @param context 错误上下文
   */
  updateRetrySuccessStats(context: ExtendedErrorContext): void {
    this.statsManager.updateRetrySuccessStats(context);
  }

  /**
   * 处理重试成功
   * 更新成功统计信息并记录相关数据
   *
   * @param context 错误上下文
   */
  async handleRetrySuccess(context: ExtendedErrorContext): Promise<void> {
    // 调用已有的方法更新重试成功统计
    this.updateRetrySuccessStats(context);
  }

  /**
   * 获取成功次数
   * @param fileId 文件ID
   * @returns 成功次数
   */
  getSuccessCount(fileId: string): number {
    return this.statsManager.getSuccessCount(fileId);
  }

  /**
   * 获取失败次数
   * @param fileId 文件ID
   * @returns 失败次数
   */
  getFailCount(fileId: string): number {
    return this.statsManager.getFailCount(fileId);
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.statsManager.cleanup();
  }
}

/**
 * 创建重试决策器的工厂函数
 * @param options 重试管理器选项
 * @returns 重试决策器实例
 */
export function createRetryDecisionMaker(options?: RetryManagerOptions): RetryDecisionMaker {
  return new RetryDecisionMaker(options);
}

/**
 * 默认网络检测器
 * 提供基本的网络检测功能
 */
const createDefaultNetworkDetector = () => {
  return {
    getCurrentNetwork: (): NetworkInfo => ({
      online: typeof navigator !== 'undefined' ? navigator.onLine : true,
      type: 'unknown',
      speed: 1,
      rtt: 100,
    }),
    onNetworkChange: (callback: (network: NetworkInfo) => void) => {
      if (typeof window !== 'undefined') {
        window.addEventListener('online', () =>
          callback({
            online: true,
            type: 'unknown',
            speed: 1,
            rtt: 100,
          }),
        );
        window.addEventListener('offline', () =>
          callback({
            online: false,
            type: 'unknown',
            speed: 0,
            rtt: 10000,
          }),
        );
      }
      return () => {
        if (typeof window !== 'undefined') {
          window.removeEventListener('online', callback as any);
          window.removeEventListener('offline', callback as any);
        }
      };
    },
    cleanup: () => {
      // 无需清理的默认实现
    },
  };
};

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
