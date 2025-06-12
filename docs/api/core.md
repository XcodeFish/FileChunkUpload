# @file-chunk-uploader/core API文档

本文档详细介绍了`@file-chunk-uploader/core`包的API，包括核心类、方法、属性和事件。

## FileUploader 类

`FileUploader`是文件上传器的核心类，提供文件上传、控制和监听功能。

### 构造函数

```typescript
constructor(config: Partial<IUploadConfig> = {})
```

创建文件上传器实例。

**参数:**

- `config`: 上传器配置选项（可选）

**示例:**

```typescript
import { FileUploader } from '@file-chunk-uploader/core';

const uploader = new FileUploader({
  target: 'https://api.example.com/upload',
  method: 'POST',
  chunked: true,
  chunkSize: 1024 * 1024, // 1MB
});
```

### 方法

#### upload

```typescript
async upload(file: File | Blob, options?: Partial<IUploadConfig>): Promise<IUploadResult>
```

上传单个文件。

**参数:**

- `file`: 要上传的文件或Blob对象
- `options`: 上传选项，会覆盖实例配置（可选）

**返回值:**

- `Promise<IUploadResult>`: 上传结果Promise

**示例:**

```typescript
const file = document.getElementById('fileInput').files[0];
const result = await uploader.upload(file);

if (result.success) {
  console.log('上传成功:', result);
} else {
  console.error('上传失败:', result.error);
}
```

#### uploadMultiple

```typescript
async uploadMultiple(files: Array<File | Blob>, options?: Partial<IUploadConfig>): Promise<IUploadResult[]>
```

上传多个文件。

**参数:**

- `files`: 要上传的文件或Blob对象数组
- `options`: 上传选项，会覆盖实例配置（可选）

**返回值:**

- `Promise<IUploadResult[]>`: 上传结果数组Promise

**示例:**

```typescript
const files = document.getElementById('fileInput').files;
const results = await uploader.uploadMultiple(Array.from(files));

const successCount = results.filter(r => r.success).length;
console.log(`成功上传${successCount}/${files.length}个文件`);
```

#### uploadObservable

```typescript
uploadObservable(file: File | Blob, options?: Partial<IUploadConfig>): Observable
```

以Observable方式上传文件，便于监听上传进度。

**参数:**

- `file`: 要上传的文件或Blob对象
- `options`: 上传选项，会覆盖实例配置（可选）

**返回值:**

- `Observable`: 可观察对象，用于订阅上传进度和结果

**示例:**

```typescript
const file = document.getElementById('fileInput').files[0];
const observable = uploader.uploadObservable(file);

const subscription = observable.subscribe({
  next: progress => console.log(`上传进度: ${progress}%`),
  error: err => console.error('上传错误:', err),
  complete: () => console.log('上传完成'),
});

// 取消订阅
// subscription.unsubscribe();
```

#### pause

```typescript
pause(fileId?: string): void
```

暂停上传任务。

**参数:**

- `fileId`: 文件ID（可选），不传则暂停所有任务

**示例:**

```typescript
// 暂停指定文件上传
uploader.pause('file-123');

// 暂停所有上传
uploader.pause();
```

#### resume

```typescript
resume(fileId?: string): void
```

恢复上传任务。

**参数:**

- `fileId`: 文件ID（可选），不传则恢复所有任务

**示例:**

```typescript
// 恢复指定文件上传
uploader.resume('file-123');

// 恢复所有上传
uploader.resume();
```

#### cancel

```typescript
cancel(fileId?: string): void
```

取消上传任务。

**参数:**

- `fileId`: 文件ID（可选），不传则取消所有任务

**示例:**

```typescript
// 取消指定文件上传
uploader.cancel('file-123');

// 取消所有上传
uploader.cancel();
```

#### getStatus

```typescript
getStatus(fileId: string): string
```

获取文件上传状态。

**参数:**

- `fileId`: 文件ID

**返回值:**

- `string`: 文件状态，可能的值包括：'pending'、'uploading'、'paused'、'completed'、'error'、'cancelled'

**示例:**

```typescript
const status = uploader.getStatus('file-123');
console.log(`文件状态: ${status}`);
```

#### getProgress

```typescript
getProgress(fileId: string): number
```

获取文件上传进度。

**参数:**

- `fileId`: 文件ID

**返回值:**

- `number`: 上传进度百分比(0-100)

**示例:**

```typescript
const progress = uploader.getProgress('file-123');
console.log(`上传进度: ${progress}%`);
```

#### getTasks

```typescript
getTasks(): IUploadTask[]
```

获取所有上传任务。

**返回值:**

- `IUploadTask[]`: 上传任务数组

**示例:**

```typescript
const tasks = uploader.getTasks();
console.log(`当前有${tasks.length}个上传任务`);
```

#### getTask

```typescript
getTask(fileId: string): IUploadTask | undefined
```

获取指定文件的上传任务。

**参数:**

- `fileId`: 文件ID

**返回值:**

- `IUploadTask | undefined`: 上传任务，如果不存在则返回undefined

**示例:**

```typescript
const task = uploader.getTask('file-123');
if (task) {
  console.log(`文件名: ${task.getFile().name}`);
}
```

#### clearCompletedTasks

```typescript
clearCompletedTasks(): void
```

清除已完成的上传任务。

**示例:**

```typescript
uploader.clearCompletedTasks();
```

#### use

```typescript
use(plugin: IPlugin): this
```

使用插件。

**参数:**

- `plugin`: 实现了IPlugin接口的插件实例

