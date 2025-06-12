/**
 * 文件处理器实现
 * 负责文件切片和分片信息管理
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

/**
 * 文件分片大小常量（字节）
 */
export const CHUNK_SIZE = {
  /** 默认分片大小：2MB */
  DEFAULT: 2 * 1024 * 1024,
  /** 最小分片大小：256KB */
  MIN: 256 * 1024,
  /** 最大分片大小：10MB */
  MAX: 10 * 1024 * 1024,
  /** 大文件分片大小：10MB */
  LARGE: 10 * 1024 * 1024,
  /** 中等文件分片大小：5MB */
  MEDIUM: 5 * 1024 * 1024,
  /** 小文件分片大小：1MB */
  SMALL: 1 * 1024 * 1024,
};

/**
 * 文件大小阈值常量（字节）
 */
export const FILE_SIZE = {
  /** 大文件阈值：1GB */
  LARGE: 1024 * 1024 * 1024,
  /** 中等文件阈值：100MB */
  MEDIUM: 100 * 1024 * 1024,
  /** 小文件阈值：10MB */
  SMALL: 10 * 1024 * 1024,
};

/**
 * 分片数量阈值常量
 */
export const CHUNK_COUNT = {
  /** 最大分片数量 */
  MAX: 1000,
  /** 最小推荐分片数量（针对大文件） */
  MIN_RECOMMENDED: 5,
};

/**
 * 默认文件处理选项
 */
const DEFAULT_OPTIONS: IFileHandlerOptions = {
  chunkSize: CHUNK_SIZE.DEFAULT,
  minChunkSize: CHUNK_SIZE.MIN,
  useWorker: true,
  optimizeChunking: true,
  indexBase: 0,
  concurrency: 3,
  devMode: false,
};

/**
 * 特殊文件类型的MIME类型前缀
 */
const FILE_MIME_TYPES = {
  /** 视频文件 */
  VIDEO: 'video/',
  /** 音频文件 */
  AUDIO: 'audio/',
  /** 图片文件 */
  IMAGE: 'image/',
  /** PDF文件 */
  PDF: 'application/pdf',
};

/**
 * 文件处理器类
 * 实现文件分片和分片管理功能
 */
export class FileHandler implements IFileHandler {
  private options: IFileHandlerOptions;
  private logger?: ILogger;

  /**
   * 创建文件处理器实例
   * @param options 文件处理选项
   */
  constructor(options: Partial<IFileHandlerOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.logger = options.logger;

    if (this.options.devMode && this.logger) {
      this.logger.info('chunk', 'FileHandler初始化', { options: this.options });
    }
  }

  /**
   * 创建文件分片
   * @param file 要处理的文件
   * @param overrideOptions 覆盖默认选项
   * @returns 文件分块结果
   */
  public async createChunks(
    file: File,
    overrideOptions?: Partial<IFileHandlerOptions>,
  ): Promise<IFileChunkResult> {
    const startTime = performance.now();

    // 校验和合并选项
    const options = this.validateAndMergeOptions(overrideOptions);

    // 日志记录
    if (options.devMode && this.logger) {
      this.logger.debug('chunk', `开始处理文件: ${file.name}`, {
        fileSize: file.size,
        fileType: file.type,
      });
    }

    // 获取最佳分片大小
    const chunkSize = options.optimizeChunking ? this.getOptimalChunkSize(file) : options.chunkSize;

    // 计算分片数量
    const chunkCount = this.getChunkCount(file.size, chunkSize);

    // 创建分片
    const chunks: Blob[] = [];
    const chunkInfos: IChunkMeta[] = [];

    // 遍历创建分片
    for (let i = 0; i < chunkCount; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const size = end - start;
      const isLast = i === chunkCount - 1;

      // 创建分片
      const chunk = file.slice(start, end);

      // 验证分片
      if (!this.validateChunk(chunk, size)) {
        throw new Error(
          `分片 #${i} 创建失败: 大小不匹配, 文件名: ${file.name}, 分片大小: ${size}, 实际大小: ${chunk.size}`,
        );
      }

      // 添加到结果
      chunks.push(chunk);

      // 记录分片信息
      chunkInfos.push({
        index: i + options.indexBase!,
        size,
        start,
        end,
        isLast,
      });

      // 日志记录
      if (options.devMode && this.logger) {
        this.logger.debug('chunk', `创建分片 #${i}`, {
          size,
          start,
          end,
          isLast,
        });
      }
    }

    // 创建文件信息
    const fileInfo: IFileInfo = {
      id: generateFileId(file),
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
    };

    // 计算处理时间
    const endTime = performance.now();
    const processingTime = endTime - startTime;

    // 日志记录
    if (options.devMode && this.logger) {
      this.logger.info('chunk', `文件处理完成: ${file.name}`, {
        chunkCount,
        chunkSize,
        processingTime: `${processingTime.toFixed(2)}ms`,
      });
    }

    // 返回结果
    return {
      chunks,
      count: chunkCount,
      chunkSize,
      file: fileInfo,
      chunkInfos,
    };
  }

