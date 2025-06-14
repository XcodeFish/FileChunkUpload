/**
 * 重试默认配置
 * 统一管理重试相关的默认配置值
 * @packageDocumentation
 */

import { IRetryConfig } from '@file-chunk-uploader/types';

/**
 * 扩展的重试配置，包含标准配置之外的选项
 */
export interface ExtendedRetryConfig extends IRetryConfig {
  /**
   * 抖动因子，用于计算随机延迟的范围
   * 值越大，随机范围越大
   */
  jitterFactor?: number;
}

/**
 * 默认重试配置
 * 定义所有重试相关的默认参数值
 */
export const DEFAULT_RETRY_CONFIG: Partial<ExtendedRetryConfig> = {
  enabled: true,
  maxRetries: 5,
  maxRetriesPerChunk: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  useExponentialBackoff: true,
  useSmartDecision: true,
  minSuccessRate: 0.3,
  jitterFactor: 0.1,
  networkQualityThreshold: {
    minSpeed: 0.5, // 最小网络速度阈值 (Mbps)
    maxRtt: 1000, // 最大RTT阈值 (ms)
  },
  errorTypeRetries: {
    network: 5,
    server: 3,
    timeout: 4,
    unknown: 2,
  },
};
