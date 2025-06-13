/**
 * 重试配置
 */

/**
 * 重试配置接口
 */
export interface IRetryConfig {
  /** 最大重试次数 */
  maxRetries: number;

  /** 初始延迟时间(毫秒) */
  initialDelayMs: number;

  /** 最大延迟时间(毫秒) */
  maxDelayMs: number;

  /** 退避因子(指数退避算法的倍数) */
  backoffFactor: number;

  /** 是否添加随机抖动 */
  jitter: boolean;

  /** 需要重试的HTTP状态码列表 */
  retryStatusCodes: number[];

  /** 需要重试的错误类型列表 */
  retryErrorTypes: string[];

  /** 重试条件函数 */
  retryCondition?: (error: Error) => boolean;
}

/**
 * 默认重试配置
 */
export const DEFAULT_RETRY_CONFIG: IRetryConfig = {
  maxRetries: 3,
  initialDelayMs: 300,
  maxDelayMs: 10000,
  backoffFactor: 2,
  jitter: true,
  retryStatusCodes: [408, 429, 500, 502, 503, 504],
  retryErrorTypes: ['NetworkError', 'TimeoutError'],
};
