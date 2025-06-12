/**
 * 分片模块类型定义
 * 包含文件处理和分片策略的接口定义
 */
import { IFileInfo } from './base';

/**
 * Logger接口
 */
export interface ILogger {
  debug(category: string, message: string, data?: any): void;
  info(category: string, message: string, data?: any): void;
  warn(category: string, message: string, data?: any): void;
  error(category: string, message: string, data?: any): void;
}

/**
 * 文件分块结果接口
 */
export interface IFileChunkResult {
  /** 分片数组 */
  chunks: Blob[];
  /** 总分片数 */
  count: number;
  /** 分片大小 */
  chunkSize: number;
  /** 文件信息 */
  file: IFileInfo;
  /** 各个分片信息 */
  chunkInfos: IChunkMeta[];
}

/**
 * 分片元数据接口
 */
export interface IChunkMeta {
  /** 分片索引 */
  index: number;
  /** 分片大小 */
  size: number;
  /** 起始位置 */
  start: number;
  /** 结束位置 */
  end: number;
  /** 是否为最后一个分片 */
  isLast: boolean;
}

/**
 * 文件处理选项接口
 */
export interface IFileHandlerOptions {
  /** 分片大小（字节） */
  chunkSize: number;
  /** 最小分片大小（字节） */
  minChunkSize?: number;
  /** 是否使用Web Worker（当可用时） */
  useWorker?: boolean;
  /** 是否启用分片优化算法 */
  optimizeChunking?: boolean;
  /** 分片索引基数（0或1） */
  indexBase?: 0 | 1;
  /** 每个文件的并发分片数量 */
  concurrency?: number;
  /** 日志记录器 */
  logger?: ILogger;
  /** 开发者模式是否启用 */
  devMode?: boolean;
}

/**
 * 文件处理器接口
 * 负责文件切片和分片信息管理
 */
export interface IFileHandler {
  /**
   * 创建文件分片
   * @param file 要处理的文件
   * @param overrideOptions 覆盖默认选项
   * @returns 文件分块结果
   */
  createChunks(
    file: File,
    overrideOptions?: Partial<IFileHandlerOptions>,
  ): Promise<IFileChunkResult>;

  /**
   * 获取分片数量
   * @param fileSize 文件大小
   * @param chunkSize 分片大小
   * @returns 分片数量
   */
  getChunkCount(fileSize: number, chunkSize: number): number;

  /**
   * 获取优化后的分片大小
   * 根据文件大小和其他参数计算最优分片大小
   * @param file 文件对象
   * @returns 优化后的分片大小
   */
  getOptimalChunkSize(file: File): number;

  /**
   * 验证分片
   * 用于验证分片完整性
   * @param chunk 分片对象
   * @param expectedSize 期望的大小
   * @returns 验证是否通过
   */
  validateChunk(chunk: Blob, expectedSize?: number): boolean;
}
