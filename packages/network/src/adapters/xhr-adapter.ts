/**
 * XHR适配器实现
 * 基于XMLHttpRequest的网络请求适配器
 */
import { Logger } from '@file-chunk-uploader/core';
import { IRequestConfig, IResponse, IProgressEvent } from '@file-chunk-uploader/types';

import { BaseNetworkAdapter, NetworkErrorType } from './base-adapter';

/**
 * XhrAdapter类
 * 基于XMLHttpRequest实现的网络请求适配器
 */
export class XhrAdapter extends BaseNetworkAdapter {
  /**
   * 构造函数
   * @param logger 可选的日志记录器
   */
  constructor(logger?: Logger) {
    super(logger);
  }

  /**
   * 发送请求
   * @param config 请求配置
   * @returns 响应Promise
   */
  request<T = unknown>(config: IRequestConfig): Promise<IResponse<T>> {
    // 处理配置，确保requestId和abortController存在
    const processedConfig = this.processConfig(config);
    const requestId = processedConfig.requestId || '';

    return new Promise<IResponse<T>>((resolve, reject) => {
      // 创建XHR对象
      const xhr = new XMLHttpRequest();
      const { url, method = 'GET', headers = {}, body, params } = processedConfig;

      // 构建完整URL
      const fullUrl = this.buildUrl(url, params);

      // 打开连接
      xhr.open(method, fullUrl, true);

      // 设置responseType
      if (processedConfig.responseType) {
        switch (processedConfig.responseType) {
          case 'json':
            xhr.responseType = 'json';
            break;
          case 'text':
            xhr.responseType = 'text';
            break;
          case 'blob':
            xhr.responseType = 'blob';
            break;
          case 'arraybuffer':
            xhr.responseType = 'arraybuffer';
            break;
        }
      }

      // 设置withCredentials
      if (processedConfig.withCredentials) {
        xhr.withCredentials = true;
      }

      // 设置请求头
      this.setRequestHeaders(xhr, headers, body, processedConfig);

      // 监听上传进度事件
      if (processedConfig.onUploadProgress && xhr.upload) {
        xhr.upload.onprogress = (event: ProgressEvent) => {
          const progressEvent: IProgressEvent = this.createProgressEvent(
            event,
            requestId,
            'upload',
          );
          processedConfig.onUploadProgress?.(progressEvent);
        };
      }

      // 监听下载进度事件
      if (processedConfig.onDownloadProgress) {
        xhr.onprogress = (event: ProgressEvent) => {
          const progressEvent: IProgressEvent = this.createProgressEvent(
            event,
            requestId,
            'download',
          );
          processedConfig.onDownloadProgress?.(progressEvent);
        };
      }

      // 监听常规进度事件
      if (processedConfig.onProgress) {
        xhr.onprogress = (event: ProgressEvent) => {
          const progressEvent: IProgressEvent = this.createProgressEvent(
            event,
            requestId,
            'download',
          );
          processedConfig.onProgress?.(progressEvent);
        };
      }

      const startTime = Date.now();

      // 响应处理
      xhr.onreadystatechange = () => {
        if (xhr.readyState !== 4) return;

        // 清除超时定时器
        if (xhrTimeout) {
          clearTimeout(xhrTimeout);
        }

        // 从请求映射中删除
        this.removeRequest(requestId);

        // 成功响应 (包括非2xx状态码)
        if (xhr.status !== 0) {
          const duration = Date.now() - startTime;
          const responseHeaders = this.parseHeaders(xhr.getAllResponseHeaders());

          const response: IResponse<T> = {
            data: this.parseResponse(xhr) as T,
            status: xhr.status,
            statusText: xhr.statusText,
            headers: responseHeaders,
            config: processedConfig,
            requestId,
            timestamp: Date.now(),
            duration,
            originalResponse: xhr,
          };

          this.logger?.debug('network', `请求完成: ${url}`, {
            requestId,
            status: xhr.status,
            duration,
          });

          // 处理非2xx响应
          if (xhr.status < 200 || xhr.status >= 300) {
            const errorInfo = this.handleXhrError(xhr, processedConfig);
            const error = this.createNetworkError(errorInfo.message, processedConfig, {
              ...errorInfo.details,
              errorType: errorInfo.type,
              response,
            });
            reject(error);
            return;
          }

          resolve(response);
        } else {
          // 网络错误或请求中止
          const errorInfo = this.handleXhrError(xhr, processedConfig);
          const error = this.createNetworkError(errorInfo.message, processedConfig, {
            ...errorInfo.details,
            errorType: errorInfo.type,
          });
          reject(error);
        }
      };

      // 错误处理
      xhr.onerror = () => {
        // 清除超时定时器
        if (xhrTimeout) {
          clearTimeout(xhrTimeout);
        }

        this.removeRequest(requestId);

        const errorInfo = {
          type: NetworkErrorType.NETWORK_ERROR,
          message: '网络连接错误',
          details: {
            networkError: true,
            url: processedConfig.url,
            method: processedConfig.method,
            retryable: true,
          },
        };

        reject(
          this.createNetworkError(errorInfo.message, processedConfig, {
            ...errorInfo.details,
            errorType: errorInfo.type,
          }),
        );
      };

      // 中止处理
      xhr.onabort = () => {
        this.removeRequest(requestId);

        const errorInfo = {
          type: NetworkErrorType.ABORTED,
          message: '请求已中止',
          details: {
            aborted: true,
            url: processedConfig.url,
            method: processedConfig.method,
            retryable: false,
          },
        };

        reject(
          this.createNetworkError(errorInfo.message, processedConfig, {
            ...errorInfo.details,
            errorType: errorInfo.type,
          }),
        );
      };

      // 超时处理
      let xhrTimeout: number | undefined;
      if (processedConfig.timeout && processedConfig.timeout > 0) {
        xhr.timeout = processedConfig.timeout;
        xhr.ontimeout = () => {
          this.removeRequest(requestId);

          const errorInfo = {
            type: NetworkErrorType.TIMEOUT,
            message: `请求超时: ${processedConfig.timeout}ms`,
            details: {
              timeout: true,
              url: processedConfig.url,
              method: processedConfig.method,
              retryable: true,
            },
          };

          reject(
            this.createNetworkError(errorInfo.message, processedConfig, {
              ...errorInfo.details,
              errorType: errorInfo.type,
            }),
          );
        };
      }

      // 保存XHR实例，以便可以中止
      const abortController = processedConfig.abortController;
      if (abortController) {
        abortController.signal.addEventListener('abort', () => {
          if (xhr.readyState !== 4) {
            xhr.abort();
          }
        });
      }

      // 发送请求
      this.logger?.debug('network', `开始${method}请求: ${url}`, {
        requestId,
        config: processedConfig,
      });

      try {
        xhr.send(this.prepareBody(body, processedConfig));
      } catch (error) {
        this.removeRequest(requestId);
        reject(
          this.createNetworkError(
            `发送请求失败: ${error instanceof Error ? error.message : String(error)}`,
            processedConfig,
          ),
        );
      }
    });
  }

