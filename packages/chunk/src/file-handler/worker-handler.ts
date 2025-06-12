/**
 * Worker文件处理器
 * 使用Web Worker处理文件切片，提高性能
 */
import { generateFileId } from '@file-chunk-uploader/core';
import {
  IChunkMeta,
  IFileChunkResult,
  IFileHandler,
  IFileHandlerOptions,
  IFileInfo,
  ILogger,
} from '@file-chunk-uploader/types';

import { FileHandler } from './file-handler';

/**
 * Worker文件处理配置扩展
 */
export interface IWorkerFileHandlerOptions extends IFileHandlerOptions {
  /** Worker脚本路径 */
  workerPath?: string;
  /** 最大Worker数量 */
  maxWorkers?: number;
  /** Worker超时时间（毫秒） */
  workerTimeout?: number;
  /** 大文件阈值（字节），超过此大小的文件将分块处理 */
  largeFileThreshold?: number;
  /** 进度报告间隔（毫秒） */
  progressReportInterval?: number;
}

/**
 * 默认Worker选项
 */
const DEFAULT_WORKER_OPTIONS: Partial<IWorkerFileHandlerOptions> = {
  workerPath: './file-worker.js',
  maxWorkers: navigator?.hardwareConcurrency || 4,
  workerTimeout: 30000, // 30秒超时
  largeFileThreshold: 50 * 1024 * 1024, // 50MB
  progressReportInterval: 100, // 100毫秒报告一次进度
};

/**
 * Worker池状态
 */
interface WorkerPoolStatus {
  /** 已创建Worker数量 */
  created: number;
  /** 正在使用的Worker数量 */
  busy: number;
  /** 空闲Worker数量 */
  idle: number;
  /** Worker池是否已满 */
  isFull: boolean;
}

/**
 * Worker任务接口
 */
interface WorkerTask {
  /** 文件对象 */
  file: File | Blob;
  /** 文件元信息（如果是Blob需要） */
  fileInfo?: IFileInfo;
  /** 选项 */
  options: IFileHandlerOptions;
  /** 解析函数 */
  resolve: (result: IFileChunkResult) => void;
  /** 拒绝函数 */
  reject: (error: Error) => void;
  /** 任务ID */
  id: string;
  /** 创建时间 */
  createdAt: number;
}

/**
 * Worker文件处理器
 * 当浏览器支持Web Worker时，使用Worker进行文件分片处理
 * 提高性能并避免阻塞主线程
 */
export class WorkerFileHandler implements IFileHandler {
  private fileHandler: FileHandler;
  private options: IWorkerFileHandlerOptions;
  private logger?: ILogger;
  private workers: Worker[] = [];
  private workerSupported: boolean;
  private taskQueue: WorkerTask[] = [];
  private busyWorkers: Map<Worker, WorkerTask> = new Map();
  private isTerminating: boolean = false;
  private memoryUsage: number = 0;
  private memoryLimit: number =
    typeof performance !== 'undefined' && 'memory' in performance
      ? (performance as any).memory?.jsHeapSizeLimit * 0.8 // 使用80%的堆内存上限
      : 1024 * 1024 * 1024; // 默认1GB

  /**
   * 创建Worker文件处理器实例
   * @param options 文件处理选项
   */
  constructor(options: Partial<IWorkerFileHandlerOptions> = {}) {
    // 合并默认Worker选项
    const workerOptions = { ...DEFAULT_WORKER_OPTIONS, ...options };

    this.fileHandler = new FileHandler(options);
    this.options = { ...this.fileHandler['options'], ...workerOptions };
    this.logger = options.logger;
    this.workerSupported = typeof Worker !== 'undefined';

    if (options.useWorker && this.workerSupported) {
      this.initWorkerPool();
    }

    if (this.options.devMode && this.logger) {
      this.logger.info('chunk', 'WorkerFileHandler初始化', {
        workerSupported: this.workerSupported,
        useWorker: options.useWorker,
        maxWorkers: this.options.maxWorkers,
        memoryLimit: `${(this.memoryLimit / (1024 * 1024)).toFixed(2)}MB`,
      });
    }
  }

  /**
   * 初始化Worker池
   */
  private initWorkerPool(): void {
    // 初始创建一个Worker，其他Worker按需创建
    if (this.options.maxWorkers && this.options.maxWorkers > 0) {
      this.createWorker();
    }
  }

