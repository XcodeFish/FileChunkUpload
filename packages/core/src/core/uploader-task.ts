/**
 * 上传任务类
 * 负责管理单个上传任务的生命周期和状态
 */
import {
  IFileInfo,
  IUploadConfig,
  IUploadTask,
  IUploadProgress,
  IUploadResult,
  IEventEmitter,
  EventName,
  UploadStatus,
} from '@file-chunk-uploader/types';
import { calculateSpeed } from '@file-chunk-uploader/utils';

import { Logger } from '../developer-mode';

/**
 * 上传任务类
 */
export class UploaderTask {
  /** 文件信息 */
  private fileInfo: IFileInfo;

  /** 原始文件 */
  private file: File | Blob;

  /** 上传配置 */
  private config: IUploadConfig;

  /** 事件发射器 */
  private eventEmitter: IEventEmitter;

  /** 上传策略映射 */
  private strategies: Map<string, any>;

  /** 日志记录器 */
  private logger?: Logger;

  /** 上传状态 */
  private status: UploadStatus = UploadStatus.PENDING;

  /** 上传进度信息 */
  private progress: IUploadProgress = {
    loaded: 0,
    total: 0,
    percent: 0,
    speed: 0,
    timeElapsed: 0,
    timeRemaining: 0,
  };

  /** 上传结果 */
  private result?: IUploadResult;

  /** 上传错误 */
  private error?: Error;

  /** 创建时间 */
  private createdAt: number = Date.now();

  /** 开始时间 */
  private startedAt: number = 0;

  /** 完成时间 */
  private completedAt: number = 0;

  /** 上次进度更新时间 */
  private lastProgressTime: number = 0;

  /** 已上传的字节数 */
  private uploadedBytes: number = 0;

  /** 上传速度数据点 */
  private speedPoints: { time: number; bytes: number }[] = [];

  /**
   * 创建上传任务
   * @param fileInfo 文件信息
   * @param file 原始文件
   * @param config 上传配置
   * @param eventEmitter 事件发射器
   * @param strategies 上传策略映射
   * @param logger 日志记录器
   */
  constructor(
    fileInfo: IFileInfo,
    file: File | Blob,
    config: IUploadConfig,
    eventEmitter: IEventEmitter,
    strategies: Map<string, any>,
    logger?: Logger,
  ) {
    this.fileInfo = fileInfo;
    this.file = file;
    this.config = config;
    this.eventEmitter = eventEmitter;
    this.strategies = strategies;
    this.logger = logger;
    this.progress.total = file.size;
  }

  /**
   * 开始上传
   * @returns 上传结果Promise
   */
  public async start(): Promise<IUploadResult> {
    try {
      // 设置为上传中状态
      this.status = UploadStatus.UPLOADING;
      this.startedAt = Date.now();
      this.lastProgressTime = this.startedAt;

      // 触发上传开始事件
      this.eventEmitter.emit(EventName.UPLOAD_START, {
        file: this.fileInfo,
        startTime: this.startedAt,
      });

      // 记录日志
      this.logger?.info('core', `开始上传文件: ${this.fileInfo.name}`, {
        fileId: this.fileInfo.id,
        fileSize: this.fileInfo.size,
        fileType: this.fileInfo.type,
      });

      // 检查是否有适当的策略
      let result: IUploadResult;

      // 策略选择逻辑，后面可扩展为更智能的选择
      const defaultStrategy = this.strategies.get('default');
      const chunkStrategy = this.strategies.get('chunk');
      const resumeStrategy = this.strategies.get('resume');

      if (this.config.resumable && resumeStrategy) {
        // 使用断点续传策略
        this.logger?.debug('core', `使用断点续传策略上传文件: ${this.fileInfo.name}`);
        result = await resumeStrategy.process(this.file, this.config);
      } else if (this.file.size > 0 && chunkStrategy) {
        // 使用分片上传策略
        this.logger?.debug('core', `使用分片策略上传文件: ${this.fileInfo.name}`);
        result = await chunkStrategy.process(this.file, this.config);
      } else if (defaultStrategy) {
        // 使用默认策略
        this.logger?.debug('core', `使用默认策略上传文件: ${this.fileInfo.name}`);
        result = await defaultStrategy.process(this.file, this.config);
      } else {
        // 无可用策略，模拟上传
        this.logger?.warn('core', `未配置上传策略，执行模拟上传: ${this.fileInfo.name}`);
        result = await this.simulateUpload();
      }

      // 更新状态和结果
      this.completedAt = Date.now();
      this.status = UploadStatus.COMPLETED;
      this.result = result;
      this.updateProgress(this.fileInfo.size, this.fileInfo.size);

      return result;
    } catch (error) {
      // 更新状态和错误
      this.status = UploadStatus.FAILED;
      this.completedAt = Date.now();

      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.error = errorObj;

      // 记录日志
      this.logger?.error('core', `上传失败: ${this.fileInfo.name}`, {
        fileId: this.fileInfo.id,
        error: errorObj,
      });

      throw errorObj;
    }
  }

  /**
   * 暂停上传
   */
  public pause(): void {
    if (this.status === UploadStatus.UPLOADING) {
      this.status = UploadStatus.PAUSED;
      this.logger?.info('core', `暂停上传: ${this.fileInfo.name}`);

      // 如果有使用的策略，也调用策略的暂停方法
      const strategy = this.getActiveStrategy();
      if (strategy && typeof strategy.pause === 'function') {
        strategy.pause(this.fileInfo.id);
      }
    }
  }

