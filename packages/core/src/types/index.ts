// 此文件作为types模块的入口
// 实际开发时会导出所有类型定义

// 基本配置类型（占位）
export interface UploadConfig {
  target: string;
  chunkSize?: number;
  concurrency?: number;
  retryCount?: number;
  onProgress?: (progress: number) => void;
  // 更多配置项...
}
