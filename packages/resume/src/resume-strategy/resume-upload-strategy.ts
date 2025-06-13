/**
 * 断点续传策略实现
 * 负责实现上传状态保存、断点检测和恢复逻辑
 */
import {
  IEventEmitter,
  IFileInfo,
  IUploadProgress,
  UploadStatus,
  IFileChunkResult,
  ILogger,
  IStorageManager,
  IStorageOptions,
  IUploadConfig,
  StorageType,
} from '@file-chunk-uploader/types';

import { StorageManager } from '../storage';

import { ChunkStateManager } from './chunk-state-manager';
import { ProgressCalculator } from './progress-calculator';
import {
  ChunkStatus,
  IChunkDetail,
  IExtendedUploadState,
  IResumeUploadStrategyOptions,
} from './types';
import { UploadStateValidator } from './upload-state-validator';

/**
 * 续传上传策略类
 * 实现断点续传功能，包括状态保存、断点检测和恢复逻辑
 */
export class ResumeUploadStrategy {
  /** 存储管理器 */
  private storageManager: IStorageManager;
  /** 事件发射器 */
  private eventEmitter?: IEventEmitter;
  /** 分片状态管理器 */
  private chunkStateManager: ChunkStateManager;
  /** 上传状态验证器 */
  private uploadStateValidator: UploadStateValidator;
  /** 进度计算器 */
  private progressCalculator: ProgressCalculator;
  /** 配置选项 */
  private options: {
    storage: IStorageOptions;
    enabled: boolean;
    maxStorageTime: number;
    maxConcurrentChunks: number;
    visualizationCallback?: (fileId: string, chunksInfo: IChunkDetail[]) => void;
    cleanupInterval: number;
    logger?: ILogger;
  };
  /** 日志记录器 */
  private logger?: ILogger;
  /** 是否启用 */
  private enabled: boolean;
  /** 清理定时器ID */
  private cleanupTimer?: NodeJS.Timeout;

  /**
   * 创建续传策略实例
   * @param options 续传策略配置选项
   */
  constructor(options: IResumeUploadStrategyOptions = {}) {
    // 设置默认选项
    this.options = {
      storage: options.storage || {},
      enabled: options.enabled !== false,
      maxStorageTime: options.maxStorageTime || 7 * 24 * 60 * 60 * 1000, // 默认7天
      maxConcurrentChunks: options.maxConcurrentChunks || 3, // 默认并发3个分片
      visualizationCallback: options.visualizationCallback,
      cleanupInterval: options.cleanupInterval || 24 * 60 * 60 * 1000, // 默认每天清理一次
      logger: options.logger,
    };

    this.enabled = this.options.enabled;
    this.logger = this.options.logger;

    // 创建存储管理器
    this.storageManager = new StorageManager(this.options.storage);

    // 创建分片状态管理器
    this.chunkStateManager = new ChunkStateManager(this.options.maxConcurrentChunks, this.logger);

    // 创建上传状态验证器
    this.uploadStateValidator = new UploadStateValidator();

    // 创建进度计算器
    this.progressCalculator = new ProgressCalculator(this.logger);

    // 定期清理过期数据
    this.scheduleCleanup();
  }

  /**
   * 销毁实例，清理资源
   * 在组件销毁或不再需要时必须调用此方法，防止内存泄漏
   */
  public destroy(): void {
    // 清理定时器，防止内存泄漏
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    // 清理分片状态管理器
    this.chunkStateManager.destroy();

    // 解除事件发射器引用
    this.eventEmitter = undefined;

    this.logInfo('续传策略实例已销毁，资源已释放');
  }

  /**
   * 设置事件发射器
   * @param emitter 事件发射器实例
   */
  public setEventEmitter(emitter: IEventEmitter): void {
    this.eventEmitter = emitter;
  }

  /**
   * 启用或禁用断点续传
   * @param enabled 是否启用
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * 获取指定文件的当前活跃上传分片数
   * @param fileId 文件ID
   * @returns 活跃上传分片数
   */
  public getActiveChunksCount(fileId: string): number {
    return this.chunkStateManager.getActiveChunksCount(fileId);
  }