  /**
   * 恢复上传
   */
  public resume(): void {
    if (this.status === UploadStatus.PAUSED) {
      this.status = UploadStatus.UPLOADING;
      this.lastProgressTime = Date.now();
      this.logger?.info('core', `恢复上传: ${this.fileInfo.name}`);

      // 如果有使用的策略，也调用策略的恢复方法
      const strategy = this.getActiveStrategy();
      if (strategy && typeof strategy.resume === 'function') {
        strategy.resume(this.fileInfo.id);
      }
    }
  }

  /**
   * 取消上传
   */
  public cancel(): void {
    if ([UploadStatus.UPLOADING, UploadStatus.PAUSED, UploadStatus.PENDING].includes(this.status)) {
      this.status = UploadStatus.CANCELED;
      this.completedAt = Date.now();
      this.logger?.info('core', `取消上传: ${this.fileInfo.name}`);

      // 如果有使用的策略，也调用策略的取消方法
      const strategy = this.getActiveStrategy();
      if (strategy && typeof strategy.cancel === 'function') {
        strategy.cancel(this.fileInfo.id);
      }
    }
  }

  /**
   * 更新上传进度
   * @param loaded 已上传的字节数
   * @param total 总字节数
   */
  public updateProgress(loaded: number, total: number): void {
    const now = Date.now();
    const elapsed = now - this.startedAt;

    // 记录速度样本点
    this.speedPoints.push({ time: now, bytes: loaded });

    // 保留最近的10个样本点用于计算速度
    if (this.speedPoints.length > 10) {
      this.speedPoints.shift();
    }

    // 计算上传速度
    const speed = calculateSpeed(this.speedPoints);

    // 计算剩余时间
    const remaining = speed > 0 ? Math.floor((total - loaded) / speed) * 1000 : 0;

    // 更新进度信息
    this.uploadedBytes = loaded;
    this.progress = {
      loaded,
      total,
      percent: Math.floor((loaded / total) * 100),
      speed,
      timeElapsed: elapsed,
      timeRemaining: remaining,
    };

    // 触发进度事件
    this.eventEmitter.emit(`${EventName.UPLOAD_PROGRESS}:${this.fileInfo.id}`, {
      file: this.fileInfo,
      progress: this.progress,
    });

    // 全局进度事件
    this.eventEmitter.emit(EventName.UPLOAD_PROGRESS, {
      file: this.fileInfo,
      progress: this.progress,
    });

    // 回调函数通知
    if (this.config.onProgress) {
      this.config.onProgress(this.progress.percent);
    }

    // 更新时间
    this.lastProgressTime = now;
  }

  /**
   * 获取文件信息
   * @returns 文件信息
   */
  public getFileInfo(): IFileInfo {
    return { ...this.fileInfo };
  }

  /**
   * 获取上传状态
   * @returns 上传状态
   */
  public getStatus(): UploadStatus {
    return this.status;
  }

  /**
   * 获取上传进度
   * @returns 上传进度
   */
  public getProgress(): IUploadProgress {
    return { ...this.progress };
  }

  /**
   * 获取上传结果
   * @returns 上传结果
   */
  public getResult(): IUploadResult | undefined {
    return this.result;
  }

  /**
   * 获取上传错误
   * @returns 上传错误
   */
  public getError(): Error | undefined {
    return this.error;
  }

  /**
   * 获取已用时间
   * @returns 已用时间（毫秒）
   */
  public getTimeElapsed(): number {
    if (this.completedAt > 0) {
      return this.completedAt - this.startedAt;
    }
    return Date.now() - this.startedAt;
  }

  /**
   * 获取任务信息
   * @returns 任务信息
   */
  public getTaskInfo(): IUploadTask {
    return {
      id: this.fileInfo.id,
      file: { ...this.fileInfo },
      status: this.status,
      progress: { ...this.progress },
      createdAt: this.createdAt,
      startedAt: this.startedAt || undefined,
      completedAt: this.completedAt || undefined,
      result: this.result,
      options: {},
    };
  }

  /**
   * 获取当前使用的上传策略
   * @returns 上传策略
   */
  private getActiveStrategy(): any {
    // 根据当前配置获取适当的策略
    if (this.config.resumable) {
      return this.strategies.get('resume');
    } else if (this.fileInfo.size > 0 && this.strategies.has('chunk')) {
      return this.strategies.get('chunk');
    } else {
      return this.strategies.get('default');
    }
  }

  /**
   * 模拟上传（当没有可用策略时使用）
   * @returns 模拟的上传结果
   */
  private simulateUpload(): Promise<IUploadResult> {
    return new Promise((resolve, reject) => {
      let loaded = 0;
      const total = this.fileInfo.size;
      const chunkSize = Math.max(1024 * 1024, Math.floor(total / 20)); // 每次上传大约5%

      const uploadInterval = setInterval(() => {
        // 检查是否已取消或暂停
        if (this.status === UploadStatus.CANCELED) {
          clearInterval(uploadInterval);
          reject(new Error('上传已取消'));
          return;
        }

        if (this.status === UploadStatus.PAUSED) {
          // 暂停状态，不更新进度
          return;
        }

        // 更新上传进度
        loaded += chunkSize;
        if (loaded > total) {
          loaded = total;
        }

        this.updateProgress(loaded, total);

        // 上传完成
        if (loaded >= total) {
          clearInterval(uploadInterval);

          // 模拟上传结果
          const result: IUploadResult = {
            success: true,
            file: this.fileInfo,
            data: {
              url: `https://example.com/uploads/${this.fileInfo.name}`,
              uploadTime: Date.now(),
            },
            url: `https://example.com/uploads/${this.fileInfo.name}`,
          };

          resolve(result);
        }
      }, 500); // 每500毫秒更新一次
    });
  }
}
