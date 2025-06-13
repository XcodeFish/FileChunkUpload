/**
 * 分片进度跟踪模块
 * 负责处理上传进度更新和计算
 * @module chunk-strategy/chunk-progress-tracker
 */
import {
  IChunkProgressEvent,
  IEventEmitter,
  IFileInfo,
  IUploadProgress,
} from '@file-chunk-uploader/types';

import { ChunkUploadTask } from './chunk-task-manager';

/**
 * 扩展的上传进度接口
 * 包含额外的内部跟踪字段
 */
interface ExtendedUploadProgress extends IUploadProgress {
  /** 开始时间（毫秒时间戳） */
  startTime: number;
  /** 最后更新时间（毫秒时间戳） */
  lastUpdateTime: number;
}

/**
 * 进度跟踪器配置
 */
export interface ProgressTrackerConfig {
  /** 旧速度权重系数 (0-1) */
  oldSpeedWeight?: number;
  /** 新速度权重系数 (0-1) */
  newSpeedWeight?: number;
}

/**
 * 分片进度跟踪器类
 * 负责跟踪和计算分片上传进度
 */
export class ChunkProgressTracker {
  /** 旧速度权重系数 */
  private oldSpeedWeight: number;
  /** 新速度权重系数 */
  private newSpeedWeight: number;

  /**
   * 构造函数
   * @param eventEmitter 事件发射器
   * @param config 进度跟踪器配置
   */
  constructor(
    private readonly eventEmitter?: IEventEmitter,
    config: ProgressTrackerConfig = {},
  ) {
    // 设置默认权重或使用配置的权重
    this.oldSpeedWeight = config.oldSpeedWeight !== undefined ? config.oldSpeedWeight : 0.7;
    this.newSpeedWeight = config.newSpeedWeight !== undefined ? config.newSpeedWeight : 0.3;

    // 确保权重之和为1
    const sum = this.oldSpeedWeight + this.newSpeedWeight;
    if (sum !== 0) {
      this.oldSpeedWeight /= sum;
      this.newSpeedWeight /= sum;
    } else {
      // 如果两个权重都为0，使用默认值
      this.oldSpeedWeight = 0.7;
      this.newSpeedWeight = 0.3;
    }
  }

  /**
   * 更新任务进度
   * @param task 上传任务
   * @returns 更新后的进度信息
   */
  public updateTaskProgress(task: ChunkUploadTask): IUploadProgress {
    const now = Date.now();
    const uploadedChunks = task.uploadedChunks.size;
    const totalChunks = task.chunks.length;

    // 计算已加载的字节数 (基于已完成分片数量的比例估算)
    const totalSize = task.file.size;
    const loaded = Math.floor((uploadedChunks / totalChunks) * totalSize);

    // 计算时间和速度
    const lastLoaded = task.progress.loaded;
    const extendedProgress = task.progress as ExtendedUploadProgress;
    const timeDelta = now - (extendedProgress.lastUpdateTime || now - 1000);
    let speed = task.progress.speed || 0;

    // 只有当有真实的进度变化且时间间隔合理时才更新速度
    if (loaded > lastLoaded && timeDelta > 0) {
      const loadedDelta = loaded - lastLoaded;
      // 使用滑动平均来平滑速度变化，使用可配置的权重
      const newSpeed = loadedDelta / (timeDelta / 1000); // bytes/s
      speed =
        speed > 0
          ? this.oldSpeedWeight * speed + this.newSpeedWeight * newSpeed // 使用配置的权重系数
          : newSpeed;
    }

    // 计算剩余时间（毫秒）
    let timeRemaining = 0;
    if (speed > 0 && loaded < totalSize) {
      const remaining = totalSize - loaded;
      timeRemaining = Math.floor((remaining / speed) * 1000);
    }

    // 计算已用时间
    const startTime = extendedProgress.startTime || now;
    const timeElapsed = now - startTime;

    // 更新进度对象
    const progress: IUploadProgress = {
      loaded,
      total: totalSize,
      percent: Math.min(Math.floor((loaded / totalSize) * 100), 99), // 最多显示99%，合并完成后才是100%
      speed,
      timeElapsed,
      timeRemaining,
    };

    // 更新任务进度，保留扩展字段
    task.progress = {
      ...progress,
      startTime: extendedProgress.startTime || now,
      lastUpdateTime: now,
    } as ExtendedUploadProgress;

    return progress;
  }

