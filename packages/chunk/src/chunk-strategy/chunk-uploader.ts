/**
 * 分片上传模块
 * 负责执行具体的分片上传操作
 * @module chunk-strategy/chunk-uploader
 */
import {
  IChunkInfo,
  IEventEmitter,
  ILogger,
  INetworkAdapter,
  IUploadConfig,
} from '@file-chunk-uploader/types';

import { ChunkProgressTracker } from './chunk-progress-tracker';
import { ChunkTaskManager } from './chunk-task-manager';

/**
 * 分片上传器类
 * 负责处理分片并发上传和控制
 */
export class ChunkUploader {
  /**
   * 构造函数
   * @param taskManager 任务管理器
   * @param progressTracker 进度跟踪器
   * @param networkAdapter 网络适配器
   * @param eventEmitter 事件发射器
   * @param logger 日志记录器
   */
  constructor(
    private readonly taskManager: ChunkTaskManager,
    private readonly progressTracker: ChunkProgressTracker,
    private readonly networkAdapter?: INetworkAdapter,
    private readonly eventEmitter?: IEventEmitter,
    private readonly logger?: ILogger,
  ) {}

  /**
   * 上传单个分片
   * @param fileId 文件ID
   * @param chunk 分片数据
   * @param chunkInfo 分片信息
   * @param config 上传配置
   * @returns 上传响应
   */
  public async uploadChunk(
    fileId: string,
    chunk: Blob,
    chunkInfo: IChunkInfo,
    config: IUploadConfig,
  ): Promise<any> {
    if (!this.networkAdapter) {
      throw new Error('网络适配器未初始化');
    }

    const task = this.taskManager.getTask(fileId);
    if (!task) {
      throw new Error(`未找到上传任务: ${fileId}`);
    }

    // 如果任务已暂停或取消，则不继续上传
    if (task.status !== 'uploading') {
      return Promise.reject(new Error('上传任务已暂停或取消'));
    }

    // 创建用于取消上传的AbortController
    const abortController = new AbortController();
    this.taskManager.addInProgressChunk(fileId, chunkInfo.index, abortController);

    try {
      this.logDebug(`开始上传分片 ${chunkInfo.index + 1}/${task.chunks.length}`, {
        size: chunk.size,
        fileName: task.file.name,
      });

      // 准备上传数据
      const formData = new FormData();

      // 添加文件信息
      formData.append('fileId', fileId);
      formData.append('fileName', task.file.name);
      formData.append('fileType', task.file.type);
      formData.append('fileSize', task.file.size.toString());

      // 添加分片信息
      formData.append('chunkIndex', chunkInfo.index.toString());
      formData.append('chunkSize', chunk.size.toString());
      formData.append('totalChunks', task.chunks.length.toString());
      formData.append('isLast', chunkInfo.isLast ? 'true' : 'false');

      // 添加自定义数据
      if (config.formData) {
        Object.entries(config.formData).forEach(([key, value]) => {
          formData.append(key, value as string);
        });
      }

      // 添加分片数据
      formData.append(
        config.fileFieldName || 'file',
        chunk,
        `${task.file.name}.part${chunkInfo.index}`,
      );

      // 准备请求配置
      const requestConfig = {
        signal: abortController.signal,
        timeout: config.timeout || 30000,
        headers: config.headers || {},
        onUploadProgress: (_event: ProgressEvent) => {
          // 可以处理单个分片的上传进度，但这里我们不处理
          // 因为我们已经在整体任务级别跟踪进度
        },
      };

      const startTime = performance.now();

      // 发送请求
      const response = await this.networkAdapter.post(config.target, formData, requestConfig);

      const endTime = performance.now();

      // 记录性能指标
      this.recordPerformanceMetric(`chunk_${chunkInfo.index}`, endTime - startTime);

      // 从进行中的分片中移除
      this.taskManager.removeInProgressChunk(fileId, chunkInfo.index);

      // 添加到已上传分片集合
      this.taskManager.addUploadedChunk(fileId, chunkInfo.index);

      // 更新并发布进度
      this.progressTracker.updateTaskProgress(task);
      this.progressTracker.emitProgressEvent(task, chunkInfo.index);

      // 发布分片上传完成事件
      if (this.eventEmitter) {
        this.eventEmitter.emit('chunk:uploaded', {
          fileId,
          chunkIndex: chunkInfo.index,
          uploadedChunks: task.uploadedChunks.size,
          totalChunks: task.chunks.length,
          response,
        });
      }

      this.logDebug(`分片上传成功: #${chunkInfo.index}`, {
        time: `${(endTime - startTime).toFixed(2)}ms`,
        size: chunk.size,
      });

      return response;
    } catch (error) {
      // 从进行中的分片中移除
      this.taskManager.removeInProgressChunk(fileId, chunkInfo.index);

      // 如果不是因为取消而失败
      if (!(error instanceof Error && error.name === 'AbortError')) {
        this.logError(`分片上传失败: #${chunkInfo.index}`, error);

        // 发布分片上传失败事件
        if (this.eventEmitter) {
          this.eventEmitter.emit('chunk:error', {
            fileId,
            chunkIndex: chunkInfo.index,
            error,
          });
        }
      }

      throw error;
    }
  }

