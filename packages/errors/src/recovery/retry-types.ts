/**
 * 重试机制类型定义文件
 * 包含重试机制所需的接口和类型
 * @packageDocumentation
 */

import { IUploadError, IErrorContext, IRetryConfig } from '@file-chunk-uploader/types';

import { CountdownManager } from './countdown-manager';
import { ProgressTracker } from './progress-tracker';

/**
 * 重试统计数据接口
 * 记录文件重试的成功/失败次数和网络状况
 */
export interface RetryStats {
  /** 成功次数 */
  successCount: number;
  /** 失败次数 */
  failCount: number;
  /** 最后重试时间 */
  lastRetryTime: number;
  /** 网络状况记录 */
  networkConditions: NetworkConditionRecord[];
}

/**
 * 扩展的错误上下文接口
 * 包含重试管理器需要的额外字段
 */
export interface ExtendedErrorContext extends IErrorContext {
  /** 重试开始时间戳 */
  startTime?: number;
  /** 最后错误 */
  lastError?: IUploadError;
}

/**
 * 网络状况记录接口
 * 记录重试时的网络环境信息
 */
export interface NetworkConditionRecord {
  /** 记录时间 */
  time: number;
  /** 是否在线 */
  online: boolean;
  /** 网络类型 */
  type: 'wifi' | 'cellular' | 'ethernet' | 'unknown';
  /** 网络速度（Mbps） */
  speed: number;
  /** RTT（毫秒） */
  rtt: number;
}

/**
 * 重试进度信息接口
 * 提供重试过程中的进度详细信息
 */
export interface RetryProgressInfo {
  /** 当前重试次数 */
  currentRetry: number;
  /** 最大重试次数 */
  maxRetries: number;
  /** 百分比进度 (0-100) */
  percentage: number;
  /** 是否为最后一次重试尝试 */
  isLastAttempt: boolean;
  /** 总体重试统计 (成功/失败/总计) */
  stats?: {
    /** 成功次数 */
    successCount: number;
    /** 失败次数 */
    failCount: number;
    /** 总尝试次数 */
    totalAttempts: number;
  };
  /** 分片索引 */
  chunkIndex?: number;
  /** 任务是否已完成 */
  isCompleted?: boolean;
}

/**
 * 重试倒计时信息
 * 提供重试倒计时详细信息
 */
export interface RetryCountdownInfo {
  /** 任务ID */
  taskId: string;
  /** 剩余时间（毫秒） */
  remainingTime: number;
  /** 总延迟时间（毫秒） */
  totalDelay: number;
  /** 进度百分比 (0-100) */
  progressPercentage: number;
  /** 是否已暂停 */
  isPaused: boolean;
  /** 是否已完成 */
  isCompleted: boolean;
  /** 预期执行时间戳 */
  expectedExecutionTime: number;
}

/**
 * 重试网络信息
 * 提供重试决策的网络环境信息
 */
export interface RetryNetworkInfo {
  /** 当前网络信息 */
  currentNetwork: NetworkInfo;
  /** 是否建议重试 */
  isRetryRecommended: boolean;
}

/**
 * 重试策略信息
 * 提供重试策略的详细信息
 */
export interface RetryStrategyInfo {
  /** 重试算法 */
  algorithm: 'exponential' | 'linear' | 'custom';
  /** 基础延迟（毫秒） */
  baseDelay: number;
  /** 最大延迟（毫秒） */
  maxDelay: number;
  /** 是否使用抖动 */
  useJitter: boolean;
}

/**
 * 重试开始信息接口
 * 提供重试开始时的详细信息
 */
export interface RetryStartInfo {
  /** 文件ID */
  fileId?: string;
  /** 分片索引 */
  chunkIndex?: number;
  /** 重试次数 */
  retryCount: number;
  /** 延迟时间（毫秒） */
  delay: number;
  /** 错误信息 */
  error: IUploadError;
  /** 任务ID */
  taskId: string;
  /** 任务类型 */
  type: 'retry' | 'network_recovery' | 'adjust_chunk';
  /** 进度信息 */
  progress?: RetryProgressInfo;
  /** 倒计时信息 */
  countdown?: RetryCountdownInfo;
  /** 网络信息 */
  network?: RetryNetworkInfo;
  /** 重试策略信息 */
  strategy?: RetryStrategyInfo;
}

/**
 * 重试成功信息接口
 * 提供重试成功的详细信息
 */
export interface RetrySuccessInfo {
  /** 文件ID */
  fileId?: string;
  /** 分片索引 */
  chunkIndex?: number;
  /** 成功计数 */
  successCount: number;
  /** 开始时间戳 */
  startTimestamp: number;
  /** 完成时间戳 */
  completeTimestamp: number;
  /** 持续时间（毫秒） */
  duration?: number;
  /** 网络信息 */
  network?: NetworkInfo;
  /** 历史统计 */
  history?: {
    /** 总重试次数 */
    totalRetries: number;
    /** 成功重试次数 */
    successfulRetries: number;
    /** 成功率 (0-1) */
    successRate: number;
  };
}

/**
 * 重试失败信息接口
 * 提供重试失败的详细信息
 */
