/**
 * 拦截器管理器实现
 */
import { Logger } from '@file-chunk-uploader/core';
import { IRequestConfig, IResponse } from '@file-chunk-uploader/types';

import { NETWORK_INTERCEPTOR_LOG_CATEGORY } from '../utils/logger-categories';

/**
 * 拦截器管理器类
 * 管理请求和响应拦截器
 */
export class InterceptorManager {
  private requestInterceptors: Array<{
    id: string;
    fulfilled: (config: IRequestConfig) => IRequestConfig | Promise<IRequestConfig>;
    rejected?: (error: Error) => IRequestConfig | Promise<IRequestConfig> | Error | Promise<Error>;
  }> = [];

  private responseInterceptors: Array<{
    id: string;
    fulfilled: (response: IResponse<unknown>) => IResponse<unknown> | Promise<IResponse<unknown>>;
    rejected?: (
      error: Error,
    ) => IResponse<unknown> | Promise<IResponse<unknown>> | Error | Promise<Error>;
  }> = [];

  private logger?: Logger;

  /**
   * 构造函数
   * @param logger 可选的日志记录器
   */
  constructor(logger?: Logger) {
    this.logger = logger;
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `interceptor_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * 添加请求拦截器
   * @param interceptor 请求拦截器函数
   * @param errorInterceptor 可选的错误处理函数
   * @returns 拦截器ID
   */
  addRequestInterceptor(
    interceptor: (config: IRequestConfig) => IRequestConfig | Promise<IRequestConfig>,
    errorInterceptor?: (
      error: Error,
    ) => IRequestConfig | Promise<IRequestConfig> | Error | Promise<Error>,
  ): string {
    const id = this.generateId();

    this.requestInterceptors.push({
      id,
      fulfilled: interceptor,
      rejected: errorInterceptor,
    });

    this.logger?.debug(NETWORK_INTERCEPTOR_LOG_CATEGORY, `添加请求拦截器: ${id}`);

    return id;
  }

  /**
   * 添加响应拦截器
   * @param interceptor 响应拦截器函数
   * @param errorInterceptor 可选的错误处理函数
   * @returns 拦截器ID
   */
  addResponseInterceptor<T = unknown>(
    interceptor: (response: IResponse<T>) => IResponse<T> | Promise<IResponse<T>>,
    errorInterceptor?: (
      error: Error,
    ) => IResponse<T> | Promise<IResponse<T>> | Error | Promise<Error>,
  ): string {
    const id = this.generateId();

    // 添加类型转换，处理泛型
    const genericInterceptor = (response: IResponse<unknown>) => {
      return interceptor(response as unknown as IResponse<T>) as unknown as
        | IResponse<unknown>
        | Promise<IResponse<unknown>>;
    };

    const genericErrorInterceptor = errorInterceptor
      ? (error: Error) => {
          const result = errorInterceptor(error);
          if (result instanceof Error || Promise.resolve(result) instanceof Promise) {
            return result;
          }
          return result as unknown as IResponse<unknown> | Promise<IResponse<unknown>>;
        }
      : undefined;

    this.responseInterceptors.push({
      id,
      fulfilled: genericInterceptor,
      rejected: genericErrorInterceptor,
    });

    this.logger?.debug(NETWORK_INTERCEPTOR_LOG_CATEGORY, `添加响应拦截器: ${id}`);

    return id;
  }

  /**
   * 移除请求拦截器
   * @param id 拦截器ID
   * @returns 是否成功移除
   */
  removeRequestInterceptor(id: string): boolean {
    const initialLength = this.requestInterceptors.length;
    this.requestInterceptors = this.requestInterceptors.filter(
      interceptor => interceptor.id !== id,
    );

    const removed = initialLength > this.requestInterceptors.length;

    if (removed) {
      this.logger?.debug(NETWORK_INTERCEPTOR_LOG_CATEGORY, `移除请求拦截器: ${id}`);
    }

    return removed;
  }

  /**
   * 移除响应拦截器
   * @param id 拦截器ID
   * @returns 是否成功移除
   */
  removeResponseInterceptor(id: string): boolean {
    const initialLength = this.responseInterceptors.length;
    this.responseInterceptors = this.responseInterceptors.filter(
      interceptor => interceptor.id !== id,
    );

    const removed = initialLength > this.responseInterceptors.length;

    if (removed) {
      this.logger?.debug(NETWORK_INTERCEPTOR_LOG_CATEGORY, `移除响应拦截器: ${id}`);
    }

    return removed;
  }

  /**
   * 清除所有拦截器
   */
  clear(): void {
    this.requestInterceptors = [];
    this.responseInterceptors = [];
    this.logger?.debug(NETWORK_INTERCEPTOR_LOG_CATEGORY, '清除所有拦截器');
  }

  /**
   * 应用请求拦截器
   * @param config 请求配置
   * @returns 处理后的请求配置
   */
  async applyRequestInterceptors(config: IRequestConfig): Promise<IRequestConfig> {
    let currentConfig = { ...config };

    this.logger?.debug(
      NETWORK_INTERCEPTOR_LOG_CATEGORY,
      `应用请求拦截器: ${this.requestInterceptors.length}个`,
      { requestId: config.requestId, url: config.url },
    );

    try {
      // 按添加顺序应用拦截器
      for (const interceptor of this.requestInterceptors) {
        try {
          this.logger?.debug(
            NETWORK_INTERCEPTOR_LOG_CATEGORY,
            `执行请求拦截器: ${interceptor.id}`,
            { requestId: config.requestId },
          );
          currentConfig = await Promise.resolve(interceptor.fulfilled(currentConfig));
        } catch (interceptorError) {
          this.logger?.error(
            NETWORK_INTERCEPTOR_LOG_CATEGORY,
            `请求拦截器执行失败: ${interceptor.id}`,
            {
              requestId: config.requestId,
              error:
                interceptorError instanceof Error
                  ? interceptorError.message
                  : String(interceptorError),
              stack: interceptorError instanceof Error ? interceptorError.stack : undefined,
            },
          );
          throw interceptorError;
        }
      }

      return currentConfig;
    } catch (error) {
      // 处理错误
      let currentError = error as Error;
      this.logger?.error(NETWORK_INTERCEPTOR_LOG_CATEGORY, `请求拦截器链出错，尝试错误处理`, {
        requestId: config.requestId,
        error: currentError.message,
        stack: currentError.stack,
      });

      for (const interceptor of this.requestInterceptors) {
        if (interceptor.rejected) {
          try {
            this.logger?.debug(
              NETWORK_INTERCEPTOR_LOG_CATEGORY,
              `执行请求错误拦截器: ${interceptor.id}`,
              { requestId: config.requestId },
            );
            const result = await Promise.resolve(interceptor.rejected(currentError));

            // 如果返回的是配置，直接返回
            if (!(result instanceof Error)) {
              this.logger?.debug(
                NETWORK_INTERCEPTOR_LOG_CATEGORY,
                `请求错误被拦截器恢复: ${interceptor.id}`,
                { requestId: config.requestId },
              );
              return result as IRequestConfig;
            }

            currentError = result;
          } catch (innerError) {
            this.logger?.error(
              NETWORK_INTERCEPTOR_LOG_CATEGORY,
              `请求错误拦截器执行失败: ${interceptor.id}`,
              {
                requestId: config.requestId,
                error: innerError instanceof Error ? innerError.message : String(innerError),
                stack: innerError instanceof Error ? innerError.stack : undefined,
              },
            );
            currentError = innerError as Error;
          }
        }
      }

      throw currentError;
    }
  }

  /**
   * 应用响应拦截器
   * @param response 响应对象
   * @returns 处理后的响应对象
   */
  async applyResponseInterceptors<T>(response: IResponse<T>): Promise<IResponse<T>> {
    let currentResponse = { ...response } as unknown as IResponse<unknown>;

    this.logger?.debug(
      NETWORK_INTERCEPTOR_LOG_CATEGORY,
      `应用响应拦截器: ${this.responseInterceptors.length}个`,
      { requestId: response.requestId, url: response.config.url },
    );

    // 按添加顺序应用拦截器
    for (const interceptor of this.responseInterceptors) {
      try {
        this.logger?.debug(NETWORK_INTERCEPTOR_LOG_CATEGORY, `执行响应拦截器: ${interceptor.id}`, {
          requestId: response.requestId,
        });
        currentResponse = await Promise.resolve(interceptor.fulfilled(currentResponse));
      } catch (interceptorError) {
        this.logger?.error(
          NETWORK_INTERCEPTOR_LOG_CATEGORY,
          `响应拦截器执行失败: ${interceptor.id}`,
          {
            requestId: response.requestId,
            error:
              interceptorError instanceof Error
                ? interceptorError.message
                : String(interceptorError),
            stack: interceptorError instanceof Error ? interceptorError.stack : undefined,
          },
        );
        throw interceptorError;
      }
    }

    return currentResponse as unknown as IResponse<T>;
  }

  /**
   * 应用响应错误拦截器
   * @param error 错误对象
   * @returns 处理后的错误对象或响应对象
   */
  async applyResponseErrorInterceptors<T>(error: Error): Promise<IResponse<T> | Error> {
    let currentError = error;
    const requestId = (error as any).requestId || 'unknown';

    this.logger?.debug(
      NETWORK_INTERCEPTOR_LOG_CATEGORY,
      `应用响应错误拦截器: ${this.responseInterceptors.length}个`,
      {
        requestId,
        error: error.message,
        errorType: (error as any).errorType || 'unknown',
      },
    );

    for (const interceptor of this.responseInterceptors) {
      if (interceptor.rejected) {
        try {
          this.logger?.debug(
            NETWORK_INTERCEPTOR_LOG_CATEGORY,
            `执行响应错误拦截器: ${interceptor.id}`,
            { requestId },
          );
          const result = await Promise.resolve(interceptor.rejected(currentError));

          // 检查是否是响应对象
          if (result && typeof result === 'object' && 'data' in result && 'status' in result) {
            this.logger?.debug(
              NETWORK_INTERCEPTOR_LOG_CATEGORY,
              `响应错误被拦截器恢复: ${interceptor.id}`,
              { requestId, status: (result as any).status },
            );
            // 类型转换为特定的响应类型
            return result as unknown as IResponse<T>;
          }

          currentError = result as Error;
        } catch (innerError) {
          this.logger?.error(
            NETWORK_INTERCEPTOR_LOG_CATEGORY,
            `响应错误拦截器执行失败: ${interceptor.id}`,
            {
              requestId,
              error: innerError instanceof Error ? innerError.message : String(innerError),
              stack: innerError instanceof Error ? innerError.stack : undefined,
            },
          );
          currentError = innerError as Error;
        }
      }
    }

    throw currentError;
  }
}
