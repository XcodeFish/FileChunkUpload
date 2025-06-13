/**
 * 分片合并模块
 * 负责处理分片合并请求
 * @module chunk-strategy/chunk-merger
 */
import {
  IEventEmitter,
  IFileInfo,
  ILogger,
  INetworkAdapter,
  IUploadConfig,
  IUploadResult,
} from '@file-chunk-uploader/types';

import { ChunkProgressTracker } from './chunk-progress-tracker';
import { ChunkTaskManager } from './chunk-task-manager';

/**
 * 扩展的分片上传配置
 * 包含额外的合并URL配置
 */
interface ExtendedChunkConfig {
  /** 分片大小（字节） */
  chunkSize?: number;
  /** 并发上传数 */
  concurrency?: number;
  /** 是否按顺序上传分片 */
  sequential?: boolean;
  /** 分片索引基数（0或1） */
  indexBase?: 0 | 1;
  /** 分片大小计算策略 */
  chunkSizeStrategy?: 'fixed' | 'adaptive';
  /** 合并分片的请求地址 */
  mergeUrl?: string;
}

/**
 * 扩展的上传配置，包含扩展的分片配置
 */
interface ExtendedUploadConfig extends IUploadConfig {
  chunk?: ExtendedChunkConfig;
}

/**
 * 分片合并器类
 * 负责发送分片合并请求并处理合并结果
 */
export class ChunkMerger {
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
   * 请求合并分片
   * @param fileId 文件ID
   * @returns 合并结果
   */
  public async mergeChunks(fileId: string): Promise<IUploadResult> {
    if (!this.networkAdapter) {
      throw new Error('网络适配器未初始化');
    }

    const task = this.taskManager.getTask(fileId);
    if (!task) {
      throw new Error(`未找到上传任务: ${fileId}`);
    }

    const { config, file, chunks } = task;
    const totalChunks = chunks.length;

    // 检查所有分片是否已上传
    if (task.uploadedChunks.size !== totalChunks) {
      throw new Error(`无法合并分片: 只有 ${task.uploadedChunks.size}/${totalChunks} 个分片已上传`);
    }

    // 发布合并开始事件
    if (this.eventEmitter) {
      this.eventEmitter.emit('chunk:merge:start', {
        fileId,
        fileName: file.name,
        totalChunks,
      });
    }

    this.logInfo(`开始合并分片: ${fileId}`, {
      fileName: file.name,
      totalChunks,
    });

    // 准备合并请求数据
    const formData = new FormData();

    // 添加文件信息
    formData.append('fileId', fileId);
    formData.append('fileName', file.name);
    formData.append('fileType', file.type);
    formData.append('fileSize', file.size.toString());
    formData.append('totalChunks', totalChunks.toString());

    // 添加自定义数据
    if (config.formData) {
      Object.entries(config.formData).forEach(([key, value]) => {
        formData.append(key, value as string);
      });
    }

    try {
      const startTime = performance.now();

      // 发送合并请求
      const mergeUrl = this.getMergeUrl(config as ExtendedUploadConfig);
      const response = await this.networkAdapter.post(mergeUrl, formData, {
        timeout: config.timeout || 60000, // 设置更长的超时时间，因为合并可能耗时较长
        headers: config.headers || {},
      });

      const endTime = performance.now();

      // 记录性能指标
      this.recordPerformanceMetric('merge', endTime - startTime);

      // 解析上传结果
      const result = this.parseUploadResult(response, fileId, file);

      // 标记进度为100%
      this.progressTracker.markAsCompleted(task);

      // 发布合并完成事件
      if (this.eventEmitter) {
        const fileInfo: IFileInfo = {
          id: fileId,
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
        };

        this.eventEmitter.emit('chunk:merge:complete', {
          file: fileInfo,
          result,
        });
      }

      this.logInfo(`分片合并成功: ${fileId}`, {
        time: `${(endTime - startTime).toFixed(2)}ms`,
        url: result.url || '',
      });

      return result;
    } catch (error) {
      this.logError(`分片合并失败: ${fileId}`, error);

      // 发布合并失败事件
      if (this.eventEmitter) {
        this.eventEmitter.emit('chunk:merge:error', {
          fileId,
          fileName: file.name,
          error,
        });
      }

      throw error;
    }
  }

  /**
   * 获取合并请求地址
   * @param config 上传配置
   * @returns 合并地址
   */
  private getMergeUrl(config: ExtendedUploadConfig): string {
    // 尝试从配置中获取合并地址
    if (config.chunk?.mergeUrl) {
      return config.chunk.mergeUrl;
    }

    // 默认使用上传地址加上"/merge"后缀
    const target = config.target;
    if (target.includes('?')) {
      // 如果URL包含查询参数
      const [baseUrl, queryString] = target.split('?');
      return `${baseUrl}/merge?${queryString}`;
    } else {
      return `${target}/merge`;
    }
  }

  /**
   * 解析上传结果
   * @param response 服务器响应
   * @param fileId 文件ID
   * @param file 文件对象
   * @returns 上传结果
   */
  private parseUploadResult(response: any, fileId: string, file: File): IUploadResult {
    // 创建基本的文件信息
    const fileInfo: IFileInfo = {
      id: fileId,
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
    };

    // 类型守卫：检查响应是否包含有效的URL
    const hasValidUrl = (obj: any): obj is { url: string } => {
      return (
        obj &&
        typeof obj === 'object' &&
        'url' in obj &&
        typeof obj.url === 'string' &&
        obj.url.trim() !== ''
      );
    };

    // 从响应中提取结果，如果响应已经是合适的结构则直接返回
    if (hasValidUrl(response)) {
      return {
        success: true,
        file: fileInfo,
        url: response.url,
        data: response,
      };
    }

    // 检查嵌套的data对象是否包含URL
    if (
      response &&
      typeof response === 'object' &&
      'data' in response &&
      hasValidUrl(response.data)
    ) {
      return {
        success: true,
        file: fileInfo,
        url: response.data.url,
        data: response.data,
      };
    }

    // 尝试从响应中查找任何可能的URL字段
    let url = '';
    if (response && typeof response === 'object') {
      // 尝试常见的URL字段名称
      const urlFields = ['url', 'fileUrl', 'downloadUrl', 'path', 'location'];
      for (const field of urlFields) {
        if (
          field in response &&
          typeof response[field] === 'string' &&
          response[field].trim() !== ''
        ) {
          url = response[field];
          break;
        }
      }
    }

    // 如果响应格式不符合预期，构造一个基础结果
    return {
      success: true,
      file: fileInfo,
      url,
      data: response,
    };
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
