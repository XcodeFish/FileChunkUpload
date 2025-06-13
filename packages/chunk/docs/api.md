# 分片上传API文档

## 简介

`@file-chunk-uploader/chunk` 包提供了高性能、可靠的文件分片上传功能，支持大文件的分片处理、并发上传和自定义配置。该包可作为插件集成到 `@file-chunk-uploader/core` 中使用。

## 安装

```bash
# 使用npm
npm install @file-chunk-uploader/chunk

# 使用pnpm
pnpm add @file-chunk-uploader/chunk

# 使用yarn
yarn add @file-chunk-uploader/chunk
```

## 主要功能

- **文件分片处理**：将大文件按指定大小切分为多个小分片
- **分片并发上传**：支持多个分片同时上传，提高上传速度
- **顺序上传模式**：可选择按顺序上传分片，适用于某些服务端要求
- **自适应分片策略**：根据文件大小和网络状况调整分片大小
- **自定义钩子**：提供多个生命周期钩子用于自定义处理逻辑
- **完整日志支持**：集成了开发者模式的详细日志记录

## API参考

### `chunkPlugin(options?: ChunkPluginOptions): IPlugin`

创建分片上传插件实例。

#### 参数

`options` - 可选的配置对象，包含以下字段：

| 字段                | 类型                          | 默认值            | 描述                 |
| ------------------- | ----------------------------- | ----------------- | -------------------- |
| `enabled`           | `boolean`                     | `true`            | 是否启用分片上传插件 |
| `chunkSize`         | `number`                      | `2 * 1024 * 1024` | 分片大小（字节）     |
| `concurrency`       | `number`                      | `3`               | 并发上传的分片数量   |
| `sequential`        | `boolean`                     | `false`           | 是否按顺序上传分片   |
| `chunkSizeStrategy` | `'fixed'` \| `'adaptive'`     | `'fixed'`         | 分片大小计算策略     |
| `indexBase`         | `number`                      | `0`               | 分片索引起始值       |
| `devMode`           | `boolean` \| `IDevModeConfig` | `false`           | 开发者模式配置       |
| `hooks`             | `object`                      | `undefined`       | 自定义钩子配置       |

#### 返回值

返回一个实现了 `IPlugin` 接口的插件对象，可以通过 `FileUploader.use()` 方法注册到上传器。

### 自定义钩子

分片上传插件支持以下自定义钩子：

#### `beforeCreateChunks(file: File, chunkSize: number): number | Promise<number>`

在创建分片之前调用，可用于动态调整分片大小。

- **参数**:
  - `file`: 要分片的文件对象
  - `chunkSize`: 当前配置的分片大小
- **返回值**: 新的分片大小（字节）

#### `afterCreateChunks(chunks: Blob[], file: File): Blob[] | Promise<Blob[]>`

在创建分片之后调用，可用于自定义处理分片数据。

- **参数**:
  - `chunks`: 已创建的分片数组
  - `file`: 原始文件对象
- **返回值**: 可能修改后的分片数组

#### `beforeMergeChunks(fileId: string, chunkCount: number): void | Promise<void>`

在所有分片上传完成后，合并之前调用。

- **参数**:
  - `fileId`: 文件ID
  - `chunkCount`: 分片总数

## 使用示例

### 基础使用

```typescript
import { FileUploader } from '@file-chunk-uploader/core';
import { chunkPlugin } from '@file-chunk-uploader/chunk';

// 创建上传器实例
const uploader = new FileUploader({
  target: 'https://api.example.com/upload',
});

// 使用默认配置
uploader.use(chunkPlugin());

// 上传文件
uploader
  .upload(file)
  .then(result => console.log('上传成功:', result))
  .catch(error => console.error('上传失败:', error));
```

### 自定义配置

```typescript
import { FileUploader } from '@file-chunk-uploader/core';
import { chunkPlugin } from '@file-chunk-uploader/chunk';

const uploader = new FileUploader({
  target: 'https://api.example.com/upload',
});

// 使用自定义配置
uploader.use(
  chunkPlugin({
    chunkSize: 5 * 1024 * 1024, // 5MB分片
    concurrency: 3, // 并发上传3个分片
    sequential: false, // 并发上传模式
    indexBase: 0, // 分片索引从0开始
  }),
);

// 上传文件
uploader.upload(file);
```