  /**
   * 检查是否可以上传新的分片（并发控制）
   * @param fileId 文件ID
   * @returns 是否可以上传新分片
   */
  public canUploadMoreChunks(fileId: string): boolean {
    return this.chunkStateManager.canUploadMoreChunks(fileId);
  }

  /**
   * 标记分片开始上传
   * @param fileId 文件ID
   * @param chunkIndex 分片索引
   */
  public markChunkAsUploading(fileId: string, chunkIndex: number): void {
    this.chunkStateManager.markChunkAsUploading(fileId, chunkIndex);
  }

  /**
   * 标记分片上传完成
   * @param fileId 文件ID
   * @param chunkIndex 分片索引
   */
  public async markChunkAsComplete(fileId: string, chunkIndex: number): Promise<void> {
    // 更新分片状态管理器
    this.chunkStateManager.markChunkAsComplete(fileId, chunkIndex);

    // 更新上传状态
    await this.updateUploadedChunk(fileId, chunkIndex);
  }

  /**
   * 标记分片上传失败
   * @param fileId 文件ID
   * @param chunkIndex 分片索引
   * @param error 错误信息
   */
  public markChunkAsFailed(fileId: string, chunkIndex: number, error?: string): void {
    // 更新分片状态管理器
    this.chunkStateManager.markChunkAsFailed(fileId, chunkIndex);

    // 更新分片状态
    this.updateChunkStatus(fileId, chunkIndex, ChunkStatus.FAILED, error);
  }

  /**
   * 更新分片状态
   * @param fileId 文件ID
   * @param chunkIndex 分片索引
   * @param status 分片状态
   * @param error 错误信息
   */
  public async updateChunkStatus(
    fileId: string,
    chunkIndex: number,
    status: ChunkStatus,
    error?: string,
  ): Promise<void> {
    try {
      // 获取存储的上传状态
      const state = await this.storageManager.getUploadState(fileId);
      if (!state) {
        this.logDebug(`未找到上传状态，无法更新分片状态 [文件:${fileId}, 分片:${chunkIndex}]`);
        return;
      }

      // 转换为扩展上传状态
      const extendedState = state as IExtendedUploadState;
      if (!extendedState.chunksDetails) {
        extendedState.chunksDetails = [];
      }

      // 更新分片状态
      extendedState.chunksDetails = this.chunkStateManager.updateChunkInfo(
        extendedState.chunksDetails,
        chunkIndex,
        status,
        error,
      );

      // 更新上传状态
      extendedState.lastUpdated = Date.now();

      // 保存更新后的状态
      await this.storageManager.saveUploadState(fileId, extendedState);

      // 更新UI可视化（如果提供了回调）
      this.updateVisualization(fileId, extendedState.chunksDetails);

      this.logDebug(`已更新分片状态 [文件:${fileId}, 分片:${chunkIndex}, 状态:${status}]`);
    } catch (error) {
      this.logError(`更新分片状态失败 [文件:${fileId}, 分片:${chunkIndex}]`, error);
    }
  }

