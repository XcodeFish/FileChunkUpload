/**
 * 上传器类型定义
 * 包含上传器核心接口和上传策略接口
 */
import { IUploadResult, IUploadTask } from './base';
import { IUploadConfig } from './config';
import { IUploadError } from './error';
import { IEventEmitter } from './event';
import { INetworkAdapter } from './network';
import { IPlugin, IPluginManager } from './plugin';
import { IStorageManager } from './storage';

/**
 * 上传器接口
 */
export interface IFileUploader {
  /** 上传配置 */
  config: IUploadConfig;
  /** 插件管理器 */
  pluginManager: IPluginManager;
  /** 事件发射器 */
  eventEmitter: IEventEmitter;
  /** 网络适配器 */
  networkAdapter?: INetworkAdapter;
  /** 存储管理器 */
  storageManager?: IStorageManager;
  /** 日志记录器 */
  logger?: any;
  /** API版本 */
  apiVersion: string;

  /** 上传文件 */
  upload(file: File | Blob, options?: Partial<IUploadConfig>): Promise<IUploadResult>;
  /** 上传多个文件 */
  uploadMultiple(
    files: Array<File | Blob>,
    options?: Partial<IUploadConfig>,
  ): Promise<IUploadResult[]>;
  /** 以Observable方式上传文件 */
  uploadObservable(file: File | Blob, options?: Partial<IUploadConfig>): any; // 返回Observable
  /** 暂停上传 */
  pause(fileId?: string): void;
  /** 恢复上传 */
  resume(fileId?: string): void;
  /** 取消上传 */
  cancel(fileId?: string): void;
  /** 获取上传状态 */
  getStatus(fileId: string): string;
  /** 获取上传进度 */
  getProgress(fileId: string): number;
  /** 获取所有上传任务 */
  getTasks(): IUploadTask[];
  /** 获取上传任务 */
  getTask(fileId: string): IUploadTask | undefined;
  /** 清除已完成任务 */
  clearCompletedTasks(): void;
  /** 使用插件 */
  use(plugin: IPlugin): this;
  /** 添加事件监听器 */
  on(eventName: string, handler: (data: any) => void, options?: any): this;
  /** 添加一次性事件监听器 */
  once(eventName: string, handler: (data: any) => void, options?: any): this;
  /** 移除事件监听器 */
  off(eventName: string, handler?: (data: any) => void): this;
  /** 设置配置 */
  setConfig(config: Partial<IUploadConfig>): this;
  /** 清理资源 */
  cleanup(): Promise<void>;
}

/**
 * 上传策略接口
 */
export interface IUploadStrategy {
  /** 策略名称 */
  name: string;
  /** 处理上传 */
  process(file: File | Blob, config: IUploadConfig): Promise<IUploadResult>;
  /** 暂停上传 */
  pause(fileId: string): void;
  /** 恢复上传 */
  resume(fileId: string): void;
  /** 取消上传 */
  cancel(fileId: string): void;
  /** 获取上传状态 */
  getStatus(fileId: string): string;
  /** 获取上传进度 */
  getProgress(fileId: string): number;
  /** 获取错误 */
  getError(fileId: string): IUploadError | null;
  /** 初始化策略 */
  init(uploader: IFileUploader): void;
  /** 清理资源 */
  cleanup(): Promise<void>;
}

/**
 * 分片上传策略接口
 */
export interface IChunkUploadStrategy extends IUploadStrategy {
  /** 创建分片 */
  createChunks(file: File, chunkSize: number): Promise<Blob[]>;
  /** 上传分片 */
  uploadChunk(
    chunk: Blob,
    index: number,
    file: File,
    config: IUploadConfig,
    totalChunks: number,
  ): Promise<any>;
  /** 合并分片 */
  mergeChunks(fileId: string, chunks: number[], config: IUploadConfig): Promise<any>;
  /** 获取已上传分片 */
  getUploadedChunks(fileId: string): Promise<number[]>;
}

/**
 * 断点续传策略接口
 */
export interface IResumeUploadStrategy extends IUploadStrategy {
  /** 加载上传状态 */
  loadState(fileId: string): Promise<any>;
  /** 保存上传状态 */
  saveState(fileId: string, state: any): Promise<void>;
  /** 清除上传状态 */
  clearState(fileId: string): Promise<void>;
  /** 检查是否可恢复 */
  canResume(fileId: string): Promise<boolean>;
}

/**
 * 秒传策略接口
 */
export interface IFastUploadStrategy extends IUploadStrategy {
  /** 计算文件哈希 */
  calculateHash(file: File, algorithm?: string): Promise<string>;
  /** 检查文件是否已存在 */
  checkFileExists(hash: string, config: IUploadConfig): Promise<boolean>;
  /** 执行秒传 */
  performFastUpload(file: File, hash: string, config: IUploadConfig): Promise<IUploadResult>;
}

/**
 * 上传器核心接口
 */
export interface IFileUploaderCore {
  /** 上传配置 */
  config: IUploadConfig;
  /** 插件管理器 */
  pluginManager: IPluginManager;
  /** 事件发射器 */
  eventEmitter: IEventEmitter;
  /** 上传策略 */
  strategies: Map<string, IUploadStrategy>;
  /** API版本 */
  apiVersion: string;

  /** 注册钩子 */
  registerHook(hookName: string, handler: (...args: any[]) => any): void;
  /** 移除钩子 */
  removeHook(hookName: string, handler?: (...args: any[]) => any): void;
  /** 执行钩子 */
  executeHook(hookName: string, ...args: any[]): Promise<any>;
}
