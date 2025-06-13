/**
 * 分片上传策略
 * @module chunk-strategy
 * @description 实现分片上传逻辑和控制
 * @packageDocumentation
 */
import {
  IChunkConfig,
  IChunkUploadStrategy,
  IFileUploader,
  IUploadConfig,
  IUploadError,
  IUploadProgress,
  IUploadResult,
} from '@file-chunk-uploader/types';

import { validateChunkConfig } from '../utils';

import { ChunkUploadCoordinator } from './chunk-upload-coordinator';

/**
 * 分片上传策略类
 * 实现分片上传逻辑和控制
 */
export class ChunkUploadStrategy implements IChunkUploadStrategy {
  /** 策略名称 */
  public readonly name: string = 'chunk';

  /** 分片上传协调器 */
  private coordinator: ChunkUploadCoordinator;

  /** 当前配置 */
  private config: IChunkConfig;

  /**
   * 构造函数
   * @param options 分片配置
   */
  constructor(options: Partial<IChunkConfig> = {}) {
    // 验证并合并配置
    this.config = validateChunkConfig(options);

    // 协调器将在init方法中初始化
    this.coordinator = {} as ChunkUploadCoordinator;
  }

  /**
   * 处理上传
   * @param file 要上传的文件
   * @param config 上传配置
   * @returns 上传结果
   */
  public async process(file: File, config: IUploadConfig): Promise<IUploadResult> {
    return this.coordinator.processUpload(file, config);
  }

  /**
   * 创建分片
   * @param file 要分片的文件
   * @param chunkSize 分片大小（字节）
   * @returns 分片数组
   */
  public async createChunks(file: File, chunkSize: number): Promise<Blob[]> {
    // 委托给协调器的分片创建器
    const chunkCreator =
      this.coordinator.getChunkCreator?.() ||
      (await import('../file-handler')).ChunkCreator.prototype;
    return chunkCreator.createChunks(file, chunkSize);
  }

  /**
   * 上传分片
   * @param chunk 分片数据
   * @param index 分片索引
   * @param file 原始文件
   * @param config 上传配置
   * @param totalChunks 总分片数
   * @returns 上传响应
   */
  public async uploadChunk(
    chunk: Blob,
    index: number,
    file: File,
    config: IUploadConfig,
    totalChunks: number,
  ): Promise<any> {
    // 委托给协调器的上传器
    // 需要先找到文件对应的任务ID
    const tasks = this.coordinator.getTaskManager().getAllTasks();
    const task = tasks.find(
      t => t.file === file || (t.file.name === file.name && t.file.size === file.size),
    );

    if (!task) {
      throw new Error('未找到对应的上传任务');
    }

    const fileId = task.fileId;
    const chunkSize = config.chunk?.chunkSize || this.config.chunkSize || 5 * 1024 * 1024;

    const chunkInfo = {
      index,
      size: chunk.size,
      start: index * chunkSize,
      end: Math.min((index + 1) * chunkSize, file.size),
      isLast: index === totalChunks - 1,
      fileId: fileId,
      data: chunk,
      status: 'pending' as const,
      retryCount: 0,
      updatedAt: Date.now(),
    };

    return this.coordinator.getUploader().uploadChunk(fileId, chunk, chunkInfo, config);
  }

  /**
   * 合并分片
   * @param fileId 文件ID
   * @param chunks 分片索引数组
   * @param config 上传配置
   * @returns 合并结果
   */
  public async mergeChunks(
    fileId: string,
    _chunks: number[],
    _config: IUploadConfig,
  ): Promise<any> {
    // 委托给协调器的合并器
    return this.coordinator.getMerger().mergeChunks(fileId);
  }

  /**
   * 获取已上传分片
   * @param fileId 文件ID
   * @returns 已上传分片索引数组
   */
  public async getUploadedChunks(fileId: string): Promise<number[]> {
    const task = this.coordinator.getTaskManager().getTask(fileId);
    if (!task) {
      return [];
    }
    return Array.from(task.uploadedChunks);
  }

  /**
   * 暂停上传
   * @param fileId 文件ID
   */
  public pause(fileId: string): void {
    this.coordinator.pauseUpload(fileId);
  }

  /**
   * 恢复上传
   * @param fileId 文件ID
   */
  public resume(fileId: string): void {
    this.coordinator.resumeUpload(fileId);
  }

  /**
   * 取消上传
   * @param fileId 文件ID
   */
  public cancel(fileId: string): void {
    this.coordinator.cancelUpload(fileId);
  }

  /**
   * 获取上传状态
   * @param fileId 文件ID
   * @returns 上传状态
   */
  public getStatus(fileId: string): string {
    const task = this.coordinator.getTaskManager().getTask(fileId);
    return task ? task.status : 'unknown';
  }

  /**
   * 获取上传进度
   * @param fileId 文件ID
   * @returns 上传进度百分比
   */
  public getProgress(fileId: string): number {
    const task = this.coordinator.getTaskManager().getTask(fileId);
    return task ? task.progress.percent : 0;
  }

  /**
   * 获取上传错误
   * @param fileId 文件ID
   * @returns 上传错误
   */
  public getError(fileId: string): IUploadError | null {
    const task = this.coordinator.getTaskManager().getTask(fileId);
    return task ? task.error : null;
  }

  /**
   * 初始化策略
   * @param uploader 文件上传器
   */
  public init(uploader: IFileUploader): void {
    // 创建协调器
    this.coordinator = new ChunkUploadCoordinator(
      this.config,
      uploader.eventEmitter,
      uploader.networkAdapter,
      uploader.logger,
    );
  }

  /**
   * 清理资源
   */
  public async cleanup(): Promise<void> {
    await this.coordinator.cleanup();
  }

  /**
   * 获取上传进度信息
   * @param fileId 文件ID
   * @returns 上传进度信息
   */
  public getProgressInfo(fileId: string): IUploadProgress | null {
    const task = this.coordinator.getTaskManager().getTask(fileId);
    return task ? { ...task.progress } : null;
  }
}