export interface RetryFailedInfo {
  /** 文件ID */
  fileId?: string;
  /** 分片索引 */
  chunkIndex?: number;
  /** 错误对象 */
  error: IUploadError;
  /** 是否可恢复 */
  recoverable: boolean;
  /** 重试次数 */
  retryCount?: number;
  /** 最大重试次数 */
  maxRetries?: number;
  /** 原因描述 */
  reason?: string;
  /** 发生时间戳 */
  timestamp: number;
  /** 建议采取的动作 */
  suggestedAction?: 'cancel' | 'manual_retry' | 'wait_for_network' | 'reduce_chunk_size';
  /** 历史统计 */
  history?: {
    /** 尝试次数 */
    attempts: number;
    /** 失败次数 */
    failures: number;
    /** 失败率 (0-1) */
    failureRate: number;
  };
  /** 网络信息 */
  network?: NetworkInfo;
}

/**
 * 重试网络信息
 * 提供重试网络环境信息
 */
export interface NetworkInfo {
  /** 是否在线 */
  online: boolean;
  /** 网络类型 */
  type?: 'wifi' | 'cellular' | 'ethernet' | 'unknown';
  /** 网络速度（Mbps） */
  speed?: number;
  /** RTT（毫秒） */
  rtt?: number;
  /** 最后检测时间 */
  lastChecked: number;
}

/**
 * 重试任务接口
 * 描述一个待执行的重试任务
 */
export interface RetryTask {
  /** 任务ID */
  id: string;
  /** 文件ID */
  fileId?: string;
  /** 分片索引 */
  chunkIndex?: number;
  /** 任务类型 */
  type: 'retry' | 'network_recovery' | 'adjust_chunk';
  /** 计划执行时间 */
  scheduledTime: number;
  /** 延迟时间（毫秒） */
  delay: number;
  /** 错误上下文 */
  context: ExtendedErrorContext;
  /** 错误对象 */
  error: IUploadError;
  /** 任务处理函数 */
  handler: () => Promise<void>;
  /** 是否已处理 */
  handled: boolean;
  /** 创建时间 */
  createdAt: number;
}

/**
 * 网络检测器接口
 * 提供网络状态检测功能
 */
export interface NetworkDetector {
  /** 获取当前网络状态 */
  getCurrentNetwork(): NetworkInfo;
  /** 添加网络变化监听器 */
  onNetworkChange(callback: (network: NetworkInfo) => void): () => void;
  /** 清理资源 */
  cleanup(): void;
}

/**
 * 重试状态接口
 * 存储重试状态信息
 */
export interface RetryState {
  /** 文件ID */
  fileId: string;
  /** 重试次数 */
  retryCount: number;
  /** 最后重试时间 */
  lastRetryTime: number;
  /** 分片重试记录 */
  chunkRetries: Record<number, number>;
  /** 成功重试次数 */
  successfulRetries: number;
  /** 失败重试次数 */
  failedRetries: number;
}

/**
 * 存储管理器接口
 * 提供重试状态持久化存储功能
 */
export interface StorageManager {
  /**
   * 保存重试状态
   * @param fileId 文件ID
   * @param state 重试状态
   */
  saveRetryState(fileId: string, state: RetryState): Promise<void>;

  /**
   * 获取重试状态
   * @param fileId 文件ID
   * @returns 重试状态，如果不存在则返回null
   */
  getRetryState(fileId: string): Promise<RetryState | null>;

  /**
   * 获取所有活动上传的文件ID
   * @returns 文件ID数组
   */
  getActiveUploads(): Promise<string[]>;

  /**
   * 删除重试状态
   * @param fileId 文件ID
   */
  deleteRetryState(fileId: string): Promise<void>;

  /**
   * 清除重试状态
   */
  clearRetryState(fileId: string): Promise<void>;

  /**
   * 清除所有重试状态
   */
  clearAllRetryStates(): Promise<void>;
}

/**
 * 事件发射器接口
 * 提供事件通知功能
 */
export interface EventEmitter {
  /** 发射事件 */
  emit(event: string, data: unknown): void;
}

/**
 * 重试管理器接口
 * 定义重试管理器应提供的方法和功能
 */
export interface RetryManager {
  /**
   * 处理重试
   * @param error 上传错误
   * @param context 错误上下文
   * @param handler 重试处理函数
   */
  retry(
    error: IUploadError,
    context: ExtendedErrorContext,
    handler: () => Promise<void>,
  ): Promise<void>;

  /**
   * 处理重试成功
   * @param context 错误上下文
   */
  handleRetrySuccess(context: ExtendedErrorContext): Promise<void>;

  /**
   * 处理重试失败
   * @param context 错误上下文
   * @param error 上传错误
   * @param recoverable 是否可恢复
   */
  handleRetryFailure(
    context: ExtendedErrorContext,
    error: IUploadError,
    recoverable: boolean,
  ): void;

  /**
   * 清理资源
   */
  cleanup(): Promise<void>;
}

/**
 * 重试管理器选项接口
 * 配置重试管理器的行为
 */
export interface RetryManagerOptions {
  /** 重试配置 */
  config?: IRetryConfig;
  /** 网络检测器 */
  networkDetector?: NetworkDetector;
  /** 事件发射器 */
  eventEmitter?: EventEmitter;
  /** 存储管理器 */
  storageManager?: StorageManager;
  /** 倒计时管理器 */
  countdownManager?: CountdownManager;
  /** 进度追踪器 */
  progressTracker?: ProgressTracker;
}
