/**
 * 测试用模拟类和类型定义
 */
type EventEmitter = any;
export interface MockLogger {
  debug: jest.Mock;
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
}
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
export interface UploadState {
  fileId: string;
  fileName: string;
  fileSize: number;
  chunkSize: number;
  totalChunks: number;
  uploadedChunks: number[];
  lastUpdated: number;
}
export interface StorageOptions {
  dbName: string;
  storeName: string;
}
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
export declare class MockResumeUploadStrategy {
  private options;
  constructor(options: TestResumeUploadStrategyOptions);
  /**
   * 生成文件唯一ID
   */
  generateFileId(file: File): string;
  /**
   * 处理文件分片
   */
  processFile(file: File): Promise<UploadFileInfo>;
  /**
   * 检查是否存在上传状态
   */
  hasUploadState(_fileId: string): Promise<boolean>;
  /**
   * 恢复上传状态
   */
  resumeUpload(fileId: string): Promise<UploadState>;
  /**
   * 保存上传状态
   */
  saveUploadState(state: UploadState): Promise<void>;
  /**
   * 删除上传状态
   */
  removeUploadState(fileId: string): Promise<void>;
}
export interface TestStorageOptions {
  dbName: string;
  storeName: string;
  version?: number;
  maxAge?: number;
  compressionThreshold?: number;
}
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
export declare class MockStorageManager {
  init(): Promise<void>;
  get(key: string): Promise<any>;
  set(_key: string, _value: any): Promise<void>;
  delete(_key: string): Promise<void>;
  clear(): Promise<void>;
  close(): Promise<void>;
}
export {};
//# sourceMappingURL=type-overrides.d.ts.map
