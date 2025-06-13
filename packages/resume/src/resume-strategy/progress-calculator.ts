/**
 * 上传进度计算器
 * 负责计算上传进度和统计信息
 */
import { ILogger, IUploadProgress } from '@file-chunk-uploader/types';

import { ChunkStatus, IChunkDetail, IUploadStats } from './types';

/**
 * 上传进度计算器类
 * 提供各种进度计算和统计功能
 */
export class ProgressCalculator {
  /** 日志记录器 */
  private logger?: ILogger;

  /**
   * 创建进度计算器
   * @param logger 日志记录器
   */
  constructor(logger?: ILogger) {
    this.logger = logger;
  }

  /**
   * 计算上传进度
   * @param fileId 文件ID
   * @param fileSize 文件大小（字节）
   * @param chunkSize 分片大小（字节）
   * @param uploadedChunks 已上传分片索引数组
   * @returns 上传进度信息和分片统计
   */
  public calculateProgress(
    fileId: string,
    fileSize: number,
    chunkSize: number,
    uploadedChunks: number[],
  ): IUploadProgress & { totalChunks: number; uploadedChunks: number } {
    // 计算总分片数
    const totalChunks = Math.ceil(fileSize / chunkSize);

    // 计算已上传字节数（处理最后一个分片可能不完整的情况）
    let uploadedBytes = 0;

    uploadedChunks.forEach(chunkIndex => {
      // 最后一个分片可能小于chunkSize
      if (chunkIndex === totalChunks - 1) {
        const lastChunkSize = fileSize % chunkSize || chunkSize;
        uploadedBytes += lastChunkSize;
      } else {
        uploadedBytes += chunkSize;
      }
    });

    // 计算进度百分比，确保不超过100%
    const percent = Math.min(100, Math.floor((uploadedBytes / fileSize) * 100));

    this.logDebug(`计算上传进度 [文件:${fileId}] ${percent}% (${uploadedBytes}/${fileSize}字节)`);

    return {
      loaded: uploadedBytes,
      total: fileSize,
      percent,
      speed: 0,
      timeElapsed: 0,
      timeRemaining: 0,
      totalChunks,
      uploadedChunks: uploadedChunks.length,
    };
  }

  /**
   * 获取分片统计信息
   * @param chunksDetails 分片详情数组
   * @param totalChunks 总分片数
   * @returns 统计信息
   */
  public getUploadStats(chunksDetails: IChunkDetail[], totalChunks: number): IUploadStats {
    // 初始化统计数据
    const stats = {
      total: totalChunks,
      uploaded: 0,
      failed: 0,
      pending: 0,
      uploading: 0,
      progress: 0,
    };

    // 如果没有分片详情，假设所有分片都是待处理状态
    if (!chunksDetails || chunksDetails.length === 0) {
      stats.pending = totalChunks;
      return stats;
    }

    // 统计各状态分片数量
    chunksDetails.forEach(chunk => {
      switch (chunk.status) {
        case ChunkStatus.SUCCESS:
          stats.uploaded++;
          break;
        case ChunkStatus.FAILED:
          stats.failed++;
          break;
        case ChunkStatus.UPLOADING:
          stats.uploading++;
          break;
        case ChunkStatus.PENDING:
        case ChunkStatus.PAUSED:
        default:
          stats.pending++;
          break;
      }
    });

    // 计算整体进度百分比
    stats.progress = totalChunks > 0 ? Math.floor((stats.uploaded / totalChunks) * 100) : 0;

    // 确保待处理分片数量正确（考虑可能有些分片还没有添加到详情中）
    const accountedChunks = stats.uploaded + stats.failed + stats.uploading + stats.pending;
    if (accountedChunks < totalChunks) {
      stats.pending += totalChunks - accountedChunks;
    }

    return stats;
  }

  /**
   * 估算剩余上传时间
   * @param uploadStats 上传统计信息
   * @param uploadSpeed 当前上传速度（字节/秒）
   * @param chunkSize 分片大小（字节）
   * @returns 估计剩余时间（秒）
   */
  public estimateRemainingTime(
    uploadStats: IUploadStats,
    uploadSpeed: number,
    chunkSize: number,
  ): number | undefined {
    // 如果没有速度数据或已完成，返回undefined
    if (!uploadSpeed || uploadSpeed <= 0 || uploadStats.progress >= 100) {
      return undefined;
    }

    // 计算剩余分片数
    const remainingChunks = uploadStats.total - uploadStats.uploaded;
    if (remainingChunks <= 0) {
      return 0;
    }

    // 计算剩余字节数（简化计算，假设所有分片大小相同）
    const remainingBytes = remainingChunks * chunkSize;

    // 计算剩余时间（秒）
    const remainingTimeSeconds = Math.ceil(remainingBytes / uploadSpeed);

    this.logDebug(
      `估计剩余时间: ${remainingTimeSeconds}秒 (速度: ${this.formatSpeed(uploadSpeed)})`,
    );

    return remainingTimeSeconds;
  }

  /**
   * 格式化上传速度为人类可读格式
   * @param bytesPerSecond 每秒字节数
   * @returns 格式化后的速度字符串
   */
  public formatSpeed(bytesPerSecond: number): string {
    if (bytesPerSecond >= 1024 * 1024) {
      return `${(bytesPerSecond / (1024 * 1024)).toFixed(2)} MB/s`;
    } else if (bytesPerSecond >= 1024) {
      return `${(bytesPerSecond / 1024).toFixed(2)} KB/s`;
    } else {
      return `${Math.round(bytesPerSecond)} B/s`;
    }
  }

  /**
   * 记录调试日志
   * @param message 日志消息
   * @param data 额外数据
   */
  private logDebug(message: string, data?: any): void {
    if (this.logger?.debug) {
      this.logger.debug(`[ProgressCalculator] ${message}`, data);
    }
  }
}
