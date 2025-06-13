/**
 * 断点续传策略类型定义
 */
import {
  IUploadProgress,
  UploadStatus,
  ILogger,
  IStorageOptions,
  IUploadState,
  IUploadConfig,
} from '@file-chunk-uploader/types';

/**
 * 分片状态枚举
 * 用于更细粒度地追踪每个分片的状态
 */
export enum ChunkStatus {
  /** 等待上传 */
  PENDING = 'pending',
  /** 正在上传 */
  UPLOADING = 'uploading',
  /** 上传成功 */
  SUCCESS = 'success',
  /** 上传失败 */
  FAILED = 'failed',
  /** 已暂停 */
  PAUSED = 'paused',
}

/**
 * 分片详细信息
 */
export interface IChunkDetail {
  /** 分片索引 */
  index: number;
  /** 分片状态 */
  status: ChunkStatus;
  /** 重试次数 */
  retryCount: number;
  /** 最近一次上传尝试的时间戳 */
  lastAttempt?: number;
  /** 最近一次错误信息 */
  lastError?: string;
}

/**
 * 续传策略配置接口
 */
export interface IResumeUploadStrategyOptions {
  /** 存储选项 */
  storage?: IStorageOptions;
  /** 是否启用断点续传 */
  enabled?: boolean;
  /** 最大存储时间（毫秒），超过此时间的上传状态将被清理 */
  maxStorageTime?: number;
  /** 最大并发分片数 */
  maxConcurrentChunks?: number;
  /** 分片可视化回调函数 */
  visualizationCallback?: (fileId: string, chunksInfo: IChunkDetail[]) => void;
  /** 自动清理间隔（毫秒） */
  cleanupInterval?: number;
  /** 日志记录器 */
  logger?: ILogger;
}

/**
 * 扩展的上传状态，包含断点续传特定信息
 */
export interface IExtendedUploadState extends IUploadState {
  /** 文件ID */
  fileId: string;
  /** 文件名称 */
  fileName: string;
  /** 文件大小（字节） */
  fileSize: number;
  /** 文件最后修改时间 */
  lastModified: number;
  /** 已上传分片索引数组 */
  uploadedChunks: number[];
  /** 总分片数 */
  totalChunks: number;
  /** 分片大小（字节） */
  chunkSize: number;
  /** 上传进度 */
  progress: IUploadProgress;
  /** 上传状态 */
  status: UploadStatus;
  /** 最后更新时间戳 */
  lastUpdated: number;
  /** 上传配置 */
  config?: IUploadConfig;
  /** 分片详情数组 */
  chunksDetails: IChunkDetail[];
  /** 最大并发分片数 */
  maxConcurrentChunks?: number;
  /** 自定义数据 */
  customData?: Record<string, any>;
}

/**
 * 上传统计信息
 */
export interface IUploadStats {
  /** 总分片数 */
  total: number;
  /** 已上传分片数 */
  uploaded: number;
  /** 上传失败分片数 */
  failed: number;
  /** 待上传分片数 */
  pending: number;
  /** 正在上传分片数 */
  uploading: number;
  /** 上传进度百分比 */
  progress: number;
  /** 估计剩余时间（秒） */
  estimatedTimeRemaining?: number;
}

/**
 * 上传状态验证结果
 */
export interface IUploadStateValidationResult {
  /** 是否有效 */
  valid: boolean;
  /** 无效原因 */
  reason?: string;
  /** 是否可恢复 */
  recoverable?: boolean;
  /** 详细信息 */
  details?: Record<string, any>;
}
