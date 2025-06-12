/**
 * @file-chunk-uploader/types
 * 文件分片上传库的所有类型定义
 *
 * 提供了所有包共享的类型定义，确保类型一致性
 * @packageDocumentation
 */

// 基本配置类型（占位）
export interface UploadConfig {
  target: string;
  chunkSize?: number;
  concurrency?: number;
  retryCount?: number;
  onProgress?: (progress: number) => void;
  // 更多配置项...
}

// 基础类型
export * from './base';

// 配置选项类型
export * from './config';

// 插件系统类型
export * from './plugin';

// 事件系统类型
export * from './event';

// 网络相关类型
export * from './network';

// 错误类型
export * from './error';

// 存储相关类型
export * from './storage';

// 上传器类型
export * from './uploader';

// Worker相关类型
export * from './worker';