  /**
   * 检查文件是否可以断点续传
   * @param fileInfo 文件信息
   * @returns 上传状态或null（如果不可续传）
   */
  public async checkResumable(fileInfo: IFileInfo): Promise<IExtendedUploadState | null> {
    if (!this.enabled) {
      this.logDebug(`断点续传已禁用，跳过检查 [文件:${fileInfo.id}]`);
      return null;
    }

    try {
      // 从存储中获取上传状态
      const state = await this.storageManager.getUploadState(fileInfo.id);
      if (!state) {
        this.logDebug(`未找到上传状态 [文件:${fileInfo.id}]`);
        return null;
      }

      // 验证上传状态
      const validationResult = this.uploadStateValidator.validateUploadState(
        state as IExtendedUploadState,
        fileInfo,
      );
      if (!validationResult.valid) {
        this.logDebug(
          `上传状态验证失败 [文件:${fileInfo.id}]: ${validationResult.reason}`,
          validationResult.details,
        );
        return null;
      }

      // 转换为扩展上传状态
      const extendedState = state as IExtendedUploadState;
      if (!extendedState.chunksDetails) {
        extendedState.chunksDetails = [];
      }

      // 更新并发配置
      extendedState.maxConcurrentChunks = this.options.maxConcurrentChunks;

      // 重置活跃分片状态
      this.chunkStateManager.resetActiveChunks(fileInfo.id);

      // 重置所有处于上传中状态的分片为暂停状态
      const updatedChunksDetails = extendedState.chunksDetails.map(chunk => {
        if (chunk.status === ChunkStatus.UPLOADING) {
          return { ...chunk, status: ChunkStatus.PAUSED };
        }
        return chunk;
      });

      extendedState.chunksDetails = updatedChunksDetails;

      // 更新上传状态，标记为已恢复
      extendedState.status = UploadStatus.UPLOADING;
      extendedState.lastUpdated = Date.now();

      // 保存更新后的状态
      await this.storageManager.saveUploadState(fileInfo.id, extendedState);

      // 更新UI可视化
      this.updateVisualization(fileInfo.id, updatedChunksDetails);

      this.logInfo(`找到可续传的上传状态 [文件:${fileInfo.id}]`, {
        uploadedChunks: extendedState.uploadedChunks.length,
        totalChunks: extendedState.totalChunks,
        progress: extendedState.progress.percent,
      });

      return extendedState;
    } catch (error) {
      this.logError(`检查续传状态失败 [文件:${fileInfo.id}]`, error);
      return null;
    }
  }

  /**
   * 保存上传状态
   * @param fileInfo 文件信息
   * @param chunkResult 分片结果
   * @param uploadedChunks 已上传分片索引数组
   * @param status 上传状态
   * @param progress 上传进度
   */
  public async saveUploadState(
    fileInfo: IFileInfo,
    chunkResult: IFileChunkResult,
    uploadedChunks: number[],
    status: UploadStatus = UploadStatus.UPLOADING,
    progress?: IUploadProgress,
  ): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      // 获取现有状态或创建新状态
      const state =
        ((await this.storageManager.getUploadState(fileInfo.id)) as IExtendedUploadState) || {};

      // 获取分片详情
      const chunksDetails = state.chunksDetails || [];

      // 如果没有提供进度信息，计算进度
      if (!progress) {
        progress = this.progressCalculator.calculateProgress(
          fileInfo.id,
          fileInfo.size,
          chunkResult.chunkSize,
          uploadedChunks,
        );
      }

      // 更新上传状态
      const updatedState: IExtendedUploadState = {
        ...state,
        fileId: fileInfo.id,
        fileName: fileInfo.name,
        fileSize: fileInfo.size,
        lastModified: fileInfo.lastModified,
        uploadedChunks,
        totalChunks: Math.ceil(fileInfo.size / chunkResult.chunkSize),
        chunkSize: chunkResult.chunkSize,
        progress,
        status,
        lastUpdated: Date.now(),
        chunksDetails,
        maxConcurrentChunks: this.options.maxConcurrentChunks,
      };

      // 保存状态到存储
      await this.storageManager.saveUploadState(fileInfo.id, updatedState);

      // 更新UI可视化
      this.updateVisualization(fileInfo.id, chunksDetails);