  /**
   * 向Worker发送配置
   * @param worker Worker对象
   */
  private sendConfigToWorker(worker: Worker): void {
    // 构建worker配置
    const workerConfig = {
      progressInterval: this.options.progressReportInterval || 100, // 进度报告间隔
      streamProcessing: true, // 启用流式处理
      streamBlockSize: 5 * 1024 * 1024, // 5MB的处理块
    };

    // 发送配置到Worker
    worker.postMessage({
      type: 'config',
      config: workerConfig,
    });

    if (this.options.devMode && this.logger) {
      this.logger.debug('chunk', '发送配置到Worker', { workerConfig });
    }
  }

  /**
   * 创建新的Worker
   * @returns 新创建的Worker或null（如果创建失败）
   */
  private createWorker(): Worker | null {
    try {
      if (this.getPoolStatus().created >= (this.options.maxWorkers || 1)) {
        return null; // 已达到最大Worker数量
      }

      // 创建Worker
      const worker = new Worker(this.getWorkerPath());

      // 设置通用错误处理
      worker.addEventListener('error', this.handleWorkerError.bind(this, worker));

      // 监听Worker消息
      worker.addEventListener('message', this.handleWorkerMessage.bind(this, worker));

      // 发送配置到Worker
      this.sendConfigToWorker(worker);

      // 添加到Worker池
      this.workers.push(worker);

      if (this.options.devMode && this.logger) {
        this.logger.info('chunk', 'Worker创建成功', {
          workerId: this.workers.indexOf(worker),
          totalWorkers: this.workers.length,
        });
      }

      return worker;
    } catch (error) {
      if (this.options.devMode && this.logger) {
        this.logger.warn('chunk', 'Worker创建失败', { error });
      }
      return null;
    }
  }

  /**
   * 获取Worker脚本路径
   * @returns Worker脚本路径
   */
  private getWorkerPath(): string {
    return this.options.workerPath || './file-worker.js';
  }

  /**
   * 获取Worker池状态
   * @returns Worker池状态对象
   */
  private getPoolStatus(): WorkerPoolStatus {
    const created = this.workers.length;
    const busy = this.busyWorkers.size;
    const idle = created - busy;
    const isFull = created >= (this.options.maxWorkers || 1);

    return {
      created,
      busy,
      idle,
      isFull,
    };
  }

  /**
   * 获取空闲的Worker
   * @returns 空闲的Worker或null
   */
  private getIdleWorker(): Worker | null {
    const idleWorker = this.workers.find(worker => !this.busyWorkers.has(worker));
    if (idleWorker) return idleWorker;

    // 如果没有空闲Worker且未达到上限，创建新Worker
    if (!this.getPoolStatus().isFull) {
      return this.createWorker();
    }

    return null;
  }

  /**
   * 处理Worker错误
   * @param worker Worker对象
   * @param event 错误事件
   */
  private handleWorkerError(worker: Worker, event: ErrorEvent): void {
    const task = this.busyWorkers.get(worker);

    if (this.options.devMode && this.logger) {
      this.logger.error('chunk', 'Worker错误', {
        error: event.error || event.message,
        file: task?.file instanceof File ? task?.file.name : 'blob',
      });
    }

    // 如果有关联任务，拒绝Promise
    if (task) {
      task.reject(new Error(`Worker错误: ${event.message}`));
      this.busyWorkers.delete(worker);

      // 尝试处理队列中的下一个任务
      this.processTaskQueue();
    }

    // 终止并移除出错的Worker
    this.terminateWorker(worker);
  }

