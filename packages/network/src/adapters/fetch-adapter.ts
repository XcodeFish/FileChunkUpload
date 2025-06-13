/**
 * Fetch API适配器实现
 * 基于浏览器原生Fetch API的网络请求适配器
 */
import { Logger } from '@file-chunk-uploader/core';
import { IRequestConfig, IResponse } from '@file-chunk-uploader/types';

import { BaseNetworkAdapter } from './base-adapter';

/**
 * FetchAdapter类
 * 基于Fetch API实现的网络请求适配器
 */
export class FetchAdapter extends BaseNetworkAdapter {
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
  async request<T = unknown>(config: IRequestConfig): Promise<IResponse<T>> {
    // 处理配置，确保requestId和abortController存在
    const processedConfig = this.processConfig(config);
    const { url, method = 'GET', headers = {}, body, params } = processedConfig;
    const abortController = processedConfig.abortController || new AbortController();
    const requestId = processedConfig.requestId || '';

    try {
      this.logger?.debug('network', `开始${method}请求: ${url}`, {
        requestId,
        config: processedConfig,
      });

      // 构建完整URL（处理query参数）
      const fullUrl = this.buildUrl(url, params);

      // 构建请求选项
      const requestInit: RequestInit = {
        method,
        headers: this.prepareHeaders(headers, body, processedConfig),
        signal: abortController.signal,
        credentials: processedConfig.withCredentials ? 'include' : 'same-origin',
      };

      // 添加请求体（如果存在）
      if (body !== undefined && method !== 'GET' && method !== 'HEAD') {
        requestInit.body = this.prepareBody(body, processedConfig);
      }

      // 设置超时
      let timeoutId: number | undefined;
      if (processedConfig.timeout && processedConfig.timeout > 0) {
        timeoutId = window.setTimeout(() => {
          this.abort(requestId);
          this.logger?.warn('network', `请求超时: ${url}`, {
            requestId,
            timeout: processedConfig.timeout,
          });
        }, processedConfig.timeout);
      }

      // 发送请求
      const startTime = Date.now();
      const response = await fetch(fullUrl, requestInit);

      // 清除超时
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }

      // 处理响应
      const responseData = await this.parseResponse(response, processedConfig);
      const duration = Date.now() - startTime;

      // 从请求映射中移除
      this.removeRequest(requestId);

      // 创建响应对象
      const result: IResponse<T> = {
        data: responseData as T,
        status: response.status,
        statusText: response.statusText,
        headers: this.parseHeaders(response.headers),
        config: processedConfig,
        requestId,
        timestamp: Date.now(),
        duration,
        originalResponse: response,
      };

      this.logger?.debug('network', `请求完成: ${url}`, {
        requestId,
        status: response.status,
        duration,
      });

      // 检查状态码，处理错误
      if (!response.ok) {
        throw this.createNetworkError(`请求失败，状态码: ${response.status}`, processedConfig, {
          status: response.status,
          response: result,
        });
      }

      return result;
    } catch (error: any) {
      // 从请求映射中移除
      this.removeRequest(requestId);

      // 如果是中止错误
      if (error.name === 'AbortError') {
        throw this.createNetworkError('请求已中止', processedConfig, {
          aborted: true,
          retryable: false,
        });
      }

      // 如果已经是我们创建的网络错误，直接抛出
      if (error.requestId === requestId) {
        throw error;
      }

      // 其他错误
      throw this.createNetworkError(`请求失败: ${error.message}`, processedConfig, {
        networkError: true,
      });
    }
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
   * 准备请求头
   * @param headers 原始请求头
   * @param body 请求体
   * @param config 请求配置
   * @returns 处理后的请求头
   */
  private prepareHeaders(
    headers: Record<string, string>,
    body?: unknown,
    config?: IRequestConfig,
  ): HeadersInit {
    const result = { ...headers };

    // 如果没有指定Content-Type且有请求体，自动设置
    if (!result['Content-Type'] && body !== undefined) {
      if (body instanceof FormData) {
        // FormData不需要手动设置Content-Type，浏览器会自动添加并设置正确的boundary
        // 显式设置反而会导致boundary丢失
      } else if (typeof body === 'string') {
        result['Content-Type'] = 'text/plain';
      } else {
        result['Content-Type'] = 'application/json';
      }
    }

    // 添加请求ID到头信息（可选）
    if (config?.requestId) {
      result['X-Request-ID'] = config.requestId;
    }

    return result;
  }

