/**
 * 分片上传协调器
 * 负责协调分片上传流程
 * @module chunk-strategy/chunk-upload-coordinator
 */
import { generateFileId } from '@file-chunk-uploader/core';
import {
  IChunkConfig,
  IEventEmitter,
  ILogger,
  INetworkAdapter,
  IUploadConfig,
  IUploadResult,
} from '@file-chunk-uploader/types';
import {
  createCancelError,
  createPauseError,
  createUploadError,
  LoggerUtil,
  EventHelper,
} from '@file-chunk-uploader/utils';

import { ChunkCreator } from '../file-handler';
import { mergeUploadConfig } from '../utils';

import { ChunkMerger } from './chunk-merger';
import { ChunkProgressTracker } from './chunk-progress-tracker';
import { ChunkTaskManager } from './chunk-task-manager';
import { ChunkUploader } from './chunk-uploader';
import { PerformanceTracker } from './performance-tracker';

/**
 * 分片上传协调器类
 * 负责协调分片上传流程和组件间的交互
 */
export class ChunkUploadCoordinator {
  /** 分片任务管理器 */
  private taskManager: ChunkTaskManager;

  /** 分片进度跟踪器 */
  private progressTracker: ChunkProgressTracker;

  /** 性能指标记录器 */
  private performanceTracker: PerformanceTracker;

  /** 分片上传器 */
  private uploader: ChunkUploader;

  /** 分片合并器 */
  private merger: ChunkMerger;

  /** 分片创建器 */
  private chunkCreator: ChunkCreator;

  /** 事件辅助工具 */
  private eventHelper: EventHelper;

  /** 日志工具 */
  private logger: LoggerUtil;

  /**
   * 构造函数
   * @param config 分片配置
   * @param eventEmitter 事件发射器
   * @param networkAdapter 网络适配器
   * @param logger 日志记录器
   */
  constructor(
    private readonly config: IChunkConfig,
    private readonly eventEmitter?: IEventEmitter,
    private readonly networkAdapter?: INetworkAdapter,
    logger?: ILogger,
  ) {
    // 创建日志工具
    this.logger = new LoggerUtil(logger, 'ChunkUploadCoordinator');

    // 创建事件辅助工具
    this.eventHelper = new EventHelper(eventEmitter);

    // 创建各个模块实例
    this.chunkCreator = new ChunkCreator();
    this.taskManager = new ChunkTaskManager(eventEmitter, logger);
    this.progressTracker = new ChunkProgressTracker(eventEmitter);
    this.performanceTracker = new PerformanceTracker();

    // 创建上传器和合并器
    this.uploader = new ChunkUploader(
      this.taskManager,
      this.progressTracker,
      networkAdapter,
      eventEmitter,
      logger,
    );

    this.merger = new ChunkMerger(
      this.taskManager,
      this.progressTracker,
      networkAdapter,
      eventEmitter,
      logger,
    );
  }

  /**
   * 获取任务管理器
   * @returns 任务管理器实例
   */
  public getTaskManager(): ChunkTaskManager {
    return this.taskManager;
  }

  /**
   * 获取进度跟踪器
   * @returns 进度跟踪器实例
   */
  public getProgressTracker(): ChunkProgressTracker {
    return this.progressTracker;
  }

  /**
   * 获取性能跟踪器
   * @returns 性能跟踪器实例
   */
  public getPerformanceTracker(): PerformanceTracker {
    return this.performanceTracker;
  }

  /**
   * 获取分片上传器
   * @returns 分片上传器实例
   */
  public getUploader(): ChunkUploader {
    return this.uploader;
  }

  /**
   * 获取分片合并器
   * @returns 分片合并器实例
   */
  public getMerger(): ChunkMerger {
    return this.merger;
  }

  /**
   * 获取分片创建器
   * @returns 分片创建器实例
   */
  public getChunkCreator(): ChunkCreator {
    return this.chunkCreator;
  }

