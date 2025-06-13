/**
 * 网络请求插件
 * 实现网络适配器注入和网络功能集成
 * @packageDocumentation
 */

import {
  IPlugin,
  IFileUploaderCore,
  INetworkAdapter,
  IRequestConfig,
  IResponse,
} from '@file-chunk-uploader/types';

import { FetchAdapter } from './adapters/fetch-adapter';
import { XhrAdapter } from './adapters/xhr-adapter';

/**
 * 网络插件配置接口
 */
export interface INetworkPluginConfig {
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

/**
 * 网络事件名称
 */
export enum NetworkEventName {
  /** 请求开始事件 */
  REQUEST = 'network:request',
  /** 请求响应事件 */
  RESPONSE = 'network:response',
  /** 请求错误事件 */
  ERROR = 'network:error',
  /** 请求取消事件 */
  ABORT = 'network:abort',
  /** 请求超时事件 */
  TIMEOUT = 'network:timeout',
  /** 上传进度事件 */
  UPLOAD_PROGRESS = 'network:upload:progress',
  /** 下载进度事件 */
  DOWNLOAD_PROGRESS = 'network:download:progress',
  /** 网络状态变化事件 */
  STATUS_CHANGE = 'network:status:change',
}

/**
 * 响应事件数据
 */
export interface IResponseEventData {
  /** 请求ID */
  requestId: string;
  /** 请求耗时 */
  duration: number;
  /** 响应对象 */
  response: IResponse;
}

/**
 * 错误事件数据
 */
export interface IErrorEventData {
  /** 请求ID */
  requestId: string;
  /** 请求耗时 */
  duration: number;
  /** 错误对象 */
  error: Error;
}

/**
 * 根据错误信息确定网络事件类型
 * @param error 错误对象
 * @returns 对应的网络事件类型
 */
function determineErrorEventType(error: any): NetworkEventName {
  if (error.aborted) {
    return NetworkEventName.ABORT;
  }

  if (error.timeout) {
    return NetworkEventName.TIMEOUT;
  }

  return NetworkEventName.ERROR;
}

/**
 * 为请求创建代理，增强请求功能
 * @param adapter 网络适配器实例
 * @param uploader 上传器核心实例
 * @param config 插件配置
 * @returns 增强后的网络适配器
 */
function createRequestProxy<T extends INetworkAdapter>(
  adapter: T,
  uploader: IFileUploaderCore,
  config: INetworkPluginConfig,
): T {
  const logger = (uploader as any).logger;
  const originalRequest = adapter.request.bind(adapter);
  const devMode = config.devMode || {};
  const events = config.events || { enable: true };
  const eventPrefix = events.prefix || '';

  // 替换原始请求方法
  adapter.request = async <D>(requestConfig: IRequestConfig): Promise<IResponse<D>> => {
    const startTime = Date.now();
    const requestId =
      requestConfig.requestId || `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    // 记录请求日志
    if (devMode.enableLogging && logger) {
      const logData = devMode.includeRequestBody
        ? requestConfig
        : { ...requestConfig, body: requestConfig.body ? '[请求体已忽略]' : undefined };

      logger.debug('网络请求开始', { requestId, ...logData }, 'network');
    }

    // 发送请求事件
    if (events.enable) {
      const eventName = `${eventPrefix}${NetworkEventName.REQUEST}`;
      uploader.eventEmitter.emit(eventName, { id: requestId, config: requestConfig });
    }

    try {
      // 发送请求
      const response = await originalRequest<D>(requestConfig);
      const duration = Date.now() - startTime;

      // 记录响应日志
      if (devMode.enableLogging && logger) {
        const logData = devMode.includeResponseData
          ? response
          : { ...response, data: response.data ? '[响应数据已忽略]' : undefined };

        logger.debug('网络请求成功', { ...logData, requestId, duration }, 'network');
      }

      // 发送响应事件
      if (events.enable) {
        const eventName = `${eventPrefix}${NetworkEventName.RESPONSE}`;
        uploader.eventEmitter.emit(eventName, {
          id: requestId,
          time: duration,
          response,
        });
      }

      return response;
    } catch (error: any) {
      const duration = Date.now() - startTime;

      // 记录错误日志
      if (devMode.enableLogging && logger) {
        logger.error(
          '网络请求失败',
          {
            requestId,
            duration,
            error: error.message,
            status: error.status,
            code: error.code,
          },
          'network',
        );
      }

      // 发送错误事件
      if (events.enable) {
        const errorType = determineErrorEventType(error);
        const eventName = `${eventPrefix}${errorType}`;
        uploader.eventEmitter.emit(eventName, {
          id: requestId,
          time: duration,
          error,
        });
      }

      throw error;
    }
  };

  return adapter;
}

/**
 * 创建网络请求插件
 * @param config 插件配置
 * @returns 网络请求插件实例
 */
export const createNetworkPlugin = (config: INetworkPluginConfig = {}): IPlugin => {
  // 默认配置
  const defaultConfig: INetworkPluginConfig = {
    adapterType: 'fetch',
    devMode: {
      enableLogging: true,
      logLevel: 'debug',
      includeRequestBody: false,
      includeResponseData: false,
    },
    events: {
      enable: true,
      prefix: '',
    },
    requestHandling: {
      autoSerializeJson: true,
      autoHandleFormData: true,
    },
  };

  // 合并配置
  const finalConfig = { ...defaultConfig, ...config };

  return {
    name: 'network-plugin',
    version: '1.0.0',
    apiVersion: '1.0.0',

    install: (uploader: IFileUploaderCore): void => {
      // 创建网络适配器
      let adapter: INetworkAdapter;

      if (finalConfig.adapter) {
        adapter = finalConfig.adapter;
      } else {
        switch (finalConfig.adapterType) {
          case 'xhr':
            adapter = new XhrAdapter();
            break;
          default:
            adapter = new FetchAdapter();
        }
      }

      // 创建请求代理
      const enhancedAdapter = createRequestProxy(adapter, uploader, finalConfig);

      // 注入适配器到上传器
      (uploader as any).networkAdapter = enhancedAdapter;

      // 监听网络状态改变事件
      if (finalConfig.events?.enable) {
        const prefix = finalConfig.events.prefix || '';
        uploader.eventEmitter.on('network:status', (status: unknown) => {
          uploader.eventEmitter.emit(`${prefix}${NetworkEventName.STATUS_CHANGE}`, status);
        });
      }

      // 注册开发者模式日志
      if (finalConfig.devMode?.enableLogging && (uploader as any).devMode) {
        (uploader as any).devMode.addLogger('network', {
          label: '网络',
          color: '#1E88E5',
          icon: '🌐',
        });
      }
    },

    lifecycle: {
      // 插件卸载时清理资源
      cleanup: async function (): Promise<void> {
        // 获取上传器实例（通过闭包访问不到uploader）
        const pluginContext = this as unknown as { uploader?: IFileUploaderCore };
        if (!pluginContext.uploader) return;

        // 清理网络适配器资源
        const uploaderWithAdapter = pluginContext.uploader as any;
        const adapter = uploaderWithAdapter.networkAdapter as INetworkAdapter | undefined;

        if (adapter && typeof adapter.cleanup === 'function') {
          adapter.cleanup();
        }
      },
    },
  };
};

/**
 * 创建Fetch适配器插件
 * @param config 配置选项
 * @returns 网络插件实例
 */
export const fetchAdapter = (
  config: Omit<INetworkPluginConfig, 'adapter' | 'adapterType'> = {},
): IPlugin => {
  return createNetworkPlugin({
    ...config,
    adapterType: 'fetch',
  });
};

/**
 * 创建XHR适配器插件
 * @param config 配置选项
 * @returns 网络插件实例
 */
export const xhrAdapter = (
  config: Omit<INetworkPluginConfig, 'adapter' | 'adapterType'> = {},
): IPlugin => {
  return createNetworkPlugin({
    ...config,
    adapterType: 'xhr',
  });
};

/**
 * 创建自定义适配器插件
 * @param adapter 自定义适配器实例
 * @param config 配置选项
 * @returns 网络插件实例
 */
export const customAdapter = (
  adapter: INetworkAdapter,
  config: Omit<INetworkPluginConfig, 'adapter' | 'adapterType'> = {},
): IPlugin => {
  return createNetworkPlugin({
    ...config,
    adapter,
    adapterType: 'custom',
  });
};