**返回值:**

- `this`: 上传器实例，用于链式调用

**示例:**

```typescript
import { ChunkUploadPlugin } from '@file-chunk-uploader/chunk';

uploader.use(new ChunkUploadPlugin({ chunkSize: 2 * 1024 * 1024 }));
```

#### on

```typescript
on(eventName: string, handler: (data: any) => void, options?: any): this
```

添加事件监听器。

**参数:**

- `eventName`: 事件名称
- `handler`: 事件处理函数
- `options`: 事件选项（可选）

**返回值:**

- `this`: 上传器实例，用于链式调用

**示例:**

```typescript
import { EventName } from '@file-chunk-uploader/types';

uploader.on(EventName.UPLOAD_PROGRESS, event => {
  console.log(`上传进度: ${event.progress.percentage}%`);
});
```

#### once

```typescript
once(eventName: string, handler: (data: any) => void, options?: any): this
```

添加一次性事件监听器（触发一次后自动移除）。

**参数:**

- `eventName`: 事件名称
- `handler`: 事件处理函数
- `options`: 事件选项（可选）

**返回值:**

- `this`: 上传器实例，用于链式调用

**示例:**

```typescript
uploader.once(EventName.UPLOAD_SUCCESS, event => {
  console.log('首次上传成功:', event);
});
```

#### off

```typescript
off(eventName: string, handler?: (data: any) => void): this
```

移除事件监听器。

**参数:**

- `eventName`: 事件名称
- `handler`: 事件处理函数，如果不传则移除该事件的所有监听器

**返回值:**

- `this`: 上传器实例，用于链式调用

**示例:**

```typescript
const progressHandler = event => console.log(`上传进度: ${event.progress.percentage}%`);

// 添加监听器
uploader.on(EventName.UPLOAD_PROGRESS, progressHandler);

// 移除特定监听器
uploader.off(EventName.UPLOAD_PROGRESS, progressHandler);

// 移除事件所有监听器
uploader.off(EventName.UPLOAD_PROGRESS);
```

#### setConfig

```typescript
setConfig(config: Partial<IUploadConfig>): this
```

更新上传配置。

**参数:**

- `config`: 新配置，会与现有配置合并

**返回值:**

- `this`: 上传器实例，用于链式调用

**示例:**

```typescript
uploader.setConfig({
  headers: {
    Authorization: `Bearer ${token}`,
  },
});
```

#### cleanup

```typescript
async cleanup(): Promise<void>
```

清理资源并销毁上传器实例。

**返回值:**

- `Promise<void>`: 完成清理的Promise

**示例:**

```typescript
await uploader.cleanup();
```

### 事件

核心包会触发以下事件：

| 事件名称               | 说明                 | 数据结构                                                                             |
| ---------------------- | -------------------- | ------------------------------------------------------------------------------------ |
| `file:added`           | 文件添加时触发       | `{ file: IFileInfo }`                                                                |
| `file:removed`         | 文件移除时触发       | `{ file: IFileInfo }`                                                                |
| `files:added`          | 多文件添加时触发     | `{ files: IFileInfo[] }`                                                             |
| `upload:start`         | 开始上传文件         | `{ file: IFileInfo, startTime: number }`                                             |
| `upload:progress`      | 上传进度更新         | `{ file: IFileInfo, progress: IUploadProgress }`                                     |
| `upload:success`       | 上传成功             | `{ file: IFileInfo, result: IUploadResult, completeTime: number, duration: number }` |
| `upload:error`         | 上传失败             | `{ file: IFileInfo, error: Error, recoverable: boolean }`                            |
| `upload:complete`      | 上传完成(成功或失败) | 同success或error事件                                                                 |
| `upload:pause`         | 上传暂停             | `{ file: IFileInfo }`                                                                |
| `upload:resume`        | 上传恢复             | `{ file: IFileInfo }`                                                                |
| `upload:cancel`        | 上传取消             | `{ file: IFileInfo }`                                                                |
| `uploader:initialized` | 上传器初始化完成     | `{ timestamp: number }`                                                              |
| `uploader:destroyed`   | 上传器销毁           | `{ timestamp: number }`                                                              |

## UploaderTask 类

`UploaderTask`代表一个文件上传任务。通常由`FileUploader`内部创建，不直接实例化。

### 方法

#### start

```typescript
async start(): Promise<IUploadResult>
```

开始上传任务。

**返回值:**

- `Promise<IUploadResult>`: 上传结果Promise

#### pause

```typescript
pause(): void
```

暂停上传任务。

#### resume

```typescript
resume(): void
```

恢复上传任务。

#### cancel

```typescript
cancel(): void
```

取消上传任务。

#### getFile

```typescript
getFile(): File | Blob
```

获取上传文件。

**返回值:**

- `File | Blob`: 上传的文件或Blob对象

#### getStatus

```typescript
getStatus(): string
```

获取任务状态。

**返回值:**

- `string`: 任务状态

#### getProgress

```typescript
getProgress(): number
```

获取上传进度。

**返回值:**

- `number`: 上传进度百分比(0-100)

#### getTimeElapsed

```typescript
getTimeElapsed(): number
```

获取任务已运行时间。

**返回值:**

- `number`: 已运行时间(毫秒)

## 配置选项

见 `@file-chunk-uploader/types` 中的 `IUploadConfig` 接口。

## 更多文档

- [事件系统](./events.md)
- [插件系统](./plugins.md)
- [开发者模式](./dev-mode.md)
- [类型定义](./types.md)