  /**
   * 处理上传
   * @param file 要上传的文件
   * @param config 上传配置
   * @returns 上传结果
   */
  public async processUpload(file: File, config: IUploadConfig): Promise<IUploadResult> {
    // 生成文件ID - 在try外部定义以便在catch中访问
    const fileId = generateFileId(file);
    let task: any | undefined;

    try {
      // 记录开始时间
      const startTimer = this.performanceTracker.startTiming('upload', 'total');

      this.logger.debug(`开始处理文件上传: ${fileId}`, {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
      });

      // 合并配置
      const mergedConfig = this.mergeConfig(config);

      // 确保分片大小存在
      const chunkSize = mergedConfig.chunk?.chunkSize || this.config.chunkSize || 5 * 1024 * 1024;

      // 创建文件分片
      const chunkTimer = this.performanceTracker.startTiming('upload', 'createChunks', fileId);
      const chunks = await this.chunkCreator.createChunks(file, chunkSize);
      chunkTimer.end();

      // 创建分片元数据
      const chunkInfos = this.chunkCreator.createChunkInfos(chunks, fileId, chunkSize);

      // 创建上传任务并保存任务引用
      task = this.taskManager.createTask(file, fileId, chunks, chunkInfos, mergedConfig);
      if (!task) {
        throw new Error(`创建上传任务失败: ${fileId}`);
      }

      // 发布上传开始事件
      this.eventHelper.emitUploadStartEvent(file, fileId, mergedConfig);

      // 更改任务状态为上传中
      this.taskManager.setTaskStatus(fileId, 'uploading');

      // 上传分片
      const uploadTimer = this.performanceTracker.startTiming('upload', 'uploadChunks', fileId);
      await this.uploader.uploadChunks(fileId);
      uploadTimer.end();

      // 合并分片
      const mergeTimer = this.performanceTracker.startTiming('upload', 'merge', fileId);
      const result = await this.merger.mergeChunks(fileId);
      mergeTimer.end();

      // 计算总时间
      const totalDuration = startTimer.end();

      // 发布上传完成事件
      this.eventHelper.emitUploadCompleteEvent(file, fileId, result, totalDuration);

      this.logger.info(`文件上传完成: ${fileId}`, {
        fileName: file.name,
        totalTime: `${totalDuration.toFixed(2)}ms`,
        url: result.url || '',
      });

      return result;
    } catch (error) {
      this.logger.error(`文件上传失败: ${fileId}`, error);

      // 发布上传失败事件
      this.eventHelper.emitUploadErrorEvent(file, fileId, error);

      // 如果任务存在，设置错误状态
      if (task) {
        this.taskManager.setTaskStatus(fileId, 'error');
        this.taskManager.setTaskError(fileId, createUploadError(error));
      }

      throw createUploadError(error);
    }
  }

  /**
   * 暂停上传
   * @param fileId 文件ID
   */
  public pauseUpload(fileId: string): void {
    this.logger.debug(`暂停上传: ${fileId}`);

    const task = this.taskManager.getTask(fileId);
    if (!task) {
      this.logger.warn(`未找到上传任务: ${fileId}`);
      return;
    }

    // 如果任务已经完成或已暂停，则不执行操作
    if (task.status === 'completed' || task.status === 'paused') {
      return;
    }

    // 中止所有正在进行的分片上传
    this.taskManager.abortAllChunks(fileId);

    // 更新任务状态
    this.taskManager.setTaskStatus(fileId, 'paused');

    // 发布暂停事件
    this.eventHelper.emitUploadPauseEvent(task.file, fileId);

    // 设置暂停错误
    this.taskManager.setTaskError(fileId, createPauseError());
  }

  /**
   * 恢复上传
   * @param fileId 文件ID
   */
  public resumeUpload(fileId: string): void {
    this.logger.debug(`恢复上传: ${fileId}`);

    const task = this.taskManager.getTask(fileId);
    if (!task) {
      this.logger.warn(`未找到上传任务: ${fileId}`);
      return;
    }

    // 如果任务已经在上传或已完成，则不执行操作
    if (task.status === 'uploading' || task.status === 'completed') {
      return;
    }

    // 更新任务状态
    this.taskManager.setTaskStatus(fileId, 'uploading');

    // 发布恢复事件
    this.eventHelper.emitUploadResumeEvent(task.file, fileId);

    // 继续上传未完成的分片
    this.uploader.uploadChunks(fileId).catch(error => {
      this.logger.error(`恢复上传失败: ${fileId}`, error);
      this.taskManager.setTaskError(fileId, createUploadError(error));
    });
  }

  /**
   * 取消上传
   * @param fileId 文件ID
   */
  public cancelUpload(fileId: string): void {
    this.logger.debug(`取消上传: ${fileId}`);

    const task = this.taskManager.getTask(fileId);
    if (!task) {
      this.logger.warn(`未找到上传任务: ${fileId}`);
      return;
    }

    // 如果任务已经取消或已完成，则不执行操作
    if (task.status === 'error') {
      return;
    }

    // 中止所有正在进行的分片上传
    this.taskManager.abortAllChunks(fileId);

    // 更新任务状态
    this.taskManager.setTaskStatus(fileId, 'error');

    // 设置取消错误
    this.taskManager.setTaskError(fileId, createCancelError());

    // 发布取消事件
    this.eventHelper.emitUploadCancelEvent(task.file, fileId);
  }

  /**
   * 清理资源
   */
  public async cleanup(): Promise<void> {
    this.logger.debug('清理分片上传资源');

    // 中止所有任务
    const tasks = this.taskManager.getAllTasks();
    for (const task of tasks) {
      this.taskManager.abortAllChunks(task.fileId);
    }

    // 清理任务
    this.taskManager.clearAllTasks();

    // 重置性能记录
    this.performanceTracker.reset();

    this.logger.debug('分片上传资源清理完成');
  }

  /**
   * 合并上传配置
   * @param config 上传配置
   * @returns 合并后的配置
   */
  private mergeConfig(config: IUploadConfig): IUploadConfig {
    const baseConfig: IUploadConfig = {
      target: config.target,
      chunk: this.config,
    };

    return mergeUploadConfig(baseConfig, config);
  }
}
