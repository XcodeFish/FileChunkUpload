/**
 * 重试配置默认值
 * 提供重试管理器的默认配置参数
 * @packageDocumentation
 */

import { IRetryConfig } from '@file-chunk-uploader/types';

/**
 * 扩展的重试配置接口
 * 在基础重试配置上增加更多高级选项
 */
export interface ExtendedRetryConfig extends IRetryConfig {
  /**
   * 是否使用智能决策
   * 基于历史重试成功率动态调整重试策略
   */
  useSmartDecision?: boolean;

  /**
   * 最小成功率阈值
   * 低于此阈值将减少重试次数
   */
  minSuccessRate?: number;

  /**
   * 每个分片的最大重试次数
   */
  maxRetriesPerChunk?: number;

  /**
   * 网络质量阈值
   * 定义不同网络条件下的重试策略参数
   */
  networkQualityThreshold?: {
    /**
     * 最低速度（Mbps）
     */
    minSpeed?: number;

    /**
     * 最大RTT阈值（毫秒）
     */
    maxRtt?: number;
  };

  /**
   * 不同错误类型的重试次数配置
   */
  errorTypeRetries?: {
    /**
     * 网络错误最大重试次数
     */
    network?: number;

    /**
     * 服务器错误最大重试次数
     */
    server?: number;

    /**
     * 超时错误最大重试次数
     */
    timeout?: number;

    /**
     * 未知错误最大重试次数
     */
    unknown?: number;
  };
}

/**
 * 默认重试配置
 * 提供合理的默认值
 */
export const DEFAULT_RETRY_CONFIG: ExtendedRetryConfig = {
  // 基本配置
  enabled: true,
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  useExponentialBackoff: true,
  persistRetryState: true,

  // 扩展配置
  useSmartDecision: true,
  minSuccessRate: 0.3,
  maxRetriesPerChunk: 5,

  // 网络质量阈值
  networkQualityThreshold: {
    minSpeed: 0.5,
    maxRtt: 800,
  },

  // 错误类型重试配置
  errorTypeRetries: {
    network: 5,
    server: 3,
    timeout: 3,
    unknown: 1,
  },
};
