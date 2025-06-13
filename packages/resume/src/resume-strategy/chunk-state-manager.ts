/**
 * 分片状态管理器
 * 负责处理分片状态的变更和追踪
 */
import { ILogger } from '@file-chunk-uploader/types';

import { IChunkDetail, ChunkStatus } from './types';

/**
 * 分片状态管理器类
 * 处理分片状态的变更、记录和追踪
 */
export class ChunkStateManager {
  /** 当前活跃的上传分片映射 fileId -> Set<chunkIndex> */
  private activeChunksMap: Map<string, Set<number>> = new Map();
  /** 日志记录器 */
  private logger?: ILogger;
  /** 最大并发分片数 */
  private maxConcurrentChunks: number;

  /**
   * 创建分片状态管理器
   * @param maxConcurrentChunks 最大并发分片数
   * @param logger 日志记录器
   */
  constructor(maxConcurrentChunks: number = 3, logger?: ILogger) {
    this.maxConcurrentChunks = maxConcurrentChunks;
    this.logger = logger;
  }

  /**
   * 获取指定文件的当前活跃上传分片数
   * @param fileId 文件ID
   * @returns 活跃上传分片数
   */
  public getActiveChunksCount(fileId: string): number {
    return this.activeChunksMap.get(fileId)?.size || 0;
  }

  /**
   * 检查是否可以上传新的分片（并发控制）
   * @param fileId 文件ID
   * @returns 是否可以上传新分片
   */
  public canUploadMoreChunks(fileId: string): boolean {
    const activeChunks = this.activeChunksMap.get(fileId);
    if (!activeChunks) {
      return true;
    }
    return activeChunks.size < this.maxConcurrentChunks;
  }

  /**
   * 标记分片开始上传
   * @param fileId 文件ID
   * @param chunkIndex 分片索引
   */
  public markChunkAsUploading(fileId: string, chunkIndex: number): void {
    // 确保文件ID在映射中存在
    if (!this.activeChunksMap.has(fileId)) {
      this.activeChunksMap.set(fileId, new Set());
    }

    // 添加分片到活跃集合
    this.activeChunksMap.get(fileId)?.add(chunkIndex);

    this.logDebug(`已标记分片为上传中 [文件:${fileId}, 分片:${chunkIndex}]`);
  }

  /**
   * 标记分片上传完成
   * @param fileId 文件ID
   * @param chunkIndex 分片索引
   */
  public markChunkAsComplete(fileId: string, chunkIndex: number): void {
    // 从活跃集合中移除分片
    this.activeChunksMap.get(fileId)?.delete(chunkIndex);

    this.logDebug(`已标记分片为完成 [文件:${fileId}, 分片:${chunkIndex}]`);
  }

  /**
   * 标记分片上传失败
   * @param fileId 文件ID
   * @param chunkIndex 分片索引
   */
  public markChunkAsFailed(fileId: string, chunkIndex: number): void {
    // 从活跃集合中移除分片
    this.activeChunksMap.get(fileId)?.delete(chunkIndex);

    this.logDebug(`已标记分片为失败 [文件:${fileId}, 分片:${chunkIndex}]`);
  }

  /**
   * 标记分片为已暂停
   * @param fileId 文件ID
   * @param chunkIndex 分片索引
   */
  public markChunkAsPaused(fileId: string, chunkIndex: number): void {
    // 从活跃集合中移除分片
    this.activeChunksMap.get(fileId)?.delete(chunkIndex);

    this.logDebug(`已标记分片为暂停 [文件:${fileId}, 分片:${chunkIndex}]`);
  }

  /**
   * 重置文件的活跃分片状态
   * @param fileId 文件ID
   */
  public resetActiveChunks(fileId: string): void {
    this.activeChunksMap.delete(fileId);
    this.logDebug(`已重置文件的活跃分片状态 [文件:${fileId}]`);
  }

  /**
   * 获取所有活跃分片的索引
   * @param fileId 文件ID
   * @returns 活跃分片索引数组
   */
  public getActiveChunks(fileId: string): number[] {
    const activeChunks = this.activeChunksMap.get(fileId);
    if (!activeChunks) {
      return [];
    }
    return Array.from(activeChunks);
  }

  /**
   * 检查分片是否处于活跃状态
   * @param fileId 文件ID
   * @param chunkIndex 分片索引
   * @returns 是否活跃
   */
  public isChunkActive(fileId: string, chunkIndex: number): boolean {
    return this.activeChunksMap.get(fileId)?.has(chunkIndex) || false;
  }

  /**
   * 更新分片信息
   * @param chunksDetails 当前分片详情
   * @param chunkIndex 要更新的分片索引
   * @param status 新的分片状态
   * @param error 错误信息（可选）
   * @returns 更新后的分片详情
   */
  public updateChunkInfo(
    chunksDetails: IChunkDetail[],
    chunkIndex: number,
    status: ChunkStatus,
    error?: string,
  ): IChunkDetail[] {
    // 复制一份分片详情数组
    const updatedChunks = [...chunksDetails];
    const now = Date.now();

    // 查找要更新的分片
    const chunkToUpdate = updatedChunks.find(chunk => chunk.index === chunkIndex);

    if (chunkToUpdate) {
      // 更新现有分片信息
      chunkToUpdate.status = status;
      chunkToUpdate.lastAttempt = now;

      // 如果是失败状态且提供了错误信息，则更新错误信息
      if (status === ChunkStatus.FAILED && error) {
        chunkToUpdate.lastError = error;
        chunkToUpdate.retryCount += 1;
      }

      // 如果是成功状态，清除错误信息
      if (status === ChunkStatus.SUCCESS) {
        chunkToUpdate.lastError = undefined;
      }
    } else {
      // 如果分片不存在于数组中，添加新的分片信息
      updatedChunks.push({
        index: chunkIndex,
        status,
        retryCount: status === ChunkStatus.FAILED ? 1 : 0,
        lastAttempt: now,
        lastError: status === ChunkStatus.FAILED ? error : undefined,
      });
    }

    return updatedChunks;
  }

  /**
   * 清理所有资源
   */
  public destroy(): void {
    this.activeChunksMap.clear();
    this.logDebug('分片状态管理器已销毁');
  }

  /**
   * 记录调试日志
   * @param message 日志消息
   * @param data 额外数据
   */
  private logDebug(message: string, data?: any): void {
    if (this.logger?.debug) {
      this.logger.debug(`[ChunkStateManager] ${message}`, data);
    }
  }
}
