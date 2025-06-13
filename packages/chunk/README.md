/\*\*

- @file-chunk-uploader/chunk
-
- 文件分片上传功能包
- 提供文件切片和分片管理功能
  \*/

## 功能特点

- 文件分片处理
- 优化的分片大小计算
- 并发分片上传
- 顺序分片上传选项
- 分片合并请求处理
- 上传进度追踪
- 性能指标记录

## 安装

```bash
# NPM
npm install @file-chunk-uploader/chunk

# Yarn
yarn add @file-chunk-uploader/chunk

# PNPM
pnpm add @file-chunk-uploader/chunk
```

## 使用方法

### 作为插件使用

```typescript
import { FileUploader } from '@file-chunk-uploader/core';
import { chunkPlugin } from '@file-chunk-uploader/chunk';

const uploader = new FileUploader({
  target: 'https://api.example.com/upload',
});

// 使用默认配置
uploader.use(chunkPlugin());

// 或使用自定义配置
uploader.use(
  chunkPlugin({
    chunkSize: 5 * 1024 * 1024, // 5MB分片
    concurrency: 3, // 并发上传3个分片
    sequential: false, // 并发上传模式
    indexBase: 0, // 分片索引从0开始
  }),
);

// 上传文件
uploader.upload(file).then(result => {
  console.log('上传完成', result);
});
```

### 直接使用分片策略

```typescript
import { ChunkUploadStrategy } from '@file-chunk-uploader/chunk';

const chunkStrategy = new ChunkUploadStrategy({
  chunkSize: 2 * 1024 * 1024, // 2MB分片
  concurrency: 3, // 并发上传3个分片
});

// 初始化策略
chunkStrategy.init(uploader);

// 上传文件
chunkStrategy.process(file, uploadConfig).then(result => {
  console.log('上传完成', result);
});
```

### 使用文件处理器

```typescript
import { FileHandler } from '@file-chunk-uploader/chunk';

const fileHandler = new FileHandler({
  chunkSize: 2 * 1024 * 1024, // 2MB分片
  optimizeChunking: true, // 启用优化的分片大小计算
});

// 创建文件分片
const { chunks, chunkMetas, fileInfo } = await fileHandler.createChunks(file);
console.log(`文件被分成 ${chunks.length} 个分片`);

// 然后可以手动处理这些分片
// ...
```

## 配置选项

### 分片配置

```typescript
interface IChunkConfig {
  /** 分片大小（字节），默认2MB */
  chunkSize?: number;
  /** 并发上传数，默认3 */
  concurrency?: number;
  /** 是否按顺序上传分片，默认false */
  sequential?: boolean;
  /** 分片索引基数（0或1），默认0 */
  indexBase?: 0 | 1;
  /** 分片大小计算策略，默认fixed */
  chunkSizeStrategy?: 'fixed' | 'adaptive';
}
```

### 文件处理器选项

```typescript
interface IFileHandlerOptions {
  /** 分片大小（字节），默认2MB */
  chunkSize?: number;
  /** 最小分片大小（字节），默认256KB */
  minChunkSize?: number;
  /** 是否使用Web Worker处理大文件，默认true */
  useWorker?: boolean;
  /** 是否优化分片大小（根据文件类型和大小），默认true */
  optimizeChunking?: boolean;
  /** 分片索引基数（0或1），默认0 */
  indexBase?: 0 | 1;
  /** 开发者模式，默认false */
  devMode?: boolean;
}
```

## 事件

分片上传过程中会触发以下事件：

- `chunk:task:created` - 分片任务创建时
- `chunk:upload:start` - 开始上传分片时
- `chunk:uploaded` - 单个分片上传完成时
- `chunk:error` - 分片上传错误时
- `chunk:progress` - 上传进度更新时
- `chunk:upload:completed` - 所有分片上传完成时
- `chunk:merge:start` - 开始合并分片时
- `chunk:merge:complete` - 分片合并完成时
- `chunk:merge:error` - 分片合并错误时