### 高级配置与自定义钩子

```typescript
import { FileUploader } from '@file-chunk-uploader/core';
import { chunkPlugin } from '@file-chunk-uploader/chunk';

const uploader = new FileUploader({
  target: 'https://api.example.com/upload',
});

// 使用高级配置和自定义钩子
uploader.use(
  chunkPlugin({
    // 基础配置
    chunkSize: 2 * 1024 * 1024,
    concurrency: 3,

    // 高级配置
    sequential: true, // 按顺序上传分片
    chunkSizeStrategy: 'adaptive', // 自适应分片大小
    devMode: true, // 启用开发者模式

    // 自定义钩子
    hooks: {
      // 动态调整分片大小
      beforeCreateChunks: (file, chunkSize) => {
        // 根据文件大小调整分片大小
        if (file.size > 1024 * 1024 * 1024) {
          // 大于1GB
          return 8 * 1024 * 1024; // 使用8MB分片
        }
        return chunkSize; // 使用默认值
      },

      // 处理创建后的分片
      afterCreateChunks: (chunks, file) => {
        console.log(`文件 ${file.name} 已分为 ${chunks.length} 个分片`);
        return chunks; // 返回原始分片
      },

      // 分片合并前的操作
      beforeMergeChunks: (fileId, chunkCount) => {
        console.log(`准备合并文件 ${fileId} 的 ${chunkCount} 个分片`);
      },
    },
  }),
);

// 上传文件
uploader.upload(file);
```

### 与其他插件结合

```typescript
import { FileUploader } from '@file-chunk-uploader/core';
import { chunkPlugin } from '@file-chunk-uploader/chunk';
import { resumePlugin } from '@file-chunk-uploader/resume';

const uploader = new FileUploader({
  target: 'https://api.example.com/upload',
});

// 组合使用多个插件
uploader.use(
  chunkPlugin({
    chunkSize: 4 * 1024 * 1024, // 4MB分片
  }),
);

// 添加断点续传功能
uploader.use(
  resumePlugin({
    storage: 'indexedDB', // 使用IndexedDB存储上传进度
  }),
);

// 上传文件
uploader.upload(file);
```

## 提示与最佳实践

1. **选择合适的分片大小**：

   - 过小的分片会增加请求数量和服务器负担
   - 过大的分片在网络不稳定时容易失败
   - 一般推荐2MB-5MB为佳，可根据目标环境调整

2. **并发数调优**：

   - 宽带足够时增大并发数可提高上传速度
   - 在移动网络环境下建议降低并发数（1-2）
   - 在高速网络环境下可适当增加（4-6）

3. **网络适应性**：

   - 考虑使用 `chunkSizeStrategy: 'adaptive'` 在弱网环境自动降低分片大小
   - 与网络检测插件配合使用效果更佳

4. **开发者模式**：

   - 开发和调试时开启 `devMode: true`，查看详细日志
   - 生产环境建议关闭以提高性能

5. **自定义钩子使用场景**：
   - `beforeCreateChunks`: 动态调整分片大小、预处理文件
   - `afterCreateChunks`: 添加额外元数据、自定义分片处理
   - `beforeMergeChunks`: 验证分片完整性、发送合并请求

## 类型定义

完整的类型定义可在 `@file-chunk-uploader/types` 包中找到，主要类型包括：

```typescript
// 分片上传配置
interface IChunkConfig {
  chunkSize: number; // 分片大小（字节）
  concurrency: number; // 并发上传数
  sequential: boolean; // 是否按顺序上传
  indexBase: number; // 分片索引起始值
  retries: number; // 失败重试次数
}

// 分片上传插件配置
interface ChunkPluginOptions extends Partial<IChunkConfig> {
  enabled?: boolean; // 是否启用
  chunkSizeStrategy?: 'fixed' | 'adaptive'; // 分片大小策略
  devMode?: boolean | IDevModeConfig; // 开发者模式配置
  hooks?: {
    // 自定义钩子
    beforeCreateChunks?: (file: File, chunkSize: number) => number | Promise<number>;
    afterCreateChunks?: (chunks: Blob[], file: File) => Blob[] | Promise<Blob[]>;
    beforeMergeChunks?: (fileId: string, chunkCount: number) => void | Promise<void>;
  };
}
```
