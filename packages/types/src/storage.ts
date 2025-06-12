/**
 * 存储相关类型定义
 * 包含存储管理器和上传状态类型
 */
import { IFileInfo, IUploadProgress, UploadStatus } from './base';

/**
 * 存储类型枚举
 */
export enum StorageType {
  /** 本地存储 */
  LOCAL_STORAGE = 'localStorage',
  /** IndexedDB */
  INDEXED_DB = 'indexedDB',
  /** 内存存储 */
  MEMORY = 'memory',
  /** 会话存储 */
  SESSION_STORAGE = 'sessionStorage',
  /** 自定义存储 */
  CUSTOM = 'custom',
}

/**
 * 存储选项接口
 */
export interface IStorageOptions {
  /** 存储类型 */
  type?: StorageType;
  /** 数据库名称（IndexedDB） */
  dbName?: string;
  /** 存储对象名称（IndexedDB） */
  storeName?: string;
  /** 键前缀 */
  keyPrefix?: string;
  /** 过期时间（毫秒） */
  expiration?: number;
  /** 是否启用 */
  enabled?: boolean;
  /** 版本号（IndexedDB） */
  version?: number;
  /** 自定义存储适配器 */
  adapter?: IStorageAdapter;
  /** 自动清理过期数据 */
  autoClear?: boolean;
  /** 自动清理间隔（毫秒） */
  clearInterval?: number;
}

/**
 * 存储适配器接口
 */
export interface IStorageAdapter {
  /** 保存数据 */
  save<T>(key: string, value: T, expiration?: number): Promise<void>;
  /** 获取数据 */
  get<T>(key: string): Promise<T | null>;
  /** 移除数据 */
  remove(key: string): Promise<void>;
  /** 检查键是否存在 */
  has(key: string): Promise<boolean>;
  /** 清空所有数据 */
  clear(): Promise<void>;
  /** 获取所有键 */
  keys(): Promise<string[]>;
  /** 获取存储使用情况 */
  getUsage(): Promise<IStorageUsage>;
  /** 清理过期数据 */
  clearExpired(): Promise<void>;
  /** 是否支持该存储类型 */
  isSupported(): boolean;
}

/**
 * 存储使用情况接口
 */
export interface IStorageUsage {
  /** 总大小（字节） */
  totalSize: number;
  /** 分片数量 */
  chunkCount: number;
  /** 文件数量 */
  fileCount: number;
  /** 可用空间（字节，如果可获取） */
  availableSpace?: number;
  /** 使用率（0-1，如果可获取） */
  usageRatio?: number;
}

/**
 * 存储管理器接口
 */
export interface IStorageManager {
  /** 保存上传状态 */
  saveUploadState(fileId: string, state: IUploadState): Promise<void>;
  /** 保存分片 */
  saveChunk(fileId: string, chunkIndex: number, chunk: Blob): Promise<void>;
  /** 获取上传状态 */
  getUploadState(fileId: string): Promise<IUploadState | null>;
  /** 获取分片 */
  getChunk(fileId: string, chunkIndex: number): Promise<Blob | null>;
  /** 获取文件的所有分片索引 */
  getChunkIndices(fileId: string): Promise<number[]>;
  /** 删除文件相关数据 */
  deleteFile(fileId: string): Promise<void>;
  /** 清理过期数据 */
  cleanupExpiredData(maxAge?: number): Promise<void>;
  /** 获取存储使用情况 */
  getStorageUsage(): Promise<IStorageUsage>;
  /** 获取活跃上传列表 */
  getActiveUploads(): Promise<string[]>;
  /** 保存重试状态 */
  saveRetryState(fileId: string, state: IRetryState): Promise<void>;
  /** 获取重试状态 */
  getRetryState(fileId: string): Promise<IRetryState | null>;
}

/**
 * 上传状态接口
 */
export interface IUploadState {
  /** 文件ID */
  fileId: string;
  /** 文件信息 */
  file: IFileInfo;
  /** 上传状态 */
  status: UploadStatus;
  /** 上传进度 */
  progress: IUploadProgress;
  /** 已上传分片索引 */
  uploadedChunks: number[];
  /** 总分片数 */
  totalChunks: number;
  /** 分片大小 */
  chunkSize: number;
  /** 创建时间 */
  createdAt: number;
  /** 上次更新时间 */
  updatedAt: number;
  /** 已上传的文件唯一标识（秒传用） */
  fileHash?: string;
  /** 哈希算法 */
  hashAlgorithm?: string;
  /** 当前批次ID */
  batchId?: string;
  /** 自定义数据 */
  customData?: Record<string, any>;
}

/**
 * 重试状态接口
 */
export interface IRetryState {
  /** 文件ID */
  fileId: string;
  /** 重试次数 */
  retryCount: number;
  /** 最后重试时间 */
  lastRetryTime: number;
  /** 每个分片的重试次数 */
  chunkRetries: Record<number, number>;
  /** 成功重试次数 */
  successfulRetries: number;
  /** 失败重试次数 */
  failedRetries: number;
}

/**
 * 分片信息接口
 */
export interface IChunkInfo {
  /** 分片索引 */
  index: number;
  /** 文件ID */
  fileId: string;
  /** 分片数据 */
  data: Blob;
  /** 分片大小 */
  size: number;
  /** 起始位置 */
  start: number;
  /** 结束位置 */
  end: number;
  /** 是否为最后一个分片 */
  isLast: boolean;
  /** 分片状态 */
  status: 'pending' | 'uploading' | 'uploaded' | 'error';
  /** 重试次数 */
  retryCount: number;
  /** 最后更新时间 */
  updatedAt: number;
}