  /**
   * 验证和合并选项
   * @param overrideOptions 覆盖选项
   * @returns 合并后的选项
   */
  private validateAndMergeOptions(
    overrideOptions?: Partial<IFileHandlerOptions>,
  ): IFileHandlerOptions {
    // 如果没有覆盖选项，直接返回当前选项
    if (!overrideOptions) {
      return this.options;
    }

    // 验证关键选项
    if (overrideOptions.chunkSize !== undefined) {
      if (typeof overrideOptions.chunkSize !== 'number' || overrideOptions.chunkSize <= 0) {
        throw new Error(`无效的分片大小: ${overrideOptions.chunkSize}`);
      }
      // 确保分片大小在合理范围内
      overrideOptions.chunkSize = Math.max(
        overrideOptions.minChunkSize || this.options.minChunkSize || CHUNK_SIZE.MIN,
        Math.min(overrideOptions.chunkSize, CHUNK_SIZE.MAX),
      );
    }

    if (overrideOptions.indexBase !== undefined && typeof overrideOptions.indexBase !== 'number') {
      throw new Error(`无效的索引基数: ${overrideOptions.indexBase}`);
    }

    if (overrideOptions.concurrency !== undefined) {
      if (typeof overrideOptions.concurrency !== 'number' || overrideOptions.concurrency <= 0) {
        throw new Error(`无效的并发数: ${overrideOptions.concurrency}`);
      }
    }

    // 合并选项
    return { ...this.options, ...overrideOptions };
  }

  /**
   * 获取分片数量
   * @param fileSize 文件大小
   * @param chunkSize 分片大小
   * @returns 分片数量
   */
  public getChunkCount(fileSize: number, chunkSize: number): number {
    return Math.ceil(fileSize / chunkSize);
  }

  /**
   * 获取优化后的分片大小
   * 根据文件大小和其他参数计算最优分片大小
   * @param file 文件对象
   * @returns 优化后的分片大小
   */
  public getOptimalChunkSize(file: File): number {
    // 最小和最大分片大小限制
    const minChunkSize = this.options.minChunkSize || CHUNK_SIZE.MIN;
    const maxChunkSize = CHUNK_SIZE.MAX;

    // 默认分片大小
    let optimalChunkSize = this.options.chunkSize;

    // 根据文件类型进行特殊处理
    const fileType = this.getFileType(file);
    if (fileType === 'video') {
      // 视频文件使用较大的分片以减少请求次数
      optimalChunkSize = file.size > FILE_SIZE.LARGE ? CHUNK_SIZE.LARGE : CHUNK_SIZE.MEDIUM;
    } else if (fileType === 'audio') {
      // 音频文件通常较小，使用中等分片
      optimalChunkSize = CHUNK_SIZE.MEDIUM;
    } else if (fileType === 'image') {
      // 图片文件通常较小，使用较小分片
      optimalChunkSize = CHUNK_SIZE.SMALL;
    } else {
      // 根据文件大小优化分片大小
      if (file.size > FILE_SIZE.LARGE) {
        // 大于1GB的文件，使用较大的分片
        optimalChunkSize = CHUNK_SIZE.LARGE;
      } else if (file.size > FILE_SIZE.MEDIUM) {
        // 大于100MB的文件，使用中等分片
        optimalChunkSize = CHUNK_SIZE.MEDIUM;
      } else if (file.size < FILE_SIZE.SMALL) {
        // 小于10MB的文件，使用较小的分片
        optimalChunkSize = CHUNK_SIZE.SMALL;
      }
    }

    // 确保分片数量在合理范围内，避免过多或过少的分片
    const chunkCount = Math.ceil(file.size / optimalChunkSize);

    // 如果分片数量过多，增大分片大小
    if (chunkCount > CHUNK_COUNT.MAX) {
      optimalChunkSize = Math.ceil(file.size / CHUNK_COUNT.MAX);
    }

    // 如果分片数量过少，减小分片大小
    if (chunkCount < CHUNK_COUNT.MIN_RECOMMENDED && file.size > FILE_SIZE.SMALL) {
      optimalChunkSize = Math.ceil(file.size / 10);
    }

    // 确保分片大小在限制范围内
    optimalChunkSize = Math.max(minChunkSize, Math.min(optimalChunkSize, maxChunkSize));

    // 日志记录
    if (this.options.devMode && this.logger) {
      this.logger.debug('chunk', `计算最优分片大小`, {
        fileSize: file.size,
        fileType,
        optimalChunkSize,
        estimatedChunks: Math.ceil(file.size / optimalChunkSize),
      });
    }

    return optimalChunkSize;
  }

  /**
   * 验证分片
   * 用于验证分片完整性
   * @param chunk 分片对象
   * @param expectedSize 期望的大小
   * @returns 验证是否通过
   */
  public validateChunk(chunk: Blob, expectedSize?: number): boolean {
    if (!chunk) return false;
    if (expectedSize !== undefined && chunk.size !== expectedSize) {
      if (this.options.devMode && this.logger) {
        this.logger.warn('chunk', `分片大小验证失败`, {
          expected: expectedSize,
          actual: chunk.size,
          difference: Math.abs(chunk.size - expectedSize),
          percentDiff: `${((Math.abs(chunk.size - expectedSize) / expectedSize) * 100).toFixed(
            2,
          )}%`,
        });
      }
      return false;
    }
    return true;
  }

  /**
   * 获取文件类型分类
   * @param file 文件对象
   * @returns 文件类型分类
   */
  private getFileType(file: File): 'video' | 'audio' | 'image' | 'pdf' | 'other' {
    const mime = file.type.toLowerCase();

    if (mime.startsWith(FILE_MIME_TYPES.VIDEO)) {
      return 'video';
    } else if (mime.startsWith(FILE_MIME_TYPES.AUDIO)) {
      return 'audio';
    } else if (mime.startsWith(FILE_MIME_TYPES.IMAGE)) {
      return 'image';
    } else if (mime === FILE_MIME_TYPES.PDF) {
      return 'pdf';
    }

    return 'other';
  }
}