  /**
   * 上传所有分片
   * @param fileId 文件ID
   * @returns 上传结果
   */
  public async uploadChunks(fileId: string): Promise<void> {
    const task = this.taskManager.getTask(fileId);

    if (!task) {
      throw new Error(`未找到上传任务: ${fileId}`);
    }

    const { chunks, chunkMetas, config } = task;
    const totalChunks = chunks.length;

    // 获取并发数
    const concurrency = config.chunk?.concurrency || 3;

    // 获取是否顺序上传
    const sequential = config.chunk?.sequential || false;

    this.logInfo(`开始上传分片: ${fileId}`, {
      totalChunks,
      concurrency,
      sequential: sequential ? '是' : '否',
    });

    // 发布开始上传事件
    if (this.eventEmitter) {
      this.eventEmitter.emit('chunk:upload:start', {
        fileId,
        totalChunks,
        concurrency,
        sequential,
      });
    }

    // 如果是顺序上传
    if (sequential) {
      await this.uploadChunksSequentially(fileId, chunks, chunkMetas);
    } else {
      // 并发上传
      await this.uploadChunksConcurrently(fileId, chunks, chunkMetas, concurrency);
    }

    this.logInfo(`所有分片上传完成: ${fileId}`, {
      uploadedChunks: task.uploadedChunks.size,
      totalChunks,
    });
  }

  /**
   * 顺序上传所有分片
   * @param fileId 文件ID
   * @param chunks 分片数据集合
   * @param chunkMetas 分片元数据集合
   */
  private async uploadChunksSequentially(
    fileId: string,
    chunks: Blob[],
    chunkMetas: IChunkInfo[],
  ): Promise<void> {
    const task = this.taskManager.getTask(fileId);
    if (!task) {
      throw new Error(`未找到上传任务: ${fileId}`);
    }

    for (let i = 0; i < chunks.length; i++) {
      // 检查任务状态
      if (task.status !== 'uploading') {
        return;
      }

      // 如果此分片已上传，则跳过
      if (task.uploadedChunks.has(chunkMetas[i].index)) {
        continue;
      }

      // 上传单个分片
      await this.uploadChunk(fileId, chunks[i], chunkMetas[i], task.config);
    }
  }