  /**
   * 处理Worker消息
   * @param worker Worker对象
   * @param event 消息事件
   */
  private handleWorkerMessage(worker: Worker, event: MessageEvent): void {
    const { type, error, chunks, count, chunkInfos, id } = event.data;
    const task = this.busyWorkers.get(worker);

    if (!task && type !== 'ready') {
      // 忽略无关联任务的消息（除了ready消息）
      return;
    }

    if (error) {
      if (this.options.devMode && this.logger) {
        this.logger.error('chunk', `Worker任务失败: ${error}`, {
          taskId: id,
          file: task?.file instanceof File ? task?.file.name : 'blob',
        });
      }

      if (task) {
        task.reject(new Error(`Worker任务失败: ${error}`));
        this.busyWorkers.delete(worker);
      }
    } else if (type === 'chunk' && task) {
      // 处理分片结果
      const fileInfo =
        task.fileInfo ||
        (task.file instanceof File
          ? {
              id: generateFileId(task.file),
              name: task.file.name,
              size: task.file.size,
              type: task.file.type,
              lastModified: task.file.lastModified,
            }
          : {
              id: `blob-${id}`,
              name: `blob-${id}`,
              size: task.file.size,
              type: task.file.type || 'application/octet-stream',
              lastModified: Date.now(),
            });
      const result: IFileChunkResult = {
        chunks,
        count,
        chunkSize: this.options.chunkSize,
        file: fileInfo,
        chunkInfos,
      };

      if (this.options.devMode && this.logger) {
        this.logger.info('chunk', `Worker任务完成: ${fileInfo.name}`, {
          taskId: id,
          chunkCount: count,
        });
      }

      task.resolve(result);
      this.busyWorkers.delete(worker);
    }

    // 处理队列中的下一个任务
    this.processTaskQueue();
  }

  /**
   * 分配任务给Worker
   * @param worker Worker对象
   * @param task 任务对象
   */
  private assignTaskToWorker(worker: Worker, task: WorkerTask): void {
    this.busyWorkers.set(worker, task);

    // 更新内存使用估计
    this.updateMemoryUsage(task.file.size);

    // 设置任务超时
    const timeoutId = setTimeout(() => {
      if (this.busyWorkers.has(worker)) {
        if (this.options.devMode && this.logger) {
          this.logger.warn(
            'chunk',
            `Worker任务超时: ${task.file instanceof File ? task.file.name : 'blob'}`,
            {
              taskId: task.id,
              timeout: this.options.workerTimeout,
            },
          );
        }

        task.reject(new Error('Worker任务处理超时'));
        this.busyWorkers.delete(worker);
        this.terminateWorker(worker); // 终止超时的Worker并创建新Worker
        this.createWorker(); // 创建新Worker替代超时的Worker

        // 处理队列中的任务
        this.processTaskQueue();
      }
    }, this.options.workerTimeout);

    // 发送任务到Worker
    worker.postMessage({
      type: 'chunk',
      id: task.id,
      file: task.file,
      chunkSize: task.options.chunkSize,
      indexBase: task.options.indexBase || 0,
    });

    if (this.options.devMode && this.logger) {
      this.logger.debug(
        'chunk',
        `分配任务给Worker: ${task.file instanceof File ? task.file.name : 'blob'}`,
        {
          taskId: task.id,
          workerId: this.workers.indexOf(worker),
          fileSize: task.file.size,
        },
      );
    }

    // 清除超时定时器（在messageHandler或errorHandler中）
    const originalTask = this.busyWorkers.get(worker);
    if (originalTask === task) {
      (worker as any)._timeoutId = timeoutId;
    }
  }

  /**
   * 处理任务队列
   */
  private processTaskQueue(): void {
    // 如果队列为空或者正在终止，不处理
    if (this.taskQueue.length === 0 || this.isTerminating) return;

    // 尝试获取空闲Worker
    const idleWorker = this.getIdleWorker();
    if (!idleWorker) return;

    // 从队列获取下一个任务
    const task = this.taskQueue.shift();
    if (!task) return;

    // 分配任务给Worker
    this.assignTaskToWorker(idleWorker, task);
  }

  /**
   * 终止指定Worker
   * @param worker Worker对象
   */
  private terminateWorker(worker: Worker): void {
    // 清除超时定时器
    const timeoutId = (worker as any)._timeoutId;
    if (timeoutId) {
      clearTimeout(timeoutId);
      delete (worker as any)._timeoutId;
    }

    // 从Worker列表中移除
    const index = this.workers.indexOf(worker);
    if (index !== -1) {
      this.workers.splice(index, 1);
    }

    // 移除事件监听器
    worker.removeEventListener('error', this.handleWorkerError.bind(this, worker));
    worker.removeEventListener('message', this.handleWorkerMessage.bind(this, worker));

    try {
      // 终止Worker
      worker.terminate();

      if (this.options.devMode && this.logger) {
        this.logger.debug('chunk', 'Worker已终止', {
          workerId: index,
          remainingWorkers: this.workers.length,
        });
      }
    } catch (error) {
      if (this.options.devMode && this.logger) {
        this.logger.warn('chunk', 'Worker终止失败', { error });
      }
    }
  }

