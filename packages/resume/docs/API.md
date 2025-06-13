# @file-chunk-uploader/resume API文档

断点续传模块提供了在文件上传过程中断后能够恢复上传的功能，避免重新开始上传，提升用户体验和效率。本模块通过IndexedDB持久化存储上传状态，并提供续传策略管理上传流程。

## 核心功能

- 存储上传状态到IndexedDB
- 恢复中断的上传过程
- 自动检测是否有续传可能
- 提供丰富的事件通知
- 支持多级日志和开发者模式
- 自动处理存储空间管理

## 安装

```bash
pnpm add @file-chunk-uploader/resume
```

## 基本用法

```typescript
import { ResumeUploadStrategy } from '@file-chunk-uploader/resume';
import { EventEmitter } from '@file-chunk-uploader/core';

// 创建事件发射器（由核心包提供）
const eventEmitter = new EventEmitter();

// 创建续传策略实例
const resumeStrategy = new ResumeUploadStrategy({
  storage: {
    dbName: 'file-uploads',
    storeName: 'upload-states',
    version: 1,
  },
  maxConcurrentUploads: 3,
  eventEmitter,
  // 可选：提供自定义logger
  logger: console,
});

// 初始化策略
await resumeStrategy.init();

// 检查文件是否有续传状态
const fileId = resumeStrategy.generateFileId(file);
const hasState = await resumeStrategy.hasUploadState(fileId);

if (hasState) {
  // 恢复上传
  const uploadState = await resumeStrategy.resumeUpload(fileId);
  console.log(
    `正在恢复上传: ${uploadState.fileName}, 已完成: ${uploadState.uploadedChunks.length}/${uploadState.totalChunks} 分片`,
  );
} else {
  // 开始新的上传
  const fileInfo = await resumeStrategy.processFile(file);
  console.log(`开始新上传: ${fileInfo.fileName}, 总分片数: ${fileInfo.totalChunks}`);
}

// 监听上传事件
eventEmitter.on('upload:progress', data => {
  console.log(`上传进度: ${data.progress}%`);
});

eventEmitter.on('upload:resume', data => {
  console.log(`续传已开始: ${data.fileName}`);
});

eventEmitter.on('upload:complete', data => {
  console.log(`上传完成: ${data.fileName}`);
});

eventEmitter.on('upload:error', error => {
  console.error(`上传错误: ${error.message}`);
});

// 保存上传进度（每个分片上传成功后调用）
await resumeStrategy.saveProgress(fileId, chunkIndex);

// 完成上传（全部分片上传后调用）
await resumeStrategy.completeUpload(fileId);
```

## API参考

### 类: ResumeUploadStrategy

续传策略的核心实现，管理上传状态和续传流程。

#### 构造函数

```typescript
constructor(options: IResumeUploadStrategyOptions)
```

**参数:**

- `options` - 配置选项对象，包含以下属性:
  - `storage` - 存储配置
    - `dbName` - IndexedDB 数据库名称
    - `storeName` - 存储对象名称
    - `version` - 数据库版本号（可选，默认为1）
  - `maxConcurrentUploads` - 最大并发上传数（可选，默认为3）
  - `eventEmitter` - 事件发射器实例
  - `logger` - 自定义日志记录器（可选）

#### 方法

##### `init(): Promise<void>`

初始化续传策略，连接IndexedDB存储。

**返回值:** Promise<void>

##### `generateFileId(file: File): string`

为文件生成唯一ID，用于标识上传。

**参数:**

- `file` - File对象

**返回值:** 文件唯一ID

##### `hasUploadState(fileId: string): Promise<boolean>`

检查指定文件是否有保存的上传状态。

**参数:**

- `fileId` - 文件唯一ID

**返回值:** Promise<boolean> - 是否有续传状态

##### `resumeUpload(fileId: string): Promise<IUploadState>`

恢复指定文件的上传。

**参数:**

- `fileId` - 文件唯一ID

**返回值:** Promise<IUploadState> - 上传状态对象

##### `processFile(file: File): Promise<IFileInfo>`

处理文件，准备上传。

**参数:**

- `file` - File对象

**返回值:** Promise<IFileInfo> - 文件信息对象

##### `saveProgress(fileId: string, chunkIndex: number): Promise<void>`

保存指定文件的上传进度。

**参数:**

- `fileId` - 文件唯一ID
- `chunkIndex` - 已完成的分片索引

**返回值:** Promise<void>

##### `completeUpload(fileId: string): Promise<void>`

完成上传，清除上传状态。

**参数:**

- `fileId` - 文件唯一ID

**返回值:** Promise<void>

##### `handleUploadFailure(fileId: string, error: Error): Promise<void>`

处理上传失败情况。

**参数:**

- `fileId` - 文件唯一ID
- `error` - 错误对象

**返回值:** Promise<void>

### 类: StorageManager

管理IndexedDB存储，提供上传状态的保存和检索功能。

#### 构造函数

```typescript
constructor(options: IStorageOptions)
```

**参数:**

- `options` - 配置选项对象
  - `dbName` - IndexedDB 数据库名称
  - `storeName` - 存储对象名称
  - `version` - 数据库版本号（可选，默认为1）
  - `maxAge` - 状态最长保存时间（可选，默认为7天）
  - `compressionThreshold` - 压缩阈值（可选，默认为10KB）

#### 方法

##### `init(): Promise<void>`

初始化存储管理器并连接数据库。

**返回值:** Promise<void>

##### `saveUploadState(state: IUploadState): Promise<boolean>`

保存上传状态到存储。

**参数:**

- `state` - 上传状态对象

**返回值:** Promise<boolean> - 是否保存成功

##### `getUploadState(fileId: string): Promise<IUploadState | null>`