  /**
   * 构建完整URL
   * @param url 基础URL
   * @param params 查询参数
   * @returns 完整URL
   */
  private buildUrl(url: string, params?: Record<string, string>): string {
    if (!params) {
      return url;
    }

    const queryString = Object.entries(params)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');

    return queryString ? `${url}${url.includes('?') ? '&' : '?'}${queryString}` : url;
  }

  /**
   * 设置请求头
   * @param xhr XHR实例
   * @param headers 请求头
   * @param body 请求体
   * @param config 请求配置
   */
  private setRequestHeaders(
    xhr: XMLHttpRequest,
    headers: Record<string, string>,
    body?: unknown,
    config?: IRequestConfig,
  ): void {
    // 处理Content-Type
    let contentTypeSet = false;

    // 设置所有请求头
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === 'content-type') {
        contentTypeSet = true;
      }
      xhr.setRequestHeader(key, value);
    }

    // 如果没有设置Content-Type且有请求体
    if (!contentTypeSet && body !== undefined) {
      if (body instanceof FormData) {
        // 不设置，让浏览器设置正确的边界
      } else if (typeof body === 'string') {
        xhr.setRequestHeader('Content-Type', 'text/plain');
      } else {
        xhr.setRequestHeader('Content-Type', 'application/json');
      }
    }

    // 添加请求ID到头信息（可选）
    if (config?.requestId) {
      xhr.setRequestHeader('X-Request-ID', config.requestId);
    }
  }

  /**
   * 准备请求体
   * @param body 原始请求体
   * @param config 请求配置
   * @returns 处理后的请求体
   */
  private prepareBody(
    body?: unknown,
    config?: IRequestConfig,
  ): Document | XMLHttpRequestBodyInit | null {
    if (body === undefined || body === null) {
      return null;
    }

    // 如果是FormData、Blob、ArrayBuffer等，直接返回
    if (
      body instanceof FormData ||
      body instanceof Blob ||
      body instanceof ArrayBuffer ||
      body instanceof URLSearchParams ||
      typeof body === 'string' ||
      body instanceof Document
    ) {
      return body as Document | XMLHttpRequestBodyInit;
    }

    // 如果配置了useFormData，转换为FormData
    if (config?.useFormData && typeof body === 'object') {
      const formData = new FormData();
      for (const [key, value] of Object.entries(body)) {
        if (value instanceof Blob || value instanceof File) {
          formData.append(key, value);
        } else {
          formData.append(key, String(value));
        }
      }
      return formData;
    }

    // 默认转换为JSON字符串
    return JSON.stringify(body);
  }

  /**
   * 解析响应数据
   * @param xhr XHR实例
   * @returns 解析后的响应数据
   */
  private parseResponse(xhr: XMLHttpRequest): unknown {
    let response: unknown = undefined;

    try {
      // 如果responseType已设置，直接使用response
      if (xhr.responseType && xhr.responseType !== 'text') {
        return xhr.response;
      }

      // 尝试解析为JSON
      const responseText = xhr.responseText;
      if (responseText) {
        try {
          response = JSON.parse(responseText);
        } catch {
          // 如果不是有效的JSON，返回原始文本
          response = responseText;
        }
      }

      return response;
    } catch (error) {
      this.logger?.warn(
        'network',
        `响应解析失败: ${error instanceof Error ? error.message : String(error)}`,
      );
      return xhr.responseText || {};
    }
  }

  /**
   * 解析响应头
   * @param headersString 响应头字符串
   * @returns 响应头记录
   */
  private parseHeaders(headersString: string): Record<string, string> {
    const headers: Record<string, string> = {};

    if (!headersString) {
      return headers;
    }

    // 按行分割
    const headerLines = headersString.trim().split('\r\n');

    // 解析每一行
    headerLines.forEach(line => {
      const parts = line.split(': ');
      const key = parts.shift();
      const value = parts.join(': ');

      if (key && value) {
        headers[key.toLowerCase()] = value;
      }
    });

    return headers;
  }

  /**
   * 处理XHR错误，返回具体的错误类型和详细信息
   * @param xhr XMLHttpRequest对象
   * @param config 请求配置
   * @returns 错误信息对象
   */
  private handleXhrError(
    xhr: XMLHttpRequest,
    config: IRequestConfig,
  ): {
    type: NetworkErrorType;
    message: string;
    details: Record<string, unknown>;
  } {
    // 检查状态码
    if (xhr.status >= 400) {
      if (xhr.status >= 500) {
        return {
          type: NetworkErrorType.SERVER_ERROR,
          message: `服务器错误: ${xhr.status} ${xhr.statusText || '未知错误'}`,
          details: {
            status: xhr.status,
            statusText: xhr.statusText,
            url: config.url,
            method: config.method,
            retryable: true,
          },
        };
      } else {
        return {
          type: NetworkErrorType.CLIENT_ERROR,
          message: `客户端错误: ${xhr.status} ${xhr.statusText || '未知错误'}`,
          details: {
            status: xhr.status,
            statusText: xhr.statusText,
            url: config.url,
            method: config.method,
            retryable: false, // 客户端错误通常不需要重试
          },
        };
      }
    }

    // 检查是否超时
    if (xhr.status === 0 && config.timeout && config.timeout > 0) {
      return {
        type: NetworkErrorType.TIMEOUT,
        message: `请求超时: ${config.timeout}ms`,
        details: {
          timeout: config.timeout,
          url: config.url,
          method: config.method,
          retryable: true,
        },
      };
    }

    // 检查是否中止
    if (xhr.status === 0 && xhr.responseText === '') {
      return {
        type: NetworkErrorType.ABORTED,
        message: '请求已中止',
        details: {
          aborted: true,
          url: config.url,
          method: config.method,
          retryable: false,
        },
      };
    }

    // 网络错误
    return {
      type: NetworkErrorType.NETWORK_ERROR,
      message: '网络连接错误',
      details: {
        networkError: true,
        url: config.url,
        method: config.method,
        retryable: true,
      },
    };
  }
}
