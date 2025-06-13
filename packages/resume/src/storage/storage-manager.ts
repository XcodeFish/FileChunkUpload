import {
  IStorageAdapter,
  IStorageManager,
  IStorageOptions,
  IStorageUsage,
  IUploadState,
  IRetryState,
  StorageType,
} from '@file-chunk-uploader/types';

import { IndexedDBAdapter } from './indexed-db-adapter';
import { StorageLogger, StorageOperation } from './storage-logger';

/**
 * StorageManager 实现
 * 提供对断点续传相关数据的管理功能
 */
export class StorageManager implements IStorageManager {
  private adapter: IStorageAdapter;
  private options: IStorageOptions;
  private autoClearInterval: ReturnType<typeof setInterval> | null = null;
  private logger: StorageLogger;

  /**
   * 创建StorageManager实例
   * @param options 存储选项
   */
  constructor(options: IStorageOptions = {}) {
    this.options = {
      type: StorageType.INDEXED_DB,
      dbName: 'file-chunk-uploader',
      storeName: 'uploads',
      keyPrefix: '',
      expiration: 7 * 24 * 60 * 60 * 1000, // 默认保存7天
      enabled: true,
      autoClear: true,
      clearInterval: 30 * 60 * 1000, // 默认每30分钟清理一次过期数据
      ...options,
    };

    // 初始化日志记录器
    this.logger = new StorageLogger(undefined, {
      enabled: this.options.enabled,
      debug: false,
    });

    this.adapter = this.createAdapter();
    this.setupAutoClear();
  }

  /**
   * 保存上传状态
   * @param fileId 文件ID
   * @param state 上传状态
   */
  async saveUploadState(fileId: string, state: IUploadState): Promise<void> {
    if (!this.options.enabled) {
      return;
    }

    const key = `state_${fileId}`;
    const startTime = performance.now();

    try {
      await this.adapter.save(key, state, this.options.expiration);

      // 记录操作日志
      this.logger.logOperation(StorageOperation.SAVE, key, {
        success: true,
        duration: performance.now() - startTime,
        size: this.estimateObjectSize(state),
      });
    } catch (error) {
      // 记录错误日志
      this.logger.logOperation(StorageOperation.SAVE, key, {
        success: false,
        duration: performance.now() - startTime,
        error: error as Error,
      });

      console.error('保存上传状态失败:', error);
      throw new Error(`保存上传状态失败: ${(error as Error).message}`);
    }
  }

  /**
   * 保存文件分片
   * @param fileId 文件ID
   * @param chunkIndex 分片索引
   * @param chunk 分片数据
   */
  async saveChunk(fileId: string, chunkIndex: number, chunk: Blob): Promise<void> {
    if (!this.options.enabled) {
      return;
    }

    const key = `chunk_${fileId}_${chunkIndex}`;
    const startTime = performance.now();

    try {
      await this.adapter.save(key, chunk, this.options.expiration);

      // 记录操作日志
      this.logger.logOperation(StorageOperation.SAVE, key, {
        success: true,
        duration: performance.now() - startTime,
        size: chunk.size,
      });
    } catch (error) {
      // 记录错误日志
      this.logger.logOperation(StorageOperation.SAVE, key, {
        success: false,
        duration: performance.now() - startTime,
        error: error as Error,
      });

      console.error(`保存分片${chunkIndex}失败:`, error);
      throw new Error(`保存分片失败: ${(error as Error).message}`);
    }
  }

  /**
   * 获取上传状态
   * @param fileId 文件ID
   * @returns 上传状态或null
   */
  async getUploadState(fileId: string): Promise<IUploadState | null> {
    if (!this.options.enabled) {
      return null;
    }

    const key = `state_${fileId}`;
    const startTime = performance.now();

    try {
      const result = await this.adapter.get<IUploadState>(key);

      // 记录操作日志
      this.logger.logOperation(StorageOperation.GET, key, {
        success: true,
        duration: performance.now() - startTime,
        size: result ? this.estimateObjectSize(result) : 0,
      });

      return result;
    } catch (error) {
      // 记录错误日志
      this.logger.logOperation(StorageOperation.GET, key, {
        success: false,
        duration: performance.now() - startTime,
        error: error as Error,
      });

      console.error('获取上传状态失败:', error);
      return null;
    }
  }

  /**
   * 获取文件分片
   * @param fileId 文件ID
   * @param chunkIndex 分片索引
   * @returns 分片数据或null
   */
  async getChunk(fileId: string, chunkIndex: number): Promise<Blob | null> {
    if (!this.options.enabled) {
      return null;
    }

    const key = `chunk_${fileId}_${chunkIndex}`;
    const startTime = performance.now();

    try {
      const result = await this.adapter.get<Blob>(key);

      // 记录操作日志
      this.logger.logOperation(StorageOperation.GET, key, {
        success: true,
        duration: performance.now() - startTime,
        size: result?.size || 0,
      });

      return result;
    } catch (error) {
      // 记录错误日志
      this.logger.logOperation(StorageOperation.GET, key, {
        success: false,
        duration: performance.now() - startTime,
        error: error as Error,
      });

      console.error(`获取分片${chunkIndex}失败:`, error);
      return null;
    }
  }