  /**
   * 更新内存使用估计
   * @param fileSize 处理的文件大小
   */
  private updateMemoryUsage(fileSize: number): void {
    // 简单估计：文件大小 + 额外30%用于处理过程中的临时数据
    const estimatedSize = fileSize * 1.3;
    this.memoryUsage += estimatedSize;

    // 检查内存使用情况
    this.checkMemoryUsage();

    if (this.options.devMode && this.logger) {
      this.logger.debug('chunk', '更新内存使用估计', {
        added: `${(estimatedSize / (1024 * 1024)).toFixed(2)}MB`,
        total: `${(this.memoryUsage / (1024 * 1024)).toFixed(2)}MB`,
        limit: `${(this.memoryLimit / (1024 * 1024)).toFixed(2)}MB`,
      });
    }
  }

  /**
   * 释放内存使用
   * @param fileSize 处理完的文件大小
   */
  private releaseMemory(fileSize: number): void {
    const estimatedSize = fileSize * 1.3;
    this.memoryUsage = Math.max(0, this.memoryUsage - estimatedSize);

    if (this.options.devMode && this.logger) {
      this.logger.debug('chunk', '释放内存估计', {
        released: `${(estimatedSize / (1024 * 1024)).toFixed(2)}MB`,
        remaining: `${(this.memoryUsage / (1024 * 1024)).toFixed(2)}MB`,
      });
    }
  }

  /**
   * 检查内存使用情况
   */
  private checkMemoryUsage(): void {
    // 如果内存使用超过限制，则执行垃圾回收
    if (this.memoryUsage > this.memoryLimit) {
      if (this.options.devMode && this.logger) {
        this.logger.warn('chunk', '内存使用超过限制，尝试垃圾回收', {
          usage: `${(this.memoryUsage / (1024 * 1024)).toFixed(2)}MB`,
          limit: `${(this.memoryLimit / (1024 * 1024)).toFixed(2)}MB`,
        });
      }

      // 尝试执行垃圾回收 (在支持的环境中)
      if (typeof global !== 'undefined' && global.gc) {
        try {
          global.gc();
          if (this.options.devMode && this.logger) {
            this.logger.info('chunk', '手动触发垃圾回收完成');
          }
        } catch (error) {
          if (this.options.devMode && this.logger) {
            this.logger.warn('chunk', '手动垃圾回收失败', { error });
          }
        }
      }
    }
  }

  /**
   * 通过Worker创建文件分片
   * 如果Worker不可用，回退到主线程处理
   * @param file 要处理的文件
   * @param overrideOptions 覆盖默认选项
   * @returns 文件分块结果
   */
  public async createChunks(
    file: File,
    overrideOptions?: Partial<IFileHandlerOptions>,
  ): Promise<IFileChunkResult> {
    const startTime = performance.now();
    const options = overrideOptions ? { ...this.options, ...overrideOptions } : this.options;

    // 如果不使用Worker或Worker不可用，使用主线程处理
    if (!options.useWorker || !this.workerSupported || this.workers.length === 0) {
      if (this.options.devMode && this.logger) {
        this.logger.debug('chunk', '使用主线程处理文件分片');
      }
      return this.fileHandler.createChunks(file, overrideOptions);
    }

    // 获取大文件阈值
    const largeFileThreshold =
      (this.options as IWorkerFileHandlerOptions).largeFileThreshold || 50 * 1024 * 1024;

    // 大文件分块处理（超过配置的阈值）
    if (file.size > largeFileThreshold && typeof file.slice === 'function') {
      if (this.options.devMode && this.logger) {
        this.logger.info('chunk', `大文件检测，启用分块处理: ${file.name}`, {
          fileSize: `${(file.size / (1024 * 1024)).toFixed(2)}MB`,
          threshold: `${(largeFileThreshold / (1024 * 1024)).toFixed(2)}MB`,
        });
      }
      return this.processLargeFile(file, options);
    }

    // 使用Worker处理文件分片
    try {
      if (this.options.devMode && this.logger) {
        this.logger.debug('chunk', `使用Worker处理文件: ${file.name}`, {
          fileSize: file.size,
          poolStatus: this.getPoolStatus(),
        });
      }

      const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      // 创建任务Promise
      const result = await new Promise<IFileChunkResult>((resolve, reject) => {
        // 创建任务
        const task: WorkerTask = {
          file,
          options,
          resolve,
          reject,
          id: taskId,
          createdAt: Date.now(),
        };

        // 尝试获取空闲Worker
        const idleWorker = this.getIdleWorker();

        if (idleWorker) {
          // 有空闲Worker，直接分配任务
          this.assignTaskToWorker(idleWorker, task);
        } else {
          // 没有空闲Worker，将任务加入队列
          this.taskQueue.push(task);

          if (this.options.devMode && this.logger) {
            this.logger.debug('chunk', `任务加入队列: ${file.name}`, {
              taskId,
              queueLength: this.taskQueue.length,
            });
          }
        }
      });

      // 计算处理时间
      const endTime = performance.now();
      const processingTime = endTime - startTime;

      // 日志记录
      if (options.devMode && this.logger) {
        this.logger.info('chunk', `Worker文件处理完成: ${file.name}`, {
          chunkCount: result.count,
          chunkSize: result.chunkSize,
          processingTime: `${processingTime.toFixed(2)}ms`,
        });
      }

      // 处理完成，释放内存使用估计
      this.releaseMemory(file.size);

      return result;
    } catch (error) {
      // Worker处理失败，回退到主线程处理
      if (this.options.devMode && this.logger) {
        this.logger.warn('chunk', `Worker处理失败，回退到主线程: ${(error as Error).message}`);
      }

      return this.fileHandler.createChunks(file, overrideOptions);
    }
  }

