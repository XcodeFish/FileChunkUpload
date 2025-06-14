/**
 * 重试机制类型定义文件
 * 包含重试机制所需的接口和类型
 * @packageDocumentation
 */

import { IUploadError, IErrorContext, IRetryConfig } from '@file-chunk-uploader/types';

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
 * 重试事件开始信息接口
 * 提供重试开始时的详细信息
 */
export interface RetryStartInfo {
  /** 文件ID */
  fileId?: string;
  /** 分片索引 */
  chunkIndex?: number;
  /** 重试次数 */
  retryCount: number;
  /** 延迟时间 */
  delay: number;
  /** 错误信息 */
  error: IUploadError;
  /** 额外信息 */
  reason?: string;
}

/**
 * 重试事件成功信息接口
 * 提供重试成功时的详细信息
 */
export interface RetrySuccessInfo {
  /** 文件ID */
  fileId?: string;
  /** 分片索引 */
  chunkIndex?: number;
  /** 成功次数 */
  successCount: number;
}

/**
 * 重试事件失败信息接口
 * 提供重试失败时的详细信息
 */
export interface RetryFailedInfo {
  /** 文件ID */
  fileId?: string;
  /** 错误信息 */
  error: IUploadError;
  /** 是否可恢复 */
  recoverable: boolean;
}

/**
 * 网络信息接口
 * 描述当前网络状态
 */
export interface NetworkInfo {
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
 * 描述需要持久化的重试状态
 */
export interface RetryState {
  /** 文件ID */
  fileId: string;
  /** 重试次数 */
  retryCount: number;
  /** 最后重试时间 */
  lastRetryTime: number;
  /** 分片重试次数映射 */
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
  /** 保存重试状态 */
  saveRetryState(fileId: string, state: RetryState): Promise<void>;
  /** 获取重试状态 */
  getRetryState(fileId: string): Promise<RetryState | null>;
  /** 获取活动上传ID列表 */
  getActiveUploads(): Promise<string[]>;
  /** 清除重试状态 */
  clearRetryState(fileId: string): Promise<void>;
  /** 清除所有重试状态 */
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
 * 重试任务接口
 * 描述待执行的重试任务
 */
export interface RetryTask {
  /** 任务ID */
  id: string;
  /** 文件ID */
  fileId?: string;
  /** 分片索引 */
  chunkIndex?: number;
  /** 任务类型 */
  type?: 'retry' | 'network_recovery' | 'adjust_chunk';
  /** 计划执行时间 */
  scheduledTime: number;
  /** 延迟时间（毫秒） */
  delay: number;
  /** 错误上下文 */
  context: IErrorContext;
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
 * 重试管理器接口
 * 提供错误重试功能
 */
export interface RetryManager {
  /**
   * 处理错误重试
   * @param error 错误对象
   * @param context 错误上下文
   * @param handler 重试处理函数
   */
  retry(error: IUploadError, context: IErrorContext, handler: () => Promise<void>): Promise<void>;

  /**
   * 处理重试成功
   * @param context 错误上下文
   */
  handleRetrySuccess(context: IErrorContext): Promise<void>;

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
}
