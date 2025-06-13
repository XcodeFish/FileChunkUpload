/**
 * 分片任务管理模块
 * 负责管理上传任务状态和集合
 * @module chunk-strategy/chunk-task-manager
 */
import {
  IChunkInfo,
  IEventEmitter,
  IFileInfo,
  ILogger,
  IUploadConfig,
  IUploadError,
  IUploadProgress,
} from '@file-chunk-uploader/types';

/**
 * 分片上传任务接口
 */
export interface ChunkUploadTask {
  /** 文件对象 */
  file: File;
  /** 文件ID */
  fileId: string;
  /** 分片数据集合 */
  chunks: Blob[];
  /** 分片元数据集合 */
  chunkMetas: IChunkInfo[];
  /** 已上传完成的分片索引集合 */
  uploadedChunks: Set<number>;
  /** 正在上传的分片控制器集合 */
  inProgressChunks: Map<number, AbortController>;
  /** 任务状态 */
  status: 'pending' | 'uploading' | 'paused' | 'completed' | 'error';
  /** 上传进度信息 */
  progress: IUploadProgress;
  /** 上传错误 */
  error: IUploadError | null;
  /** 上传配置 */
  config: IUploadConfig;
}

/**
 * 分片任务管理器类
 * 负责管理分片上传任务的状态和生命周期
 */
export class ChunkTaskManager {
  /** 任务集合，以文件ID为键 */
  private tasks: Map<string, ChunkUploadTask> = new Map();

  /**
   * 构造函数
   * @param eventEmitter 事件发射器
   * @param logger 日志记录器
   */
  constructor(
    private readonly eventEmitter?: IEventEmitter,
    private readonly logger?: ILogger,
  ) {}

  /**
   * 创建上传任务
   * @param file 文件对象
   * @param fileId 文件ID
   * @param chunks 分片集合
   * @param chunkMetas 分片元数据集合
   * @param config 上传配置
   * @returns 上传任务
   */
  public createTask(
    file: File,
    fileId: string,
    chunks: Blob[],
    chunkMetas: IChunkInfo[],
    config: IUploadConfig,
  ): ChunkUploadTask {
    // 创建任务对象
    const task: ChunkUploadTask = {
      file,
      fileId,
      chunks,
      chunkMetas,
      uploadedChunks: new Set(),
      inProgressChunks: new Map(),
      status: 'pending',
      progress: {
        loaded: 0,
        total: file.size,
        percent: 0,
        speed: 0,
        timeElapsed: 0,
        timeRemaining: 0,
      },
      error: null,
      config,
    };

    // 存储任务
    this.tasks.set(fileId, task);

    this.logDebug(`创建上传任务: ${fileId}`, {
      fileName: file.name,
      totalChunks: chunks.length,
      totalSize: file.size,
    });

    // 发布任务创建事件
    if (this.eventEmitter) {
      const fileInfo: IFileInfo = {
        id: fileId,
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
      };

      this.eventEmitter.emit('chunk:task:created', {
        file: fileInfo,
        chunkCount: chunks.length,
        status: task.status,
      });
    }

    return task;
  }

  /**
   * 获取上传任务
   * @param fileId 文件ID
   * @returns 上传任务或undefined
   */
  public getTask(fileId: string): ChunkUploadTask | undefined {
    return this.tasks.get(fileId);
  }

  /**
   * 获取所有上传任务
   * @returns 上传任务数组
   */
  public getAllTasks(): ChunkUploadTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * 设置任务状态
   * @param fileId 文件ID
   * @param status 新状态
   * @returns 是否成功设置
   */
  public setTaskStatus(fileId: string, status: ChunkUploadTask['status']): boolean {
    const task = this.tasks.get(fileId);
    if (!task) {
      return false;
    }

    const oldStatus = task.status;
    task.status = status;

    this.logDebug(`任务状态变更: ${fileId}`, {
      from: oldStatus,
      to: status,
    });

    // 发布状态变更事件
    if (this.eventEmitter) {
      this.eventEmitter.emit('chunk:task:status', {
        fileId,
        fileName: task.file.name,
        oldStatus,
        newStatus: status,
      });
    }

    return true;
  }

