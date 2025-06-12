# @file-chunk-uploader/types 类型系统文档

本文档详细介绍了`@file-chunk-uploader/types`包中定义的核心类型系统，为整个库提供类型安全和一致性保证。

## 核心接口

### IFileUploader

文件上传器接口，定义了上传组件的公共API。

```typescript
interface IFileUploader {
  upload(file: File | Blob, options?: Partial<IUploadConfig>): Promise<IUploadResult>;
  uploadMultiple(
    files: Array<File | Blob>,
    options?: Partial<IUploadConfig>,
  ): Promise<IUploadResult[]>;
  uploadObservable(file: File | Blob, options?: Partial<IUploadConfig>): Observable<number>;
  pause(fileId?: string): void;
  resume(fileId?: string): void;
  cancel(fileId?: string): void;
  getStatus(fileId: string): string;
  getProgress(fileId: string): number;
  getTasks(): IUploadTask[];
  getTask(fileId: string): IUploadTask | undefined;
  clearCompletedTasks(): void;
  use(plugin: IPlugin): this;
  on(eventName: string, handler: (data: any) => void, options?: any): this;
  once(eventName: string, handler: (data: any) => void, options?: any): this;
  off(eventName: string, handler?: (data: any) => void): this;
  setConfig(config: Partial<IUploadConfig>): this;
}
```

### IFileUploaderCore

文件上传器核心接口，扩展自IFileUploader，定义内部使用的API。

```typescript
interface IFileUploaderCore extends IFileUploader {
  config: IUploadConfig;
  pluginManager: IPluginManager;
  eventEmitter: IEventEmitter;
  strategies: Map<string, any>;
  networkAdapter?: INetworkAdapter;
  storageManager?: IStorageManager;
  logger?: Logger;
  apiVersion: string;
  registerHook(hookName: string, handler: (...args: any[]) => any): void;
  removeHook(hookName: string, handler?: (...args: any[]) => any): void;
  executeHook(hookName: string, ...args: any[]): Promise<any>;
  cleanup(): Promise<void>;
}
```

### IUploadTask

上传任务接口，代表单个文件的上传过程。

```typescript
interface IUploadTask {
  id: string;
  start(): Promise<IUploadResult>;
  pause(): void;
  resume(): void;
  cancel(): void;
  getFile(): File | Blob;
  getStatus(): string;
  getProgress(): number;
  getTimeElapsed(): number;
}
```

### IEventEmitter

事件发射器接口，提供事件订阅和发布功能。

```typescript
interface IEventEmitter {
  on<T>(eventName: string, handler: EventHandler<T>, options?: IEventOptions): this;
  once<T>(eventName: string, handler: EventHandler<T>, options?: Omit<IEventOptions, 'once'>): this;
  off(eventName: string, handler?: EventHandler<unknown>): this;
  emit<T>(eventName: string, data?: T, options?: IEventEmitOptions): boolean | Promise<void>;
  emitSync<TData = unknown>(
    event: string,
    data?: TData,
    options?: Omit<IEventEmitOptions, 'sync'>,
  ): void;
  onBatch<TData = unknown>(
    events: string[],
    handler: EventHandler<TData>,
    options?: IEventOptions,
  ): Array<() => void>;
  listeners(eventName: string): Array<IEventListener>;
  hasListeners(eventName: string): boolean;
  removeAllListeners(eventName?: string): this;
  getEventNames(): string[];
  createNamespacedEmitter(namespace: Namespace): IEventEmitter;
}
```

### IPlugin

插件接口，定义插件系统的基本结构。

```typescript
interface IPlugin {
  name: string;
  version: string;
  install(uploader: IFileUploaderCore, eventEmitter: IEventEmitter, options?: any): void;
  uninstall?(): void;
}
```

## 基本类型

### IFileInfo

文件信息接口，包含文件的基本属性。

```typescript
interface IFileInfo {
  id: string;
  name: string;
  size: number;
  type: string;
  lastModified: number;
  meta?: Record<string, unknown>;
}
```

### IUploadResult

上传结果接口，描述上传完成后的状态。

```typescript
interface IUploadResult {
  success: boolean;
  file: IFileInfo;
  response?: Record<string, unknown>;
  error?: Error;
  totalTime?: number;
  uploadUrl?: string;
}
```

### IUploadProgress

上传进度接口，描述上传过程中的进度信息。

```typescript
interface IUploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  speed?: number;
  remainingTime?: number;
  startTime: number;
  lastUpdateTime: number;
}
```

## 配置接口

### IUploadConfig

上传配置接口，包含所有上传器配置选项。

```typescript
interface IUploadConfig {
  target: string;
  method?: 'POST' | 'PUT';
  headers?: Record<string, string>;
  formData?: Record<string, unknown>;
  timeout?: number;
  useFormData?: boolean;
  fileFieldName?: string;
  chunk?: IChunkConfig;
  retry?: IRetryConfig;
  storage?: IStorageConfig;
  devMode?: IDevModeConfig | boolean;
  resumable?: boolean;
  fastUpload?: boolean;
  fileFilter?: (file: File) => boolean | Promise<boolean>;
  onProgress?: (progress: number) => void;
  onStatusChange?: (status: string) => void;
  onError?: (error: Error) => void;
  onSuccess?: (result: Record<string, unknown>) => void;
  beforeUpload?: (file: File) => File | Promise<File> | false | Promise<false>;
  afterUpload?: (result: Record<string, unknown>) => void;
  apiVersion?: string;
  preprocessors?: Array<(file: File) => File | Promise<File>>;
  postprocessors?: Array<(result: any) => any | Promise<any>>;
}
```

### IChunkConfig

分片上传配置接口。

