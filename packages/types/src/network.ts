/**
 * 网络相关类型定义
 * 包含网络请求、响应和适配器接口
 * @packageDocumentation
 */

/**
 * 请求方法类型
 * HTTP请求方法枚举
 */
export type RequestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD' | 'OPTIONS' | 'PATCH';

/**
 * 请求配置接口
 * 描述发送网络请求的配置选项
 */
export interface IRequestConfig {
  /** 请求URL */
  url: string;
  /** 请求方法 */
  method?: RequestMethod;
  /** 请求头 */
  headers?: Record<string, string>;
  /** 请求体 */
  body?: unknown;
  /** 查询参数 */
  params?: Record<string, string>;
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 是否跨域 */
  withCredentials?: boolean;
  /** 重试次数 */
  retryCount?: number;
  /** 重试延迟（毫秒） */
  retryDelay?: number;
  /** 响应类型 */
  responseType?: 'json' | 'text' | 'blob' | 'arraybuffer';
  /** 是否使用表单数据 */
  useFormData?: boolean;
  /** 自定义请求ID */
  requestId?: string;
  /** 中止控制器 */
  abortController?: AbortController;
  /** 进度回调 */
  onProgress?: (progress: IProgressEvent) => void;
  /** 上传进度回调 */
  onUploadProgress?: (progress: IProgressEvent) => void;
  /** 下载进度回调 */
  onDownloadProgress?: (progress: IProgressEvent) => void;
  /** 自定义标签（用于跟踪或分类请求） */
  tags?: string[];
  /** 自定义参数 */
  [key: string]: unknown;
}

/**
 * 进度事件接口
 * 描述网络请求的进度信息
 */
export interface IProgressEvent {
  /** 已加载字节数 */
  loaded: number;
  /** 总字节数 */
  total: number;
  /** 完成百分比 */
  percent: number;
  /** 传输速度（字节/秒） */
  speed?: number;
  /** 是否完成 */
  completed: boolean;
  /** 事件方向 */
  direction: 'upload' | 'download';
  /** 请求ID */
  requestId: string;
}

/**
 * 响应接口
 * 描述网络请求的响应数据
 */
export interface IResponse<T = unknown> {
  /** 响应数据 */
  data: T;
  /** 状态码 */
  status: number;
  /** 状态文本 */
  statusText: string;
  /** 响应头 */
  headers: Record<string, string>;
  /** 请求配置 */
  config: IRequestConfig;
  /** 请求ID */
  requestId: string;
  /** 响应时间戳 */
  timestamp: number;
  /** 请求耗时（毫秒） */
  duration: number;
  /** 原始响应对象 */
  originalResponse?: unknown;
}

/**
 * 网络错误接口
 * 描述网络请求过程中的错误
 */
export interface INetworkError extends Error {
  /** 错误码 */
  code?: string;
  /** 状态码 */
  status?: number;
  /** 请求配置 */
  config?: IRequestConfig;
  /** 请求ID */
  requestId?: string;
  /** 是否可重试 */
  retryable?: boolean;
  /** 已重试次数 */
  retryCount?: number;
  /** 响应对象（如果有） */
  response?: IResponse;
  /** 是否被中止 */
  aborted?: boolean;
  /** 是否超时 */
  timeout?: boolean;
  /** 网络错误（如离线） */
  networkError?: boolean;
}

/**
 * 网络适配器接口
 * 提供不同的网络请求实现
 */
export interface INetworkAdapter {
  /**
   * 发送请求
   * @param config 请求配置
   * @returns 响应Promise
   */
  request<T = unknown>(config: IRequestConfig): Promise<IResponse<T>>;

  /**
   * 发送GET请求
   * @param url 请求URL
   * @param config 请求配置
   * @returns 响应Promise
   */
  get<T = unknown>(
    url: string,
    config?: Omit<IRequestConfig, 'url' | 'method'>,
  ): Promise<IResponse<T>>;

  /**
   * 发送POST请求
   * @param url 请求URL
   * @param data 请求数据
   * @param config 请求配置
   * @returns 响应Promise
   */
  post<T = unknown>(
    url: string,
    data?: unknown,
    config?: Omit<IRequestConfig, 'url' | 'method' | 'body'>,
  ): Promise<IResponse<T>>;

  /**
   * 发送PUT请求
   * @param url 请求URL
   * @param data 请求数据
   * @param config 请求配置
   * @returns 响应Promise
   */
  put<T = unknown>(
    url: string,
    data?: unknown,
    config?: Omit<IRequestConfig, 'url' | 'method' | 'body'>,
  ): Promise<IResponse<T>>;

  /**
   * 发送DELETE请求
   * @param url 请求URL
   * @param config 请求配置
   * @returns 响应Promise
   */
  delete<T = unknown>(
    url: string,
    config?: Omit<IRequestConfig, 'url' | 'method'>,
  ): Promise<IResponse<T>>;

  /**
   * 中止请求
   * @param requestId 请求ID
   */
  abort(requestId: string): void;

  /**
   * 中止所有请求
   */
  abortAll(): void;

  /**
   * 清理资源
   */
  cleanup(): void;
}

/**
 * 网络检测器接口
 * 检测和监控网络状态变化
 */
export interface INetworkDetector {
  /**
   * 获取当前网络状态
   * @returns 网络状态信息
   */
  getCurrentNetwork(): INetworkInfo;

  /**
   * 监听网络变化
   * @param callback 网络变化回调
   * @returns 取消监听的函数
   */
  onNetworkChange(callback: (network: INetworkInfo) => void): () => void;

  /**
   * 测量网络速度
   * @returns 网络速度Promise（Mbps）
   */
  measureNetworkSpeed(): Promise<number>;

  /**
   * 检测是否在线
   * @returns 是否在线
   */
  isOnline(): boolean;

  /**
   * 开始监听
   */
  startMonitoring(): void;

  /**
   * 停止监听
   */
  stopMonitoring(): void;
}

/**
 * 网络信息接口
 * 描述当前网络状态
 */
export interface INetworkInfo {
  /** 是否在线 */
  online: boolean;
  /** 网络类型 */
  type: 'wifi' | 'cellular' | 'ethernet' | 'unknown';
  /** 网络速度（Mbps） */
  speed: number;
  /** 往返延迟（毫秒） */
  rtt: number;
  /** 有效连接类型 */
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
  /** 带宽估计（Mbps） */
  downlink?: number;
  /** 最大带宽（Mbps） */
  downlinkMax?: number;
  /** 是否保存数据模式 */
  saveData?: boolean;
  /** 上次更新时间 */
  lastUpdate: number;
}

/**
 * 自适应上传配置接口
 * 配置上传参数的自适应调整
 */
export interface IAdaptiveConfig {
  /** 基础分片大小（字节） */
  baseChunkSize: number;
  /** 基础并发数 */
  baseConcurrency: number;
  /** 最小分片大小（字节） */
  minChunkSize: number;
  /** 最大分片大小（字节） */
  maxChunkSize: number;
  /** 最小并发数 */
  minConcurrency: number;
  /** 最大并发数 */
  maxConcurrency: number;
  /** 自动调整设置 */
  autoAdjust?: boolean;
  /** 调整间隔（毫秒） */
  adjustInterval?: number;
  /** 网络变化触发调整 */
  adjustOnNetworkChange?: boolean;
}

/**
 * 上传设置接口
 * 当前优化的上传参数
 */
export interface IUploadSettings {
  /** 分片大小（字节） */
  chunkSize: number;
  /** 并发上传数 */
  concurrency: number;
}