  /**
   * 添加已上传分片
   * @param fileId 文件ID
   * @param chunkIndex 分片索引
   * @returns 是否成功添加
   */
  public addUploadedChunk(fileId: string, chunkIndex: number): boolean {
    const task = this.tasks.get(fileId);
    if (!task) {
      return false;
    }

    task.uploadedChunks.add(chunkIndex);

    // 检查是否所有分片都已上传
    if (task.uploadedChunks.size === task.chunks.length && task.status === 'uploading') {
      this.setTaskStatus(fileId, 'completed');
    }

    return true;
  }

  /**
   * 添加正在上传的分片
   * @param fileId 文件ID
   * @param chunkIndex 分片索引
   * @param controller 中止控制器
   * @returns 是否成功添加
   */
  public addInProgressChunk(
    fileId: string,
    chunkIndex: number,
    controller: AbortController,
  ): boolean {
    const task = this.tasks.get(fileId);
    if (!task) {
      return false;
    }

    task.inProgressChunks.set(chunkIndex, controller);
    return true;
  }

  /**
   * 移除正在上传的分片
   * @param fileId 文件ID
   * @param chunkIndex 分片索引
   * @returns 是否成功移除
   */
  public removeInProgressChunk(fileId: string, chunkIndex: number): boolean {
    const task = this.tasks.get(fileId);
    if (!task) {
      return false;
    }

    return task.inProgressChunks.delete(chunkIndex);
  }

  /**
   * 中止文件所有分片上传
   * @param fileId 文件ID
   * @returns 中止的分片数量
   */
  public abortAllChunks(fileId: string): number {
    const task = this.tasks.get(fileId);
    if (!task) {
      return 0;
    }

    let abortedCount = 0;

    // 中止所有正在上传的分片
    task.inProgressChunks.forEach((controller, index) => {
      try {
        controller.abort();
        abortedCount++;

        this.logDebug(`中止分片上传: ${fileId}, chunk #${index}`);
      } catch (error) {
        this.logError(`中止分片上传失败: ${fileId}, chunk #${index}`, error);
      }
    });

    // 清空正在上传集合
    task.inProgressChunks.clear();

    return abortedCount;
  }

  /**
   * 设置任务错误
   * @param fileId 文件ID
   * @param error 错误对象
   * @returns 是否成功设置
   */
  public setTaskError(fileId: string, error: IUploadError): boolean {
    const task = this.tasks.get(fileId);
    if (!task) {
      return false;
    }

    task.error = error;

    // 如果任务状态为上传中，更改为错误
    if (task.status === 'uploading') {
      this.setTaskStatus(fileId, 'error');
    }

    // 发布错误事件
    if (this.eventEmitter) {
      this.eventEmitter.emit('chunk:task:error', {
        fileId,
        fileName: task.file.name,
        error,
      });
    }

    return true;
  }

  /**
   * 删除任务
   * @param fileId 文件ID
   * @returns 是否成功删除
   */
  public removeTask(fileId: string): boolean {
    const task = this.tasks.get(fileId);
    if (!task) {
      return false;
    }

    // 先中止所有上传中的分片
    this.abortAllChunks(fileId);

    // 删除任务
    this.tasks.delete(fileId);

    this.logDebug(`删除上传任务: ${fileId}`, {
      fileName: task.file.name,
    });

    return true;
  }

  /**
   * 清理所有任务
   * @returns 清理的任务数
   */
  public clearAllTasks(): number {
    const count = this.tasks.size;

    // 中止所有任务中的上传
    this.tasks.forEach((task, fileId) => {
      this.abortAllChunks(fileId);
    });

    // 清空任务集合
    this.tasks.clear();

    this.logDebug(`清理所有上传任务`, { count });

    return count;
  }

  /**
   * 记录调试日志
   * @param message 日志消息
   * @param data 附加数据
   */
  private logDebug(message: string, data?: any): void {
    if (this.logger) {
      this.logger.debug('chunk', message, data);
    }
  }

  /**
   * 记录错误日志
   * @param message 日志消息
   * @param error 错误对象
   */
  private logError(message: string, error: any): void {
    if (this.logger) {
      this.logger.error('chunk', message, error);
    }
  }
}
