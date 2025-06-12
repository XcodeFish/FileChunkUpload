/**
 * 基础类型定义
 * 包含文件上传相关的基本类型定义
 * @packageDocumentation
 */

/**
 * 文件信息接口
 * 描述上传文件的基本信息
 */
export interface IFileInfo {
  /** 文件唯一标识 */
  id: string;
  /** 文件名 */
  name: string;
  /** 文件大小（字节） */
  size: number;
  /** 文件类型 MIME类型 */
  type: string;
  /** 最后修改时间 */
  lastModified: number;
}

/**
 * 上传状态枚举
 * 表示文件上传的不同状态
 */
export enum UploadStatus {
  /** 待上传 */
  PENDING = 'pending',
  /** 上传中 */
  UPLOADING = 'uploading',
  /** 已暂停 */
  PAUSED = 'paused',
  /** 已取消 */
  CANCELED = 'canceled',
  /** 已完成 */
  COMPLETED = 'completed',
  /** 上传失败 */
  FAILED = 'failed',
}

/**
 * 上传进度接口
 * 表示文件上传的进度信息
 */
export interface IUploadProgress {
  /** 已上传大小（字节） */
  loaded: number;
  /** 总大小（字节） */
  total: number;
  /** 上传进度（0-100） */
  percent: number;
  /** 上传速度（字节/秒） */
  speed: number;
  /** 已用时间（毫秒） */
  timeElapsed: number;
  /** 预计剩余时间（毫秒） */
  timeRemaining: number;
}

/**
 * 上传结果接口
 * 表示文件上传完成后的结果
 */
export interface IUploadResult {
  /** 是否成功 */
  success: boolean;
  /** 服务器返回的数据 */
  data?: Record<string, unknown>;
  /** 上传完成的文件URL */
  url?: string;
  /** 文件信息 */
  file: IFileInfo;
  /** 错误信息（如果上传失败） */
  error?: Error;
}

/**
 * 上传选项接口
 * 上传时可以传递的自定义选项
 */
export interface IUploadOptions {
  /** 自定义参数，键值对形式 */
  [key: string]: unknown;
}

/**
 * 上传任务接口
 * 表示一个上传任务的完整信息
 */
export interface IUploadTask {
  /** 任务ID */
  id: string;
  /** 文件信息 */
  file: IFileInfo;
  /** 上传状态 */
  status: UploadStatus;
  /** 上传进度 */
  progress: IUploadProgress;
  /** 创建时间 */
  createdAt: number;
  /** 开始上传时间 */
  startedAt?: number;
  /** 完成上传时间 */
  completedAt?: number;
  /** 上传结果 */
  result?: IUploadResult;
  /** 上传选项 */
  options?: IUploadOptions;
}