获取指定文件的上传状态。

**参数:**

- `fileId` - 文件唯一ID

**返回值:** Promise<IUploadState | null> - 上传状态对象，不存在则返回null

##### `removeUploadState(fileId: string): Promise<boolean>`

移除指定文件的上传状态。

**参数:**

- `fileId` - 文件唯一ID

**返回值:** Promise<boolean> - 是否删除成功

##### `getAllUploadStates(): Promise<IUploadState[]>`

获取所有保存的上传状态。

**返回值:** Promise<IUploadState[]> - 上传状态对象数组

##### `clear(): Promise<void>`

清除所有保存的上传状态。

**返回值:** Promise<void>

##### `close(): Promise<void>`

关闭数据库连接。

**返回值:** Promise<void>

## 事件

以下事件通过eventEmitter触发：

### `upload:progress`

当上传进度更新时触发。

**事件数据:**

```typescript
{
  fileId: string;      // 文件唯一ID
  fileName: string;    // 文件名
  progress: number;    // 上传进度(0-100)
  uploadedChunks: number[]; // 已上传的分片索引
  totalChunks: number; // 总分片数
}
```

### `upload:resume`

当恢复上传时触发。

**事件数据:**

```typescript
{
  fileId: string;      // 文件唯一ID
  fileName: string;    // 文件名
  uploadedChunks: number[]; // 已上传的分片索引
  totalChunks: number; // 总分片数
}
```

### `upload:complete`

当上传完成时触发。

**事件数据:**

```typescript
{
  fileId: string; // 文件唯一ID
  fileName: string; // 文件名
}
```

### `upload:error`

当上传发生错误时触发。

**事件数据:**

```typescript
{
  fileId: string;      // 文件唯一ID
  fileName?: string;   // 文件名（如果可用）
  error: Error;        // 错误对象
}
```

## 类型定义

主要类型定义如下：

```typescript
// 上传状态接口
interface IUploadState {
  fileId: string; // 文件唯一ID
  fileName: string; // 文件名
  fileSize: number; // 文件大小（字节）
  fileType?: string; // 文件MIME类型
  chunkSize: number; // 分片大小（字节）
  totalChunks: number; // 总分片数
  uploadedChunks: number[]; // 已上传分片的索引数组
  lastUpdated: number; // 最后更新时间戳
  metadata?: Record<string, any>; // 可选的元数据
}

// 文件信息接口
interface IFileInfo {
  fileId: string; // 文件唯一ID
  fileName: string; // 文件名
  fileSize: number; // 文件大小（字节）
  fileType?: string; // 文件MIME类型
  chunkSize: number; // 分片大小（字节）
  totalChunks: number; // 总分片数
  chunks: Blob[]; // 文件分片数组
  metadata?: Record<string, any>; // 可选的元数据
}

// 存储管理器选项
interface IStorageOptions {
  dbName: string; // 数据库名称
  storeName: string; // 存储对象名称
  version?: number; // 数据库版本（可选，默认为1）
  maxAge?: number; // 状态最长保存时间（毫秒）（可选，默认为7天）
  compressionThreshold?: number; // 压缩阈值（字节）（可选，默认为10KB）
}

// 续传策略选项
interface IResumeUploadStrategyOptions {
  storage: {
    dbName: string; // 数据库名称
    storeName: string; // 存储对象名称
    version?: number; // 数据库版本（可选，默认为1）
  };
  maxConcurrentUploads?: number; // 最大并发上传数（可选，默认为3）
  eventEmitter: IEventEmitter; // 事件发射器
  logger?: ILogger; // 日志记录器（可选）
}

// 事件发射器接口
interface IEventEmitter {
  emit(event: string, data: any): void;
  on(event: string, callback: (data: any) => void): void;
  off(event: string, callback: (data: any) => void): void;
}

// 日志记录器接口
interface ILogger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}
```

## 高级用法

### 自定义存储配置

```typescript
const resumeStrategy = new ResumeUploadStrategy({
  storage: {
    dbName: 'custom-db',
    storeName: 'upload-states',
    version: 2, // 自定义数据库版本
  },
  // 其他配置...
});
```

### 监听所有上传事件

```typescript
// 完整的事件监听
const events = [
  'upload:start',
  'upload:progress',
  'upload:resume',
  'upload:pause',
  'upload:complete',
  'upload:error',
  'storage:cleanup',
];

events.forEach(event => {
  eventEmitter.on(event, data => {
    console.log(`事件: ${event}`, data);
  });
});
```

### 存储空间管理

StorageManager自动管理存储空间，清理过期的上传状态。您可以手动触发清理：

```typescript
import { StorageManager } from '@file-chunk-uploader/resume';

const storage = new StorageManager({
  dbName: 'file-uploads',
  storeName: 'upload-states',
  maxAge: 3 * 24 * 60 * 60 * 1000, // 3天后过期
  compressionThreshold: 5 * 1024, // 5KB以上数据自动压缩
});

await storage.init();

// 触发清理过期状态
await storage.cleanupExpiredStates();
```

## 兼容性说明

本模块依赖IndexedDB，因此支持以下浏览器环境：

- Chrome 58+
- Firefox 54+
- Safari 11+
- Edge 18+
- iOS Safari 11.2+
- Android Browser 67+

旧版浏览器可能无法正常工作，请根据您的目标用户群体评估兼容性需求。

## 注意事项

1. 使用前必须先调用`init()`方法初始化
2. 大文件可能导致IndexedDB存储空间不足，请妥善设置分片大小
3. 开发者应处理可能的续传错误，如文件已变更等情况
4. 在隐私/无痕浏览模式下，IndexedDB可能有存储限制或禁用
