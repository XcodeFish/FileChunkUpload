/**
 * 拦截器类型定义
 */
import { IRequestConfig, IResponse } from '@file-chunk-uploader/types';

/**
 * 请求拦截器函数类型
 * 用于在发送请求前对请求配置进行处理
 */
export type RequestInterceptor = (
  config: IRequestConfig,
) => IRequestConfig | Promise<IRequestConfig>;

/**
 * 请求错误拦截器函数类型
 * 用于在请求发送前发生错误时进行处理
 */
export type RequestErrorInterceptor = (
  error: Error,
) => IRequestConfig | Promise<IRequestConfig> | Error | Promise<Error>;

/**
 * 响应拦截器函数类型
 * 用于在收到响应后对响应数据进行处理
 */
export type ResponseInterceptor<T = unknown> = (
  response: IResponse<T>,
) => IResponse<T> | Promise<IResponse<T>>;

/**
 * 响应错误拦截器函数类型
 * 用于在处理响应时发生错误时进行处理
 */
export type ResponseErrorInterceptor = (
  error: Error,
) => IResponse | Promise<IResponse> | Error | Promise<Error>;

/**
 * 请求拦截器对象类型
 */
export interface IRequestInterceptorObject {
  /** 拦截器ID */
  id: string;
  /** 请求拦截器函数 */
  fulfilled: RequestInterceptor;
  /** 请求错误拦截器函数 */
  rejected?: RequestErrorInterceptor;
}

/**
 * 响应拦截器对象类型
 */
export interface IResponseInterceptorObject {
  /** 拦截器ID */
  id: string;
  /** 响应拦截器函数 */
  fulfilled: ResponseInterceptor;
  /** 响应错误拦截器函数 */
  rejected?: ResponseErrorInterceptor;
}

/**
 * 拦截器管理器接口
 */
export interface IInterceptorManager {
  /**
   * 添加请求拦截器
   * @param interceptor 请求拦截器函数
   * @param errorInterceptor 可选的错误处理函数
   * @returns 拦截器ID，用于后续移除
   */
  addRequestInterceptor(
    interceptor: RequestInterceptor,
    errorInterceptor?: RequestErrorInterceptor,
  ): string;

  /**
   * 添加响应拦截器
   * @param interceptor 响应拦截器函数
   * @param errorInterceptor 可选的错误处理函数
   * @returns 拦截器ID，用于后续移除
   */
  addResponseInterceptor(
    interceptor: ResponseInterceptor,
    errorInterceptor?: ResponseErrorInterceptor,
  ): string;

  /**
   * 移除请求拦截器
   * @param id 拦截器ID
   * @returns 是否成功移除
   */
  removeRequestInterceptor(id: string): boolean;

  /**
   * 移除响应拦截器
   * @param id 拦截器ID
   * @returns 是否成功移除
   */
  removeResponseInterceptor(id: string): boolean;

  /** 清除所有拦截器 */
  clear(): void;

  /**
   * 应用请求拦截器
   * @param config 请求配置
   * @returns 处理后的请求配置
   */
  applyRequestInterceptors(config: IRequestConfig): Promise<IRequestConfig>;

  /**
   * 应用响应拦截器
   * @param response 响应对象
   * @returns 处理后的响应对象
   */
  applyResponseInterceptors<T = unknown>(response: IResponse<T>): Promise<IResponse<T>>;

  /**
   * 应用响应错误拦截器
   * @param error 错误对象
   * @returns 处理后的错误对象或响应对象
   */
  applyResponseErrorInterceptors<T = unknown>(error: Error): Promise<IResponse<T> | Error>;
}
