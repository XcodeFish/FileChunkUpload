/**
 * @file-chunk-uploader/types/etaCalculator
 * 动态剩余时间预测算法相关类型定义
 */

/**
 * 速度采样点接口
 */
export interface ISpeedSample {
  /** 采样时间戳（毫秒） */
  timestamp: number;
  /** 已上传字节数 */
  bytes: number;
}

/**
 * ETA计算器配置选项
 */
export interface IETACalculatorOptions {
  /** 平滑系数 (0-1之间，越大越平滑) */
  smoothingFactor?: number;
  /** 最大波动阈值 (0-1之间) */
  maxSpeedDiff?: number;
  /** 采样窗口大小 */
  timeWindow?: number;
  /** 最小采样数量 */
  minSamples?: number;
  /** 计算缓存时间（毫秒） */
  cacheTime?: number;
}

/**
 * ETA计算结果
 */
export interface IETAResult {
  /** 预估剩余时间（秒） */
  seconds: number | null;
  /** 格式化后的剩余时间 */
  formatted: string;
  /** 网络状态 */
  networkState: 'idle' | 'initializing' | 'stabilizing' | 'stable';
  /** 采样数量 */
  sampleCount: number;
}
