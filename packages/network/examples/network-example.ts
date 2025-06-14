/**
 * 网络模块使用示例
 *
 * 本示例展示了如何使用@file-chunk-uploader/network包中的不同适配器和插件
 */

import { FileUploader } from '@file-chunk-uploader/core/src/core';
import { IRequestConfig, IResponse, IProgressEvent } from '@file-chunk-uploader/types';

import { fetchAdapter, xhrAdapter, customAdapter, FetchAdapter, XhrAdapter } from '../src';

// 示例1: 使用Fetch适配器插件
function useFetchAdapterExample(): void {
  const uploader = new FileUploader({
    target: 'https://api.example.com/upload',
  });

  // 使用Fetch适配器插件
  uploader.use(
    fetchAdapter({
      devMode: {
        enableLogging: true, // 启用网络请求日志
        includeRequestBody: false, // 不包含请求体数据（可能很大）
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

  // 上传文件
  const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
  uploader.upload(file);
}

// 示例2: 使用XHR适配器插件
function useXhrAdapterExample(): void {
  const uploader = new FileUploader({
    target: 'https://api.example.com/upload',
  });

  // 使用XHR适配器插件
  uploader.use(
    xhrAdapter({
      devMode: {
        enableLogging: true,
      },
    }),
  );

  // 上传文件
  const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
  uploader.upload(file);
}

// 示例3: 使用自定义适配器插件
function useCustomAdapterExample(): void {
  const uploader = new FileUploader({
    target: 'https://api.example.com/upload',
  });

  // 创建自定义适配器
  const myAdapter = {
    request: async <T>(config: IRequestConfig): Promise<IResponse<T>> => {
      console.log('自定义适配器发送请求:', config.url);

      // 模拟网络请求
      await new Promise(resolve => setTimeout(resolve, 500));

      // 返回符合IResponse接口的对象
      return {
        status: 200,
        statusText: 'OK',
        data: { success: true, url: 'https://example.com/files/test.txt' } as unknown as T,
        headers: {},
        config,
        requestId: config.requestId || 'default-id',
        timestamp: Date.now(),
        duration: 500,
      };
    },

    // 实现其他必要的方法
    get: async <T>(url: string, config?: IRequestConfig): Promise<IResponse<T>> => {
      return myAdapter.request<T>({ ...config, url, method: 'GET' });
    },

    post: async <T>(
      url: string,
      data?: unknown,
      config?: IRequestConfig,
    ): Promise<IResponse<T>> => {
      return myAdapter.request<T>({ ...config, url, method: 'POST', body: data });
    },

    put: async <T>(url: string, data?: unknown, config?: IRequestConfig): Promise<IResponse<T>> => {
      return myAdapter.request<T>({ ...config, url, method: 'PUT', body: data });
    },

    delete: async <T>(url: string, config?: IRequestConfig): Promise<IResponse<T>> => {
      return myAdapter.request<T>({ ...config, url, method: 'DELETE' });
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

  // 上传文件
  const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
  uploader.upload(file);
}

// 示例4: 直接使用适配器类
async function useAdapterClassesExample(): Promise<void> {
  // 创建Fetch适配器实例
  const fetchAdapterInstance = new FetchAdapter();

  // 发送GET请求
  const getResponse = await fetchAdapterInstance.get('https://api.example.com/files');
  console.log('GET响应:', getResponse);

  // 发送POST请求
  const postResponse = await fetchAdapterInstance.post('https://api.example.com/upload', {
    name: 'test.txt',
    content: 'base64-encoded-content',
  });
  console.log('POST响应:', postResponse);

  // 创建XHR适配器实例
  const xhrAdapterInstance = new XhrAdapter();

  // 发送带进度回调的请求
  const formData = new FormData();
  formData.append('file', new File(['test content'], 'test.txt'));

  const uploadResponse = await xhrAdapterInstance.request({
    url: 'https://api.example.com/upload',
    method: 'POST',
    body: formData,
    onUploadProgress: (event: IProgressEvent) => {
      console.log(`上传进度: ${Math.round((event.loaded / event.total) * 100)}%`);
    },
  });

  console.log('上传响应:', uploadResponse);
}

// 运行示例
// 取消注释以运行不同的示例
useFetchAdapterExample();
useXhrAdapterExample();
useCustomAdapterExample();
useAdapterClassesExample();