      this.logDebug(`已保存上传状态 [文件:${fileInfo.id}]`, {
        progress: progress.percent,
        uploadedChunks: uploadedChunks.length,
        totalChunks: Math.ceil(fileInfo.size / chunkResult.chunkSize),
      });
    } catch (error) {
      this.logError(`保存上传状态失败 [文件:${fileInfo.id}]`, error);
    }
  }

  /**
   * 更新已上传的分片信息
   * @param fileId 文件ID
   * @param chunkIndex 分片索引
   */
  public async updateUploadedChunk(fileId: string, chunkIndex: number): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      // 获取上传状态
      const state = await this.storageManager.getUploadState(fileId);
      if (!state) {
        this.logDebug(`未找到上传状态，无法更新分片 [文件:${fileId}, 分片:${chunkIndex}]`);
        return;
      }

      // 检查分片是否已经标记为已上传
      const uploadedChunks = state.uploadedChunks || [];
      if (uploadedChunks.includes(chunkIndex)) {
        return; // 分片已经标记为已上传，不需要再次更新
      }

      // 添加分片到已上传列表
      uploadedChunks.push(chunkIndex);

      // 更新分片状态
      const extendedState = state as IExtendedUploadState;
      if (!extendedState.chunksDetails) {
        extendedState.chunksDetails = [];
      }

      // 更新分片状态为成功
      extendedState.chunksDetails = this.chunkStateManager.updateChunkInfo(
        extendedState.chunksDetails,
        chunkIndex,
        ChunkStatus.SUCCESS,
      );

      // 更新进度
      const progress = this.progressCalculator.calculateProgress(
        fileId,
        (state as IExtendedUploadState).fileSize,
        (state as IExtendedUploadState).chunkSize,
        uploadedChunks,
      );

      // 更新状态
      extendedState.uploadedChunks = uploadedChunks;
      extendedState.progress = progress;
      extendedState.lastUpdated = Date.now();

      // 保存更新后的状态
      await this.storageManager.saveUploadState(fileId, extendedState);

      // 更新UI可视化
      this.updateVisualization(fileId, extendedState.chunksDetails);

      this.logDebug(`已更新上传分片 [文件:${fileId}, 分片:${chunkIndex}]`, {
        progress: progress.percent,
        uploadedChunks: uploadedChunks.length,
        totalChunks: Math.ceil(
          (state as IExtendedUploadState).fileSize / (state as IExtendedUploadState).chunkSize,
        ),
      });
    } catch (error) {
      this.logError(`更新上传分片失败 [文件:${fileId}, 分片:${chunkIndex}]`, error);
    }
  }

  /**
   * 完成上传，清理状态
   * @param fileId 文件ID
   */
  public async completeUpload(fileId: string): Promise<void> {
    try {
      // 清理分片状态管理器中的记录
      this.chunkStateManager.resetActiveChunks(fileId);

      // 清理存储中的上传状态
      await this.storageManager.deleteFile(fileId);

      this.logInfo(`已完成上传并清理状态 [文件:${fileId}]`);
    } catch (error) {
      this.logError(`完成上传清理状态失败 [文件:${fileId}]`, error);
    }
  }

  /**
   * 获取待上传的分片
   * @param fileId 文件ID
   * @param totalChunks 总分片数
   * @returns 待上传分片索引数组
   */
  public async getPendingChunks(fileId: string, totalChunks: number): Promise<number[]> {
    if (!this.enabled) {
      // 如果断点续传禁用，返回所有分片
      return Array.from({ length: totalChunks }, (_, i) => i);
    }

    try {
      // 获取上传状态
      const state = await this.storageManager.getUploadState(fileId);
      if (!state || !state.uploadedChunks) {
        // 如果没有找到上传状态或没有已上传分片记录，返回所有分片
        return Array.from({ length: totalChunks }, (_, i) => i);
      }

      // 获取已上传的分片
      const uploadedChunks = state.uploadedChunks;

      // 计算待上传的分片（所有分片索引中排除已上传的）
      const pendingChunks = [];
      for (let i = 0; i < totalChunks; i++) {
        if (!uploadedChunks.includes(i)) {
          pendingChunks.push(i);
        }
      }

      this.logDebug(`获取待上传分片 [文件:${fileId}]`, {
        pendingChunks: pendingChunks.length,
        uploadedChunks: uploadedChunks.length,
        totalChunks,
      });

      return pendingChunks;
    } catch (error) {
      this.logError(`获取待上传分片失败 [文件:${fileId}]`, error);
      // 出错时返回所有分片
      return Array.from({ length: totalChunks }, (_, i) => i);
    }
  }

  /**
   * 获取分片详情
   * @param fileId 文件ID
   * @returns 分片详情数组
   */
  public async getChunksDetails(fileId: string): Promise<IChunkDetail[]> {
    try {
      // 获取上传状态
      const state = (await this.storageManager.getUploadState(fileId)) as IExtendedUploadState;
      if (!state || !state.chunksDetails) {
        return [];
      }

      return state.chunksDetails;
    } catch (error) {
      this.logError(`获取分片详情失败 [文件:${fileId}]`, error);
      return [];
    }
  }

  /**
   * 配置上传器
   * @param config 上传配置
   * @returns 更新后的配置
   */
  public configureUploader(config: IUploadConfig): IUploadConfig {
    // 使用类型断言解决类型问题
    const updatedConfig = {
      ...config,
      storage: {
        ...(config.storage || {}),
      },
    } as IUploadConfig;

    return updatedConfig;
  }

  /**
   * 转换存储类型
   * @param type 存储类型
   * @returns 转换后的存储类型
   */
  private convertStorageType(type?: StorageType): StorageType | undefined {
    return type;
  }

  /**
   * 获取上传统计信息
   * @param fileId 文件ID
   * @returns 上传统计信息
   */
  public async getUploadStats(fileId: string): Promise<{
    total: number;
    uploaded: number;
    failed: number;
    pending: number;
    uploading: number;
    progress: number;
    estimatedTimeRemaining?: number;
  }> {
    try {
      // 获取上传状态
      const state = (await this.storageManager.getUploadState(fileId)) as IExtendedUploadState;
      if (!state) {
        return {
          total: 0,
          uploaded: 0,
          failed: 0,
          pending: 0,
          uploading: 0,
          progress: 0,
        };
      }

      // 获取分片详情
      const chunksDetails = state.chunksDetails || [];

      // 计算统计信息
      return this.progressCalculator.getUploadStats(chunksDetails, state.totalChunks);
    } catch (error) {
      this.logError(`获取上传统计信息失败 [文件:${fileId}]`, error);
      return {
        total: 0,
        uploaded: 0,
        failed: 0,
        pending: 0,
        uploading: 0,
        progress: 0,
      };
    }
  }

  /**
   * 更新UI可视化
   * @param fileId 文件ID
   * @param chunksDetails 分片详情数组
   */
  private updateVisualization(fileId: string, chunksDetails: IChunkDetail[]): void {
    if (this.options.visualizationCallback) {
      try {
        this.options.visualizationCallback(fileId, chunksDetails);
      } catch (error) {
        this.logError('执行可视化回调失败', error);
      }
    }
  }

  /**
   * 安排定期清理过期数据
   */
  private scheduleCleanup(): void {
    // 清理已有的定时器
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    // 设置新的定时器
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredData();
    }, this.options.cleanupInterval);
  }

  /**
   * 清理过期数据
   */
  private async cleanupExpiredData(): Promise<void> {
    try {
      const cleanupTime = Date.now() - this.options.maxStorageTime;
      await this.storageManager.cleanupExpiredData(cleanupTime);
      this.logInfo('已清理过期数据');
    } catch (error) {
      this.logError('清理过期数据失败', error);
    }
  }

  /**
   * 记录调试日志
   * @param message 日志消息
   * @param data 额外数据
   */
  private logDebug(message: string, data?: any): void {
    if (this.logger?.debug) {
      this.logger.debug(`[ResumeStrategy] ${message}`, data);
    }
  }

  /**
   * 记录信息日志
   * @param message 日志消息
   * @param data 额外数据
   */
  private logInfo(message: string, data?: any): void {
    if (this.logger?.info) {
      this.logger.info(`[ResumeStrategy] ${message}`, data);
    }
  }

  /**
   * 记录错误日志
   * @param message 日志消息
   * @param error 错误对象
   */
  private logError(message: string, error: any): void {
    if (this.logger?.error) {
      this.logger.error(`[ResumeStrategy] ${message}`, error);
    }
  }
}