  /**
   * 准备请求体
   * @param body 原始请求体
   * @param config 请求配置
   * @returns 处理后的请求体
   */
  private prepareBody(body: unknown, config: IRequestConfig): BodyInit {
    // 如果是FormData、Blob、ArrayBuffer等，直接返回
    if (
      body instanceof FormData ||
      body instanceof Blob ||
      body instanceof ArrayBuffer ||
      body instanceof URLSearchParams ||
      typeof body === 'string'
    ) {
      return body as BodyInit;
    }

    // 如果配置了useFormData，转换为FormData
    if (config.useFormData && typeof body === 'object' && body !== null) {
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
   * 解析响应
   * @param response Fetch响应对象
   * @param config 请求配置
   * @returns 解析后的响应数据
   */
  private async parseResponse(response: Response, config: IRequestConfig): Promise<unknown> {
    const responseType = config.responseType || 'json';

    try {
      switch (responseType) {
        case 'json':
          return await this.parseJsonResponse(response, config);
        case 'text':
          return await response.text();
        case 'blob':
          return await response.blob();
        case 'arraybuffer':
          return await response.arrayBuffer();
        default:
          // 默认尝试JSON解析
          return await this.parseJsonResponse(response, config);
      }
    } catch (error) {
      return await this.handleParseError(error, response, config, responseType);
    }
  }

  /**
   * 解析JSON响应
   * @param response Fetch响应对象
   * @param config 请求配置
   * @returns 解析后的JSON数据
   */
  private async parseJsonResponse(response: Response, config: IRequestConfig): Promise<unknown> {
    // 尝试解析JSON，如果为空返回null
    const text = await response.text();
    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch (jsonError) {
      return this.handleJsonParseError(jsonError, text, config);
    }
  }

  /**
   * 处理JSON解析错误
   * @param error 错误对象
   * @param text 原始响应文本
   * @param config 请求配置
   * @returns 包含错误信息的对象
   */
  private handleJsonParseError(error: unknown, text: string, config: IRequestConfig): unknown {
    this.logger?.warn(
      'network',
      `JSON解析失败: ${error instanceof Error ? error.message : String(error)}`,
      {
        requestId: config.requestId,
        responseType: 'json',
        text: text.length > 100 ? `${text.substring(0, 100)}...` : text,
      },
    );

    // 返回原始文本作为回退
    return {
      rawText: text,
      parseError: 'JSON_PARSE_ERROR',
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }

  /**
   * 处理响应解析错误
   * @param error 错误对象
   * @param response 响应对象
   * @param config 请求配置
   * @param responseType 响应类型
   * @returns 包含错误信息的对象
   */
  private async handleParseError(
    error: unknown,
    response: Response,
    config: IRequestConfig,
    responseType: string,
  ): Promise<unknown> {
    this.logger?.warn(
      'network',
      `响应解析失败: ${error instanceof Error ? error.message : String(error)}`,
      {
        requestId: config.requestId,
        responseType,
        status: response.status,
        contentType: response.headers.get('content-type'),
      },
    );

    // 解析失败时，尝试获取原始文本
    try {
      const text = await response.text();
      return {
        rawText: text,
        parseError: 'RESPONSE_PARSE_ERROR',
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    } catch (textError) {
      // 如果连文本都无法获取，返回空对象
      return {
        parseError: 'RESPONSE_READ_ERROR',
        errorMessage: textError instanceof Error ? textError.message : String(textError),
      };
    }
  }

  /**
   * 解析响应头
   * @param headers 响应头对象
   * @returns 响应头记录
   */
  private parseHeaders(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {};

    headers.forEach((value, key) => {
      result[key] = value;
    });

    return result;
  }
}