  /**
   * 设置速度计算权重
   * @param oldWeight 旧速度权重 (0-1)
   * @param newWeight 新速度权重 (0-1)
   */
  public setSpeedWeights(oldWeight: number, newWeight: number): void {
    if (oldWeight < 0 || newWeight < 0) {
      throw new Error('权重系数不能为负数');
    }

    const sum = oldWeight + newWeight;
    if (sum === 0) {
      throw new Error('权重系数之和不能为0');
    }

    // 归一化权重
    this.oldSpeedWeight = oldWeight / sum;
    this.newSpeedWeight = newWeight / sum;
  }

  /**
   * 发布分片进度事件
   * @param task 上传任务
   * @param chunkIndex 分片索引，-1表示整体进度
   */
  public emitProgressEvent(task: ChunkUploadTask, chunkIndex: number = -1): void {
    if (!this.eventEmitter) return;

    // 创建文件信息
    const fileInfo: IFileInfo = {
      id: task.fileId,
      name: task.file.name,
      size: task.file.size,
      type: task.file.type,
      lastModified: task.file.lastModified,
    };

    // 创建事件数据
    const eventData: IChunkProgressEvent = {
      file: fileInfo,
      chunkIndex,
      progress: { ...task.progress },
    };

    // 发出分片进度事件
    this.eventEmitter.emit('chunk:progress', eventData);

    // 同时发出整体上传进度事件
    if (chunkIndex === -1) {
      this.eventEmitter.emit('upload:progress', task.progress.percent);
    }
  }

  /**
   * 标记上传完成（100%）
   * @param task 上传任务
   */
  public markAsCompleted(task: ChunkUploadTask): void {
    // 标记为100%完成
    task.progress.loaded = task.progress.total;
    task.progress.percent = 100;
    task.progress.timeRemaining = 0;

    // 发出进度更新事件
    this.emitProgressEvent(task);
  }

  /**
   * 获取合并的总体进度
   * @param tasks 上传任务列表
   * @returns 总体进度信息
   */
  public getOverallProgress(tasks: ChunkUploadTask[]): IUploadProgress {
    if (tasks.length === 0) {
      return {
        loaded: 0,
        total: 0,
        percent: 0,
        speed: 0,
        timeElapsed: 0,
        timeRemaining: 0,
      };
    }

    // 汇总所有任务的进度
    let totalLoaded = 0;
    let totalSize = 0;
    let totalSpeed = 0;
    let maxTimeRemaining = 0;
    let earliestStartTime = Number.MAX_SAFE_INTEGER;

    tasks.forEach(task => {
      totalLoaded += task.progress.loaded;
      totalSize += task.progress.total;
      totalSpeed += task.progress.speed || 0;

      // 找出最长的剩余时间
      if ((task.progress.timeRemaining || 0) > maxTimeRemaining) {
        maxTimeRemaining = task.progress.timeRemaining || 0;
      }

      // 找出最早的开始时间
      const extendedProgress = task.progress as ExtendedUploadProgress;
      const startTime = extendedProgress.startTime || Date.now();
      if (startTime < earliestStartTime) {
        earliestStartTime = startTime;
      }
    });

    // 计算总体百分比和已用时间
    const percent = totalSize > 0 ? Math.floor((totalLoaded / totalSize) * 100) : 0;
    const timeElapsed = Date.now() - earliestStartTime;

    return {
      loaded: totalLoaded,
      total: totalSize,
      percent,
      speed: totalSpeed,
      timeElapsed,
      timeRemaining: maxTimeRemaining,
    };
  }

  /**
   * 格式化上传速度为可读字符串
   * @param bytesPerSecond 每秒字节数
   * @returns 格式化的速度字符串（如 "1.5 MB/s"）
   */
  public formatSpeed(bytesPerSecond: number): string {
    if (bytesPerSecond < 1024) {
      return `${bytesPerSecond.toFixed(0)} B/s`;
    } else if (bytesPerSecond < 1024 * 1024) {
      return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
    } else {
      return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
    }
  }

  /**
   * 格式化时间为可读字符串
   * @param milliseconds 毫秒数
   * @returns 格式化的时间字符串（如 "1h 30m 45s"）
   */
  public formatTime(milliseconds: number): string {
    if (milliseconds <= 0) {
      return '0s';
    }

    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    const s = seconds % 60;
    const m = minutes % 60;

    if (hours > 0) {
      return `${hours}h ${m}m ${s}s`;
    } else if (m > 0) {
      return `${m}m ${s}s`;
    } else {
      return `${s}s`;
    }
  }
}
