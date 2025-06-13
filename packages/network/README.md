# @file-chunk-uploader/network

网络模块提供了灵活的网络请求机制和网络状态检测功能，是文件上传器的核心组件之一。

## 功能特点

- **多种适配器支持**：内置Fetch和XHR适配器，满足不同环境需求
- **自定义适配器**：支持自定义网络请求适配器
- **事件系统**：提供完整的网络事件通知机制
- **请求代理**：增强请求功能，支持中断、超时等
- **开发者模式**：详细的网络请求日志和调试信息
- **网络状态检测**：监测网络连接状态变化
- **拦截器支持**：请求和响应拦截器
- **重试机制**：智能请求重试策略

## 安装

```bash
npm install @file-chunk-uploader/network
# 或
pnpm add @file-chunk-uploader/network
```

## 基本用法

### 作为插件使用

```typescript
import { FileUploader } from '@file-chunk-uploader/core';
import { fetchAdapter } from '@file-chunk-uploader/network';

// 创建上传器实例
const uploader = new FileUploader({
  target: 'https://api.example.com/upload',
});

// 使用Fetch适配器插件
uploader.use(
  fetchAdapter({
    devMode: {
      enableLogging: true, // 启用网络请求日志
    },
    events: {
      enable: true, // 启用网络事件
    },
  }),
);

// 监听网络事件
uploader.on('network:request', event => {
  console.log('请求开始:', event.id);
});

uploader.on('network:response', event => {
  console.log('请求成功:', event.id, `耗时: ${event.time}ms`);
});

uploader.on('network:error', event => {
  console.error('请求失败:', event.id, event.error.message);
});
```

### 直接使用适配器

```typescript
import { FetchAdapter, XhrAdapter } from '@file-chunk-uploader/network';

// 创建Fetch适配器实例
const fetchAdapter = new FetchAdapter();

// 发送GET请求
const response = await fetchAdapter.get('https://api.example.com/files');

// 发送POST请求
const uploadResponse = await fetchAdapter.post('https://api.example.com/upload', {
  name: 'test.txt',
  content: 'base64-encoded-content',
});

// 使用XHR适配器发送带进度回调的请求
const xhrAdapter = new XhrAdapter();
const formData = new FormData();
formData.append('file', new File(['test content'], 'test.txt'));

const response = await xhrAdapter.request({
  url: 'https://api.example.com/upload',
  method: 'POST',
  body: formData,
  onUploadProgress: event => {
    console.log(`上传进度: ${Math.round((event.loaded / event.total) * 100)}%`);
  },
});
```

### 使用自定义适配器

```typescript
import { customAdapter } from '@file-chunk-uploader/network';
import { IRequestConfig, IResponse } from '@file-chunk-uploader/types';

// 创建自定义适配器
const myAdapter = {
  request: async <T>(config: IRequestConfig): Promise<IResponse<T>> => {
    // 自定义请求实现
    console.log('发送请求:', config.url);

    // 返回符合IResponse接口的对象
    return {
      status: 200,
      statusText: 'OK',
      data: { success: true } as unknown as T,
      headers: {},
      config,
      requestId: config.requestId || 'default-id',
      timestamp: Date.now(),
      duration: 500,
    };
  },

  // 实现其他必要的方法
  get: async <T>(url: string, config?: IRequestConfig): Promise<IResponse<T>> => {
    return this.request<T>({ ...config, url, method: 'GET' });
  },

  post: async <T>(url: string, data?: unknown, config?: IRequestConfig): Promise<IResponse<T>> => {
    return this.request<T>({ ...config, url, method: 'POST', body: data });
  },

  put: async <T>(url: string, data?: unknown, config?: IRequestConfig): Promise<IResponse<T>> => {
    return this.request<T>({ ...config, url, method: 'PUT', body: data });
  },

  delete: async <T>(url: string, config?: IRequestConfig): Promise<IResponse<T>> => {
    return this.request<T>({ ...config, url, method: 'DELETE' });
  },

  abort: (requestId: string): void => {
    console.log('请求已中止:', requestId);
  },

  abortAll: (): void => {
    console.log('所有请求已中止');
  },

  cleanup: (): void => {
    console.log('资源已清理');
  },
};

// 使用自定义适配器插件
uploader.use(customAdapter(myAdapter));
```

