/**
 * 测试用模拟类和类型定义
 */
// 由于是测试环境，可以使用any类型声明
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EventEmitter = any;

// 模拟的Logger类型
export interface MockLogger {
  debug: jest.Mock;
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
}

// 模拟的上传文件信息类型
export interface UploadFileInfo {
  fileId: string;
  fileName: string;
  fileSize: number;
  chunkSize: number;
  totalChunks: number;
  chunks: Array<{
    index: number;
    start: number;
    end: number;
    uploaded: boolean;
  }>;
}

// 模拟的上传状态类型
export interface UploadState {
  fileId: string;
  fileName: string;
  fileSize: number;
  chunkSize: number;
  totalChunks: number;
  uploadedChunks: number[];
  lastUpdated: number;
}

// 存储相关配置类型
export interface StorageOptions {
  dbName: string;
  storeName: string;
}

// 模拟断点续传策略选项类型
export interface TestResumeUploadStrategyOptions {
  storage: StorageOptions;
  chunkSize: number;
  maxConcurrentUploads: number;
  eventEmitter: EventEmitter;
  logger: MockLogger;
}

/**
 * 模拟的断点续传策略类
 */
export class MockResumeUploadStrategy {
  private options: TestResumeUploadStrategyOptions;

  constructor(options: TestResumeUploadStrategyOptions) {
    this.options = options;
  }

  /**
   * 生成文件唯一ID
   */
  generateFileId(file: File): string {
    return `mock-file-id-${file.name}-${file.size}`;
  }

  /**
   * 处理文件分片
   */
  async processFile(file: File): Promise<UploadFileInfo> {
    const fileId = this.generateFileId(file);
    const totalChunks = Math.ceil(file.size / this.options.chunkSize);

    const chunks = Array.from({ length: totalChunks }, (_, index) => {
      const start = index * this.options.chunkSize;
      const end = Math.min(start + this.options.chunkSize, file.size);

      return {
        index,
        start,
        end,
        uploaded: false,
      };
    });

    return {
      fileId,
      fileName: file.name,
      fileSize: file.size,
      chunkSize: this.options.chunkSize,
      totalChunks,
      chunks,
    };
  }

  /**
   * 检查是否存在上传状态
   */
  async hasUploadState(_fileId: string): Promise<boolean> {
    // 模拟总是存在上传状态
    return true;
  }

  /**
   * 恢复上传状态
   */
  async resumeUpload(fileId: string): Promise<UploadState> {
    // 模拟恢复上传状态
    return {
      fileId,
      fileName: 'mock-file.txt',
      fileSize: 1024,
      chunkSize: this.options.chunkSize,
      totalChunks: 2,
      uploadedChunks: [0],
      lastUpdated: Date.now(),
    };
  }

  /**
   * 保存上传状态
   */
  async saveUploadState(state: UploadState): Promise<void> {
    this.options.logger.debug('保存上传状态', state);
    // 不执行实际操作，仅记录日志
  }

  /**
   * 删除上传状态
   */
  async removeUploadState(fileId: string): Promise<void> {
    this.options.logger.debug('删除上传状态', fileId);
    // 不执行实际操作，仅记录日志
  }
}

// 用于测试的存储选项
export interface TestStorageOptions {
  dbName: string;
  storeName: string;
  version?: number;
  maxAge?: number;
  compressionThreshold?: number;
}

// 用于测试的文件信息类型
export interface TestFileInfo {
  fileId: string;
  fileName: string;
  fileSize: number;
  fileType?: string;
  chunks: Blob[];
  chunkSize: number;
  totalChunks: number;
  metadata?: Record<string, any>;
}

// 模拟存储管理器，用于测试
export class MockStorageManager {
  async init(): Promise<void> {}

  async get(key: string): Promise<any> {
    return { key, value: 'mock-value' };
  }

  async set(_key: string, _value: any): Promise<void> {}

  async delete(_key: string): Promise<void> {}

  async clear(): Promise<void> {}

  async close(): Promise<void> {}
}