  /**
   * 处理大文件
   * 将大文件分成多个块进行处理，避免一次加载整个文件到内存
   * @param file 文件对象
   * @param options 处理选项
   * @returns 文件分块结果
   */
  private async processLargeFile(
    file: File,
    options: IFileHandlerOptions,
  ): Promise<IFileChunkResult> {
    // 每块50MB
    const blockSize = 50 * 1024 * 1024;
    const totalBlocks = Math.ceil(file.size / blockSize);

    // 计算最终分片大小
    const chunkSize = options.optimizeChunking
      ? this.fileHandler.getOptimalChunkSize(file)
      : options.chunkSize;

    // 总分片数
    const totalChunks = this.fileHandler.getChunkCount(file.size, chunkSize);

    if (this.options.devMode && this.logger) {
      this.logger.debug('chunk', `大文件分块处理计划: ${file.name}`, {
        totalBlocks,
        blockSize: `${(blockSize / (1024 * 1024)).toFixed(2)}MB`,
        chunkSize: `${(chunkSize / (1024 * 1024)).toFixed(2)}MB`,
        totalChunks,
      });
    }

    // 创建文件信息（用于所有块）
    const fileInfo: IFileInfo = {
      id: generateFileId(file),
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
    };

    // 所有分片
    const chunks: Blob[] = new Array(totalChunks);
    const chunkInfos: IChunkMeta[] = new Array(totalChunks);

    // 分块处理
    for (let blockIndex = 0; blockIndex < totalBlocks; blockIndex++) {
      const blockStart = blockIndex * blockSize;
      const blockEnd = Math.min(blockStart + blockSize, file.size);
      const blockFile = file.slice(blockStart, blockEnd);

      if (this.options.devMode && this.logger) {
        this.logger.debug('chunk', `处理文件块 ${blockIndex + 1}/${totalBlocks}: ${file.name}`, {
          blockStart,
          blockEnd,
          blockSize: blockEnd - blockStart,
        });
      }

      // 计算此块内的起始分片索引
      const startChunkIndex = Math.floor(blockStart / chunkSize);

      // 处理当前块
      const blockOptions = {
        ...options,
        // 强制使用计算好的分片大小，避免优化算法为每个块计算不同大小
        chunkSize,
        optimizeChunking: false,
      };

      // 使用Worker或主线程处理此块
      let blockResult: IFileChunkResult;
      try {
        // 尝试使用Worker处理
        const idleWorker = this.getIdleWorker();
        if (idleWorker) {
          blockResult = await this.processBlockWithWorker(
            blockFile,
            blockOptions,
            idleWorker,
            fileInfo,
          );
        } else {
          // 没有可用Worker，使用主线程
          blockResult = await this.fileHandler.createChunks(
            file.slice(blockStart, blockEnd) as File,
            blockOptions,
          );
        }
      } catch (error) {
        // 出错时使用主线程
        if (this.options.devMode && this.logger) {
          this.logger.warn('chunk', `块处理错误，使用主线程: ${(error as Error).message}`);
        }
        const tempFile = new File([blockFile], file.name, {
          type: file.type,
          lastModified: file.lastModified,
        });
        blockResult = await this.fileHandler.createChunks(tempFile, blockOptions);
      }

      // 将此块的分片合并到结果中
      for (let i = 0; i < blockResult.chunks.length; i++) {
        const globalChunkIndex = startChunkIndex + i;
        if (globalChunkIndex < totalChunks) {
          chunks[globalChunkIndex] = blockResult.chunks[i];

          // 计算全局位置
          const chunkInfo = blockResult.chunkInfos[i];
          chunkInfos[globalChunkIndex] = {
            ...chunkInfo,
            start: blockStart + chunkInfo.start,
            end: blockStart + chunkInfo.end,
            isLast: globalChunkIndex === totalChunks - 1,
            index: globalChunkIndex + (options.indexBase || 0),
          };
        }
      }

      // 每处理完一块就释放内存
      this.releaseMemory(blockEnd - blockStart);

      // 手动触发垃圾回收（如果环境支持）
      this.checkMemoryUsage();
    }

    // 检查所有分片是否都已处理
    const missingChunks = chunks.findIndex(chunk => !chunk);
    if (missingChunks !== -1) {
      throw new Error(`大文件处理错误：缺少分片 #${missingChunks}`);
    }

    if (this.options.devMode && this.logger) {
      this.logger.info('chunk', `大文件处理完成: ${file.name}`, {
        processedChunks: chunks.length,
      });
    }

    // 返回结果
    return {
      chunks,
      count: totalChunks,
      chunkSize,
      file: fileInfo,
      chunkInfos,
    };
  }