## API参考

### 插件

#### `fetchAdapter(config?: INetworkPluginConfig): IPlugin`

创建基于Fetch API的网络适配器插件。

#### `xhrAdapter(config?: INetworkPluginConfig): IPlugin`

创建基于XMLHttpRequest的网络适配器插件。

#### `customAdapter(adapter: INetworkAdapter, config?: INetworkPluginConfig): IPlugin`

创建基于自定义适配器的网络插件。

### 适配器

#### `FetchAdapter`

基于Fetch API的网络适配器实现。

```typescript
const adapter = new FetchAdapter();
```

#### `XhrAdapter`

基于XMLHttpRequest的网络适配器实现。

```typescript
const adapter = new XhrAdapter();
```

### 配置选项

```typescript
interface INetworkPluginConfig {
  /** 网络适配器 */
  adapter?: INetworkAdapter;
  /** 适配器类型 */
  adapterType?: 'fetch' | 'xhr' | 'custom';
  /** 开发者模式配置 */
  devMode?: {
    /** 是否启用网络日志 */
    enableLogging?: boolean;
    /** 日志级别 */
    logLevel?: 'debug' | 'info' | 'warn' | 'error';
    /** 是否包含请求体数据(可能很大) */
    includeRequestBody?: boolean;
    /** 是否包含响应体数据(可能很大) */
    includeResponseData?: boolean;
  };
  /** 事件配置 */
  events?: {
    /** 是否启用网络事件 */
    enable?: boolean;
    /** 自定义事件名前缀 */
    prefix?: string;
  };
  /** 请求处理配置 */
  requestHandling?: {
    /** 是否自动序列化JSON请求 */
    autoSerializeJson?: boolean;
    /** 是否自动处理表单数据 */
    autoHandleFormData?: boolean;
  };
}
```

### 事件

网络模块触发的事件：

- `network:request` - 请求开始时触发
- `network:response` - 请求成功响应时触发
- `network:error` - 请求发生错误时触发
- `network:abort` - 请求被中止时触发
- `network:timeout` - 请求超时时触发
- `network:upload:progress` - 上传进度更新时触发
- `network:download:progress` - 下载进度更新时触发
- `network:status:change` - 网络状态变化时触发

## 高级功能

### 网络状态检测

```typescript
import { NetworkDetector } from '@file-chunk-uploader/network';

const detector = new NetworkDetector();

// 监听网络状态变化
detector.onNetworkChange(network => {
  console.log('网络状态变化:', network.online ? '在线' : '离线');
  console.log('网络类型:', network.type);
  console.log('网络速度:', network.speed, 'Mbps');
});

// 获取当前网络状态
const currentNetwork = detector.getCurrentNetwork();
```

### 请求拦截器

```typescript
import { createInterceptor } from '@file-chunk-uploader/network/interceptor';

// 创建请求拦截器
const interceptor = createInterceptor();

// 添加请求拦截器
interceptor.request.use(
  config => {
    // 在发送请求之前做些什么
    config.headers = {
      ...config.headers,
      Authorization: 'Bearer token',
    };
    return config;
  },
  error => {
    // 对请求错误做些什么
    return Promise.reject(error);
  },
);

// 添加响应拦截器
interceptor.response.use(
  response => {
    // 对响应数据做些什么
    return response;
  },
  error => {
    // 对响应错误做些什么
    return Promise.reject(error);
  },
);

// 应用拦截器到适配器
const adapter = new FetchAdapter();
adapter.applyInterceptor(interceptor);
```

### 请求重试

```typescript
import { createRetryStrategy } from '@file-chunk-uploader/network/retry';

// 创建重试策略
const retryStrategy = createRetryStrategy({
  maxRetries: 3,
  retryDelay: 1000,
  retryCondition: error => {
    // 只有网络错误才重试
    return error.networkError === true;
  },
});

// 应用重试策略到适配器
const adapter = new FetchAdapter();
adapter.applyRetryStrategy(retryStrategy);
```

## 许可证

MIT