  /**
   * 并发上传所有分片
   * @param fileId 文件ID
   * @param chunks 分片数据集合
   * @param chunkMetas 分片元数据集合
   * @param concurrency 并发数
   */
  private async uploadChunksConcurrently(
    fileId: string,
    chunks: Blob[],
    chunkMetas: IChunkInfo[],
    concurrency: number,
  ): Promise<void> {
    const task = this.taskManager.getTask(fileId);
    if (!task) {
      throw new Error(`未找到上传任务: ${fileId}`);
    }

    // 创建分片索引队列（过滤已上传的分片）
    const queue: number[] = [];
    for (let i = 0; i < chunks.length; i++) {
      if (!task.uploadedChunks.has(chunkMetas[i].index)) {
        queue.push(i);
      }
    }

    // 记录当前上传状态
    const inProgress = new Set<number>();
    const errors: Error[] = [];

    // 记录每个分片的重试次数
    const retryCount: Record<number, number> = {};
    // 最大重试次数
    const maxRetries = task.config.chunk?.maxRetries || 3;
    // 连续失败计数
    let consecutiveFailures = 0;
    // 最大连续失败次数
    const maxConsecutiveFailures = 5;

    // 等待所有分片上传完成
    while (queue.length > 0 || inProgress.size > 0) {
      // 检查任务状态
      if (task.status !== 'uploading') {
        return;
      }

      // 检查连续失败次数是否超过阈值
      if (consecutiveFailures >= maxConsecutiveFailures) {
        this.logError(`上传失败: 连续失败次数过多 (${consecutiveFailures})`, null);
        throw new Error(`上传失败: 连续失败次数过多 (${consecutiveFailures})`);
      }

      // 填充上传通道
      while (inProgress.size < concurrency && queue.length > 0) {
        const chunkIndex = queue.shift()!;
        inProgress.add(chunkIndex);

        // 启动上传但不等待完成
        this.uploadChunk(fileId, chunks[chunkIndex], chunkMetas[chunkIndex], task.config)
          .then(() => {
            inProgress.delete(chunkIndex);
            // 重置连续失败计数
            consecutiveFailures = 0;
          })
          .catch(error => {
            inProgress.delete(chunkIndex);
            errors.push(error);

            // 增加连续失败计数
            consecutiveFailures++;

            // 增加该分片的重试计数
            retryCount[chunkIndex] = (retryCount[chunkIndex] || 0) + 1;

            // 如果任务仍在上传中且未超过最大重试次数，则放回队列重试
            if (task.status === 'uploading' && retryCount[chunkIndex] <= maxRetries) {
              this.logInfo(`重试上传分片 ${chunkIndex} (${retryCount[chunkIndex]}/${maxRetries})`, {
                error: error.message,
              });
              queue.push(chunkIndex);
            } else if (retryCount[chunkIndex] > maxRetries) {
              this.logError(`分片 ${chunkIndex} 上传失败: 超过最大重试次数 (${maxRetries})`, error);
            }
          });
      }

      // 如果已经填满并发通道或队列为空但还有上传中的分片，等待一段时间
      if (inProgress.size >= concurrency || (queue.length === 0 && inProgress.size > 0)) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // 统计错误情况
    const failedChunks = Object.entries(retryCount)
      .filter(([_, count]) => count > maxRetries)
      .map(([index]) => Number(index));

    // 如果有超过重试次数的分片，抛出详细错误
    if (failedChunks.length > 0) {
      const error = new Error(`${failedChunks.length}个分片上传失败，超过最大重试次数`);
      (error as any).failedChunks = failedChunks;
      (error as any).details = {
        fileId,
        totalChunks: chunks.length,
        failedChunks,
      };
      throw error;
    }

    // 如果有错误且没有重试成功，则抛出第一个错误
    if (errors.length > 0 && task.uploadedChunks.size < chunks.length) {
      throw errors[0];
    }
  }

  /**
   * 记录性能指标
   * @param operation 操作名称
   * @param duration 持续时间
   */
  private recordPerformanceMetric(operation: string, duration: number): void {
    if (!this.eventEmitter) return;

    this.eventEmitter.emit('performance:metric', {
      category: 'chunk',
      operation,
      duration,
      timestamp: Date.now(),
    });

    this.logDebug(`性能指标 [${operation}]: ${duration.toFixed(2)}ms`);
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
   * 记录信息日志
   * @param message 日志消息
   * @param data 附加数据
   */
  private logInfo(message: string, data?: any): void {
    if (this.logger) {
      this.logger.info('chunk', message, data);
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