  /**
   * 获取文件的所有分片索引
   * @param fileId 文件ID
   * @returns 分片索引数组
   */
  async getChunkIndices(fileId: string): Promise<number[]> {
    if (!this.options.enabled) {
      return [];
    }

    const prefix = `chunk_${fileId}_`;
    const startTime = performance.now();

    try {
      const keys = await this.adapter.keys();

      const indices = keys
        .filter(key => key.startsWith(prefix))
        .map(key => {
          const index = key.substring(prefix.length);
          return parseInt(index, 10);
        })
        .filter(index => !isNaN(index))
        .sort((a, b) => a - b); // 确保按索引升序排列

      // 记录操作日志
      this.logger.logOperation(StorageOperation.LIST, prefix, {
        success: true,
        duration: performance.now() - startTime,
      });

      return indices;
    } catch (error) {
      // 记录错误日志
      this.logger.logOperation(StorageOperation.LIST, prefix, {
        success: false,
        duration: performance.now() - startTime,
        error: error as Error,
      });

      console.error('获取分片索引失败:', error);
      return [];
    }
  }

  /**
   * 删除文件相关数据
   * @param fileId 文件ID
   */
  async deleteFile(fileId: string): Promise<void> {
    if (!this.options.enabled) {
      return;
    }

    const startTime = performance.now();

    try {
      // 删除状态
      await this.adapter.remove(`state_${fileId}`);

      // 删除重试状态
      await this.adapter.remove(`retry_${fileId}`);

      // 获取并删除所有分片
      const chunkIndices = await this.getChunkIndices(fileId);
      const promises = chunkIndices.map(index => this.adapter.remove(`chunk_${fileId}_${index}`));

      await Promise.all(promises);

      // 记录操作日志
      this.logger.logOperation(StorageOperation.DELETE, `file_${fileId}`, {
        success: true,
        duration: performance.now() - startTime,
      });
    } catch (error) {
      // 记录错误日志
      this.logger.logOperation(StorageOperation.DELETE, `file_${fileId}`, {
        success: false,
        duration: performance.now() - startTime,
        error: error as Error,
      });

      console.error('删除文件数据失败:', error);
      throw new Error(`删除文件数据失败: ${(error as Error).message}`);
    }
  }

  /**
   * 清理过期数据
   * @param _maxAge 最大保存时间(毫秒)
   */
  async cleanupExpiredData(_maxAge?: number): Promise<void> {
    if (!this.options.enabled) {
      return;
    }

    const startTime = performance.now();

    try {
      await this.adapter.clearExpired();

      // 记录操作日志
      this.logger.logOperation(StorageOperation.CLEANUP, 'expired_data', {
        success: true,
        duration: performance.now() - startTime,
      });
    } catch (error) {
      // 记录错误日志
      this.logger.logOperation(StorageOperation.CLEANUP, 'expired_data', {
        success: false,
        duration: performance.now() - startTime,
        error: error as Error,
      });

      console.error('清理过期数据失败:', error);
    }
  }

  /**
   * 获取存储使用情况
   * @returns 存储使用情况
   */
  async getStorageUsage(): Promise<IStorageUsage> {
    if (!this.options.enabled) {
      return { totalSize: 0, chunkCount: 0, fileCount: 0 };
    }

    const startTime = performance.now();

    try {
      const usage = await this.adapter.getUsage();

      // 记录操作日志
      this.logger.logOperation(StorageOperation.GET, 'storage_usage', {
        success: true,
        duration: performance.now() - startTime,
      });

      return usage;
    } catch (error) {
      // 记录错误日志
      this.logger.logOperation(StorageOperation.GET, 'storage_usage', {
        success: false,
        duration: performance.now() - startTime,
        error: error as Error,
      });

      console.error('获取存储使用情况失败:', error);
      return { totalSize: 0, chunkCount: 0, fileCount: 0 };
    }
  }

  /**
   * 获取活跃上传列表
   * @returns 文件ID数组
   */
  async getActiveUploads(): Promise<string[]> {
    if (!this.options.enabled) {
      return [];
    }

    const startTime = performance.now();
    const statePrefix = 'state_';

    try {
      const keys = await this.adapter.keys();

      const fileIds = keys
        .filter(key => key.startsWith(statePrefix))
        .map(key => key.substring(statePrefix.length));

      // 记录操作日志
      this.logger.logOperation(StorageOperation.LIST, 'active_uploads', {
        success: true,
        duration: performance.now() - startTime,
      });

      return fileIds;
    } catch (error) {
      // 记录错误日志
      this.logger.logOperation(StorageOperation.LIST, 'active_uploads', {
        success: false,
        duration: performance.now() - startTime,
        error: error as Error,
      });

      console.error('获取活跃上传列表失败:', error);
      return [];
    }
  }