可以通过上传器的事件系统监听这些事件：

```typescript
uploader.on('chunk:progress', data => {
  console.log(`上传进度: ${data.progress.percentage}%`);
});
```

## 性能指标

分片上传过程中会记录以下性能指标：

- `chunking` - 文件分片耗时
- `upload` - 分片上传总耗时
- `chunk_[index]` - 每个分片的上传耗时
- `merge` - 分片合并耗时
- `total` - 整个上传流程总耗时

可以通过监听性能指标事件获取这些数据：

```typescript
uploader.on('performance:metric', data => {
  if (data.category === 'chunk') {
    console.log(`${data.operation}: ${data.duration.toFixed(2)}ms`);
  }
});
```

## API文档

详细API文档请参考[TypeDoc生成的API文档](../docs/api)。

## 架构设计

分片上传模块采用了职责分离的模块化设计，主要包含以下组件：

### 核心组件

1. **ChunkUploadCoordinator**: 分片上传协调器，负责协调整个上传流程
2. **ChunkTaskManager**: 分片任务管理器，负责管理上传任务状态
3. **ChunkProgressTracker**: 分片进度跟踪器，负责计算和更新上传进度
4. **ChunkMerger**: 分片合并器，负责处理分片合并请求
5. **ChunkCreator**: 分片创建器，负责文件切片和元数据创建
6. **PerformanceTracker**: 性能指标记录器，负责收集和分析上传性能数据

### 工具类

1. **ErrorHandler**: 错误处理工具，提供统一的错误处理和转换功能
2. **ConfigValidator**: 配置验证工具，提供配置参数验证功能
3. **Logger**: 日志工具，提供统一的日志记录功能
4. **EventHelper**: 事件辅助工具，提供事件发送和处理功能
5. **Formatter**: 格式化工具，提供文件大小和时间格式化功能

## 使用示例

```typescript
import { FileUploader } from '@file-chunk-uploader/core';
import { chunkPlugin } from '@file-chunk-uploader/chunk';

// 创建上传器实例
const uploader = new FileUploader({
  target: 'https://api.example.com/upload',
});

// 使用分片上传插件
uploader.use(
  chunkPlugin({
    chunkSize: 2 * 1024 * 1024, // 2MB
    concurrency: 3,
    sequential: false,
  }),
);

// 上传文件
const fileInput = document.querySelector('input[type="file"]');
fileInput.addEventListener('change', async e => {
  const file = e.target.files[0];
  if (file) {
    try {
      const result = await uploader.upload(file);
      console.log('上传成功:', result);
    } catch (error) {
      console.error('上传失败:', error);
    }
  }
});
```

## 事件

分片上传模块会触发以下事件：

- `chunk:task:created`: 分片任务创建事件
- `chunk:task:status`: 分片任务状态变更事件
- `chunk:progress`: 分片上传进度事件
- `chunk:upload:start`: 分片开始上传事件
- `chunk:upload:success`: 分片上传成功事件
- `chunk:upload:error`: 分片上传失败事件
- `chunk:merge:start`: 分片合并开始事件
- `chunk:merge:complete`: 分片合并完成事件
- `chunk:merge:error`: 分片合并失败事件

## 配置选项

```typescript
interface ChunkConfig {
  /** 分片大小（字节） */
  chunkSize?: number; // 默认: 5MB
  /** 并发上传数 */
  concurrency?: number; // 默认: 3
  /** 是否按顺序上传分片 */
  sequential?: boolean; // 默认: false
  /** 分片索引基数（0或1） */
  indexBase?: 0 | 1; // 默认: 0
  /** 分片大小计算策略 */
  chunkSizeStrategy?: 'fixed' | 'adaptive'; // 默认: 'adaptive'
  /** 合并分片的请求地址 */
  mergeUrl?: string; // 默认: ${target}/merge
}
```
