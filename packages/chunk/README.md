# @file-chunk-uploader/chunk

文件分片上传功能包，提供文件切片和分片信息管理功能。

## 功能特性

- **文件分片处理**：高效处理大文件，将其分割为可管理的小块
- **分片信息管理**：跟踪每个分片的状态和元数据
- **自适应分片大小**：根据文件大小自动调整最佳分片大小
- **Web Worker 支持**：使用Web Worker进行后台处理，避免阻塞主线程
- **开发者模式集成**：提供详细的日志记录，帮助调试和优化

## 安装

```bash
npm install @file-chunk-uploader/chunk
# 或使用pnpm
pnpm add @file-chunk-uploader/chunk
```

## 基本用法

```typescript
import { FileHandler } from '@file-chunk-uploader/chunk';

// 创建文件处理器实例
const fileHandler = new FileHandler({
  chunkSize: 2 * 1024 * 1024, // 2MB 分片
  optimizeChunking: true, // 启用自适应分片大小
});

// 处理文件
async function handleFile(file) {
  try {
    // 创建文件分片
    const result = await fileHandler.createChunks(file);

    console.log(`文件 ${file.name} 已分割为 ${result.count} 个分片`);
    console.log(`分片大小: ${result.chunkSize / 1024} KB`);

    // 使用分片进行上传
    // ...
  } catch (error) {
    console.error('文件处理失败:', error);
  }
}
```

## Web Worker 支持

```typescript
import { WorkerFileHandler } from '@file-chunk-uploader/chunk';

// 创建Worker文件处理器
const workerHandler = new WorkerFileHandler({
  useWorker: true,
  devMode: true, // 启用开发者模式日志
});

// 使用Worker异步处理文件
async function processLargeFile(file) {
  const chunkResult = await workerHandler.createChunks(file);
  // 处理结果...
}
```

## 开发者模式集成

```typescript
import { FileHandler } from '@file-chunk-uploader/chunk';
import { Logger } from '@file-chunk-uploader/core';

// 创建日志记录器
const logger = new Logger({
  level: 'debug',
});

// 配置文件处理器
const fileHandler = new FileHandler({
  logger,
  devMode: true,
});

// 处理文件时将记录详细日志
fileHandler.createChunks(file);
```

## API

### FileHandler

文件处理器类，负责文件分片和管理。

#### 方法

- **createChunks(file: File, options?: Partial<IFileHandlerOptions>): Promise<IFileChunkResult>**
  将文件分割为块，返回分片结果

- **getChunkCount(fileSize: number, chunkSize: number): number**
  计算文件需要的分片数量

- **getOptimalChunkSize(file: File): number**
  根据文件大小计算最优分片大小

- **validateChunk(chunk: Blob, expectedSize?: number): boolean**
  验证分片完整性

### WorkerFileHandler

基于Web Worker的文件处理器，适用于处理大文件时避免阻塞主线程。

API与FileHandler相同，但在可用的情况下会使用Web Worker进行处理。

## 许可证

MIT
