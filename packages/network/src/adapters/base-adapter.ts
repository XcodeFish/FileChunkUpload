/**
 * 网络适配器基础抽象类
 * 提供网络请求的通用实现和抽象方法
 */
import { Logger } from '@file-chunk-uploader/core';
import {
  INetworkAdapter,
  IRequestConfig,
  IResponse,
  IProgressEvent,
  INetworkError,
} from '@file-chunk-uploader/types';

/**
 * 网络错误类型
 */
export enum NetworkErrorType {
  /** 网络错误 */
  NETWORK_ERROR = 'network_error',
  /** 请求超时 */
  TIMEOUT = 'timeout',
  /** 请求中止 */
  ABORTED = 'aborted',
  /** 服务器错误 */
  SERVER_ERROR = 'server_error',
  /** 客户端错误 */
  CLIENT_ERROR = 'client_error',
  /** 解析错误 */
  PARSE_ERROR = 'parse_error',
  /** 未知错误 */
  UNKNOWN_ERROR = 'unknown_error',
}

/**
 * 扩展网络错误接口
 */
export interface IExtendedNetworkError extends INetworkError {
  /** 错误类型 */
  errorType?: NetworkErrorType;
}

/**
 * 网络适配器基础抽象类
 * 实现INetworkAdapter接口的通用方法，特定实现由子类完成
 */
export abstract class BaseNetworkAdapter implements INetworkAdapter {
  /** 请求映射表 */
  protected requestMap: Map<string, { abortController: AbortController }> = new Map();
  /** 日志记录器 */
  protected logger?: Logger;

  /**
   * 构造函数
   * @param logger 可选的日志记录器
   */
  constructor(logger?: Logger) {
    this.logger = logger;
  }

  /**
   * 发送请求抽象方法，由子类实现
   * @param config 请求配置
   * @returns 响应Promise
   */
  abstract request<T = unknown>(config: IRequestConfig): Promise<IResponse<T>>;

  /**
   * 发送GET请求
   * @param url 请求URL
   * @param config 请求配置
   * @returns 响应Promise
   */
  get<T = unknown>(
    url: string,
    config?: Omit<IRequestConfig, 'url' | 'method'>,
  ): Promise<IResponse<T>> {
    return this.request<T>({
      url,
      method: 'GET',
      ...config,
    });
  }

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
  ): Promise<IResponse<T>> {
    return this.request<T>({
      url,
      method: 'POST',
      body: data,
      ...config,
    });
  }

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
  ): Promise<IResponse<T>> {
    return this.request<T>({
      url,
      method: 'PUT',
      body: data,
      ...config,
    });
  }

  /**
   * 发送DELETE请求
   * @param url 请求URL
   * @param config 请求配置
   * @returns 响应Promise
   */
  delete<T = unknown>(
    url: string,
    config?: Omit<IRequestConfig, 'url' | 'method'>,
  ): Promise<IResponse<T>> {
    return this.request<T>({
      url,
      method: 'DELETE',
      ...config,
    });
  }

  /**
   * 中止请求
   * @param requestId 请求ID
   */
  abort(requestId: string): void {
    const request = this.requestMap.get(requestId);
    if (request) {
      request.abortController.abort();
      this.requestMap.delete(requestId);
      this.logger?.debug('network', `请求已中止: ${requestId}`);
    }
  }

  /**
   * 中止所有请求
   */
  abortAll(): void {
    this.requestMap.forEach((request, requestId) => {
      request.abortController.abort();
      this.logger?.debug('network', `请求已中止: ${requestId}`);
    });
    this.requestMap.clear();
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.abortAll();
    this.logger?.debug('network', '网络适配器资源已清理');
  }

  /**
   * 生成请求ID
   * @returns 唯一请求ID
   */
  protected generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * 处理请求配置
   * @param config 原始请求配置
   * @returns 处理后的请求配置
   */
  protected processConfig(config: IRequestConfig): IRequestConfig {
    // 确保requestId存在
    const requestId = config.requestId || this.generateRequestId();

    // 创建AbortController如果不存在
    const abortController = config.abortController || new AbortController();

    // 添加到请求映射
    this.requestMap.set(requestId, { abortController });

    // 返回处理后的配置
    return {
      ...config,
      requestId,
      abortController,
    };
  }

  /**
   * 从请求映射中删除请求
   * @param requestId 请求ID
   */
  protected removeRequest(requestId: string): void {
    this.requestMap.delete(requestId);
  }

  /**
   * 创建网络错误
   * @param message 错误信息
   * @param config 请求配置
   * @param details 错误详情
   * @returns 网络错误对象
   */
  protected createNetworkError(
    message: string,
    config: IRequestConfig,
    details?: Partial<IExtendedNetworkError>,
  ): IExtendedNetworkError {
    // 使用类型断言创建错误对象
    const error = new Error(message) as IExtendedNetworkError;

    // 设置基本错误信息
    error.config = config;
    error.requestId = config.requestId;
    error.retryable = details?.retryable ?? true;

    // 设置错误类型
    if (details?.errorType) {
      error.errorType = details.errorType;
    } else {
      // 默认错误类型
      error.errorType = NetworkErrorType.UNKNOWN_ERROR;
    }

    // 复制其他详情
    if (details) {
      // 使用类型安全的方式复制属性
      const propertiesToCopy: Array<keyof IExtendedNetworkError> = [
        'status',
        'response',
        'aborted',
        'timeout',
        'networkError',
      ];

      for (const prop of propertiesToCopy) {
        if (prop in details && details[prop] !== undefined) {
          (error as any)[prop] = details[prop];
        }
      }
    }

    this.logger?.error('network', `请求错误: ${message}`, {
      requestId: config.requestId,
      url: config.url,
      method: config.method,
      errorType: error.errorType,
      retryable: error.retryable,
      status: error.status,
    });

    return error;
  }

  /**
   * 处理进度事件
   * @param event 原始进度事件
   * @param requestId 请求ID
   * @param direction 传输方向
   * @returns 处理后的进度事件
   */
  protected createProgressEvent(
    event: ProgressEvent,
    requestId: string,
    direction: 'upload' | 'download',
  ): IProgressEvent {
    const { loaded, total } = event;
    const completed = loaded === total && total > 0;
    const percent = total > 0 ? Math.min(100, Math.floor((loaded / total) * 100)) : 0;

    const progressEvent: IProgressEvent = {
      loaded,
      total,
      percent,
      completed,
      direction,
      requestId,
    };

    this.logger?.debug('network', `${direction === 'upload' ? '上传' : '下载'}进度: ${percent}%`, {
      progressEvent,
    });

    return progressEvent;
  }
}