```typescript
interface IChunkConfig {
  chunkSize?: number;
  concurrency?: number;
  sequential?: boolean;
  indexBase?: 0 | 1;
  chunkSizeStrategy?: 'fixed' | 'adaptive';
}
```

### IRetryConfig

重试配置接口。

```typescript
interface IRetryConfig {
  enabled?: boolean;
  maxRetries?: number;
  maxRetriesPerChunk?: number;
  baseDelay?: number;
  maxDelay?: number;
  useExponentialBackoff?: boolean;
  useSmartDecision?: boolean;
  minSuccessRate?: number;
  networkQualityThreshold?: {
    minSpeed?: number;
    maxRtt?: number;
  };
  errorTypeRetries?: {
    network?: number;
    server?: number;
    timeout?: number;
    unknown?: number;
  };
  persistRetryState?: boolean;
  notifyOnRetry?: boolean;
}
```

### IStorageConfig

存储配置接口。

```typescript
interface IStorageConfig {
  type?: 'localStorage' | 'indexedDB' | 'memory';
  dbName?: string;
  storeName?: string;
  keyPrefix?: string;
  expiration?: number;
  enabled?: boolean;
}
```

### IDevModeConfig

开发者模式配置接口。

```typescript
interface IDevModeConfig {
  enabled: boolean;
  logger?: ILoggerConfig;
  performanceMonitoring?: boolean;
  networkLogging?: boolean;
  workerLogging?: boolean;
  pluginTracing?: boolean;
}
```

## 枚举类型

### EventName

事件名称枚举，定义系统中所有可能的事件类型。

```typescript
enum EventName {
  // 上传生命周期事件
  UPLOAD_START = 'upload:start',
  UPLOAD_PROGRESS = 'upload:progress',
  UPLOAD_SUCCESS = 'upload:success',
  UPLOAD_ERROR = 'upload:error',
  UPLOAD_COMPLETE = 'upload:complete',
  UPLOAD_PAUSE = 'upload:pause',
  UPLOAD_RESUME = 'upload:resume',
  UPLOAD_CANCEL = 'upload:cancel',

  // 分片上传事件
  CHUNK_START = 'chunk:start',
  CHUNK_PROGRESS = 'chunk:progress',
  CHUNK_SUCCESS = 'chunk:success',
  CHUNK_ERROR = 'chunk:error',
  CHUNK_COMPLETE = 'chunk:complete',

  // 重试事件
  RETRY_START = 'retry:start',
  RETRY_SUCCESS = 'retry:success',
  RETRY_FAILED = 'retry:failed',
  // ...更多事件省略
}
```

### UploadStatus

上传状态枚举，定义文件上传过程中的各种状态。

```typescript
enum UploadStatus {
  PENDING = 'pending',
  UPLOADING = 'uploading',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  ERROR = 'error',
  CANCELLED = 'cancelled',
}
```

### LogLevel

日志级别枚举，定义日志输出的不同级别。

```typescript
enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  SILENT = 'silent',
}
```

## 事件类型

每种事件都有对应的类型定义，例如：

### IUploadProgressEvent

上传进度事件数据类型。

```typescript
interface IUploadProgressEvent {
  file: IFileInfo;
  progress: IUploadProgress;
}
```

### IUploadSuccessEvent

上传成功事件数据类型。

```typescript
interface IUploadSuccessEvent {
  file: IFileInfo;
  result: IUploadResult;
  completeTime: number;
  duration: number;
}
```

### IUploadErrorEvent

上传失败事件数据类型。

```typescript
interface IUploadErrorEvent {
  file: IFileInfo;
  error: Error;
  recoverable: boolean;
}
```

## 高级接口

### INetworkAdapter

网络请求适配器接口，用于发送网络请求。

```typescript
interface INetworkAdapter {
  send(options: IRequestOptions): Promise<IResponseData>;
  abort(requestId: string): void;
  setDefaultOptions(options: Partial<IRequestOptions>): void;
  getNetworkStatus(): Promise<INetworkStatus>;
}
```

### IStorageManager

存储管理器接口，用于持久化数据。

```typescript
interface IStorageManager {
  save<T>(key: string, value: T): Promise<void>;
  load<T>(key: string): Promise<T | null>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
}
```

### IPluginManager

插件管理器接口，用于管理插件生命周期。

```typescript
interface IPluginManager {
  install(plugin: IPlugin, options?: any): void;
  uninstall(pluginName: string): void;
  getPlugin(name: string): IPlugin | undefined;
  hasPlugin(name: string): boolean;
  getInstalledPlugins(): IPlugin[];
}
```

## 类型工具

### Namespace

命名空间类型。

```typescript
type Namespace = string;
```

### NamespacedEvent

命名空间格式化工具类型。

```typescript
type NamespacedEvent<T extends string> = `${Namespace}:${T}`;
```

## 使用示例

```typescript
import { IFileUploader, IUploadConfig, EventName, UploadStatus } from '@file-chunk-uploader/types';

// 创建配置对象
const config: Partial<IUploadConfig> = {
  target: 'https://api.example.com/upload',
  method: 'POST',
  chunk: {
    chunkSize: 1024 * 1024, // 1MB
    concurrency: 3,
  },
  retry: {
    enabled: true,
    maxRetries: 3,
  },
};

// 使用类型定义API
function uploadFile(uploader: IFileUploader, file: File): void {
  uploader.on(EventName.UPLOAD_PROGRESS, event => {
    console.log(`上传进度: ${event.progress.percentage}%`);
  });

  uploader
    .upload(file, config)
    .then(result => {
      if (result.success) {
        console.log('上传成功', result);
      }
    })
    .catch(error => {
      console.error('上传失败', error);
    });
}
```