  /**
   * 保存重试状态
   * @param fileId 文件ID
   * @param state 重试状态
   */
  async saveRetryState(fileId: string, state: IRetryState): Promise<void> {
    if (!this.options.enabled) {
      return;
    }

    const key = `retry_${fileId}`;
    const startTime = performance.now();

    try {
      await this.adapter.save(key, state, this.options.expiration);

      // 记录操作日志
      this.logger.logOperation(StorageOperation.SAVE, key, {
        success: true,
        duration: performance.now() - startTime,
        size: this.estimateObjectSize(state),
      });
    } catch (error) {
      // 记录错误日志
      this.logger.logOperation(StorageOperation.SAVE, key, {
        success: false,
        duration: performance.now() - startTime,
        error: error as Error,
      });

      console.error('保存重试状态失败:', error);
      throw new Error(`保存重试状态失败: ${(error as Error).message}`);
    }
  }

  /**
   * 获取重试状态
   * @param fileId 文件ID
   * @returns 重试状态或null
   */
  async getRetryState(fileId: string): Promise<IRetryState | null> {
    if (!this.options.enabled) {
      return null;
    }

    const key = `retry_${fileId}`;
    const startTime = performance.now();

    try {
      const result = await this.adapter.get<IRetryState>(key);

      // 记录操作日志
      this.logger.logOperation(StorageOperation.GET, key, {
        success: true,
        duration: performance.now() - startTime,
        size: result ? this.estimateObjectSize(result) : 0,
      });

      return result;
    } catch (error) {
      // 记录错误日志
      this.logger.logOperation(StorageOperation.GET, key, {
        success: false,
        duration: performance.now() - startTime,
        error: error as Error,
      });

      console.error('获取重试状态失败:', error);
      return null;
    }
  }

  /**
   * 创建存储适配器
   * @returns 存储适配器实例
   */
  private createAdapter(): IStorageAdapter {
    const startTime = performance.now();

    try {
      // 如果提供了自定义适配器，则使用它
      if (this.options.adapter) {
        this.logger.logOperation(StorageOperation.INIT, 'custom_adapter', {
          success: true,
          duration: performance.now() - startTime,
        });
        return this.options.adapter;
      }

      // 根据存储类型创建适配器
      let adapter: IStorageAdapter;
      switch (this.options.type) {
        case StorageType.INDEXED_DB:
          adapter = new IndexedDBAdapter(this.options);
          break;
        // 其他适配器类型可以在这里添加
        default:
          // 默认使用IndexedDB适配器
          adapter = new IndexedDBAdapter(this.options);
      }

      this.logger.logOperation(StorageOperation.INIT, String(this.options.type), {
        success: true,
        duration: performance.now() - startTime,
      });

      return adapter;
    } catch (error) {
      this.logger.logOperation(StorageOperation.INIT, String(this.options.type), {
        success: false,
        duration: performance.now() - startTime,
        error: error as Error,
      });

      throw error;
    }
  }

  /**
   * 设置自动清理过期数据
   */
  private setupAutoClear(): void {
    // 清理之前的计时器
    if (this.autoClearInterval) {
      clearInterval(this.autoClearInterval);
      this.autoClearInterval = null;
    }

    // 如果启用了自动清理且在浏览器环境
    if (this.options.enabled && this.options.autoClear && typeof window !== 'undefined') {
      this.autoClearInterval = setInterval(
        () => {
          this.cleanupExpiredData().catch(error => {
            console.error('自动清理过期数据失败:', error);
          });
        },
        this.options.clearInterval || 30 * 60 * 1000,
      ); // 默认每30分钟
    }
  }

  /**
   * 估算对象大小
   * @param obj 要估算大小的对象
   * @returns 估算的字节大小
   */
  private estimateObjectSize(obj: any): number {
    if (obj === null || obj === undefined) return 0;

    // 使用JSON序列化来估算大小
    try {
      return JSON.stringify(obj).length * 2; // UTF-16 编码每个字符2字节
    } catch (error) {
      return 0; // 无法序列化时返回0
    }
  }

  /**
   * 销毁存储管理器，清理资源
   */
  destroy(): void {
    if (this.autoClearInterval) {
      clearInterval(this.autoClearInterval);
      this.autoClearInterval = null;
    }
  }

  /**
   * 设置日志记录器
   * @param logger 核心包的Logger实例
   */
  setLogger(logger: any): void {
    this.logger.setLogger(logger);
  }

  /**
   * 启用调试日志
   * @param debug 是否启用调试日志
   */
  setDebug(debug: boolean): void {
    this.logger.setDebug(debug);
  }
}