  /**
   * 使用指定Worker处理文件块
   * @param blockBlob 文件块
   * @param options 处理选项
   * @param worker Worker对象
   * @param fileInfo 可选的文件信息
   * @returns 处理结果
   */
  private processBlockWithWorker(
    blockBlob: Blob,
    options: IFileHandlerOptions,
    worker: Worker,
    fileInfo?: IFileInfo,
  ): Promise<IFileChunkResult> {
    const taskId = `block_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    return new Promise<IFileChunkResult>((resolve, reject) => {
      const task: WorkerTask = {
        file: blockBlob,
        fileInfo,
        options,
        resolve,
        reject,
        id: taskId,
        createdAt: Date.now(),
      };

      this.assignTaskToWorker(worker, task);
    });
  }

  /**
   * 获取分片数量
   * @param fileSize 文件大小
   * @param chunkSize 分片大小
   * @returns 分片数量
   */
  public getChunkCount(fileSize: number, chunkSize: number): number {
    return this.fileHandler.getChunkCount(fileSize, chunkSize);
  }

  /**
   * 获取优化后的分片大小
   * @param file 文件对象
   * @returns 优化后的分片大小
   */
  public getOptimalChunkSize(file: File): number {
    return this.fileHandler.getOptimalChunkSize(file);
  }

  /**
   * 验证分片
   * @param chunk 分片对象
   * @param expectedSize 期望的大小
   * @returns 验证是否通过
   */
  public validateChunk(chunk: Blob, expectedSize?: number): boolean {
    return this.fileHandler.validateChunk(chunk, expectedSize);
  }

  /**
   * 清理资源
   * 终止所有Worker，释放资源
   */
  public cleanup(): void {
    this.isTerminating = true;

    // 拒绝所有队列中的任务
    this.taskQueue.forEach(task => {
      task.reject(new Error('WorkerFileHandler正在清理资源，任务被取消'));
    });
    this.taskQueue = [];

    // 拒绝所有正在进行的任务
    this.busyWorkers.forEach((task, worker) => {
      task.reject(new Error('WorkerFileHandler正在清理资源，任务被取消'));
      this.terminateWorker(worker);
    });
    this.busyWorkers.clear();

    // 终止所有剩余Worker
    [...this.workers].forEach(worker => {
      this.terminateWorker(worker);
    });
    this.workers = [];

    // 重置内存使用估计
    this.memoryUsage = 0;

    if (this.options.devMode && this.logger) {
      this.logger.info('chunk', 'WorkerFileHandler资源已清理');
    }

    this.isTerminating = false;
  }
}
