import { IFileUploaderCore, INetworkAdapter } from '@file-chunk-uploader/types';

import { createNetworkPlugin, fetchAdapter, xhrAdapter, customAdapter } from '../src/plugin';

// 模拟上传器核心
const mockUploader = {
  eventEmitter: {
    emit: jest.fn(),
    on: jest.fn(),
  },
  // 添加这些属性以满足类型检查
  networkAdapter: undefined,
  config: {},
  pluginManager: { register: jest.fn() },
  executeHook: jest.fn(),
} as unknown as IFileUploaderCore;

// 添加logger作为任意属性
(mockUploader as any).logger = {
  debug: jest.fn(),
  error: jest.fn(),
};

// 添加devMode作为任意属性
(mockUploader as any).devMode = {
  addLogger: jest.fn(),
};

// 模拟网络适配器
const mockAdapter: INetworkAdapter = {
  request: jest.fn().mockResolvedValue({ status: 200, data: { success: true } }),
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  abort: jest.fn(),
  abortAll: jest.fn(),
  cleanup: jest.fn(),
};

describe('Network Plugin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createNetworkPlugin', () => {
    test('应该返回一个有效的插件对象', () => {
      const plugin = createNetworkPlugin();

      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('network-plugin');
      expect(plugin.version).toBeDefined();
      expect(typeof plugin.install).toBe('function');
      expect(plugin.lifecycle).toBeDefined();
      expect(typeof plugin.lifecycle?.cleanup).toBe('function');
    });

    test('应该使用默认配置', () => {
      const plugin = createNetworkPlugin();
      plugin.install(mockUploader);

      // 验证默认适配器类型是fetch
      expect((mockUploader as any).networkAdapter).toBeDefined();
    });

    test('应该使用提供的配置', () => {
      const plugin = createNetworkPlugin({
        adapter: mockAdapter,
        devMode: {
          enableLogging: true,
        },
      });

      plugin.install(mockUploader);

      // 验证使用了提供的适配器
      expect((mockUploader as any).networkAdapter).toBeDefined();

      // 验证开发者模式日志记录器已注册
      expect((mockUploader as any).devMode.addLogger).toHaveBeenCalledWith(
        'network',
        expect.any(Object),
      );
    });

    test('应该在插件卸载时清理资源', async () => {
      const plugin = createNetworkPlugin({ adapter: mockAdapter });
      plugin.install(mockUploader);

      // 模拟插件上下文
      const pluginContext = {
        uploader: {
          ...mockUploader,
          networkAdapter: mockAdapter,
        },
      };

      // 调用清理函数
      if (plugin.lifecycle?.cleanup) {
        await plugin.lifecycle.cleanup.call(pluginContext);
      }

      // 验证适配器的清理方法被调用
      expect(mockAdapter.cleanup).toHaveBeenCalled();
    });
  });

  describe('请求代理功能', () => {
    test('应该增强请求方法并发送事件', async () => {
      // 使用 spyOn 来监视函数调用
      const requestSpy = jest.spyOn(mockAdapter, 'request');
      const emitSpy = jest.spyOn((mockUploader as any).eventEmitter, 'emit');

      const plugin = createNetworkPlugin({ adapter: mockAdapter });
      plugin.install(mockUploader);

      // 获取增强后的适配器
      const enhancedAdapter = (mockUploader as any).networkAdapter as INetworkAdapter;

      // 发送请求
      const response = await enhancedAdapter.request({
        url: 'https://example.com/upload',
        method: 'POST',
        body: { test: true },
      });

      // 验证原始请求方法被调用
      expect(requestSpy).toHaveBeenCalled();

      // 验证事件被发送
      expect(emitSpy).toHaveBeenCalled();

      // 验证响应正确
      expect(response).toEqual({ status: 200, data: { success: true } });
    });

    test('应该处理请求错误并发送错误事件', async () => {
      // 模拟请求失败
      const errorAdapter: INetworkAdapter = {
        request: jest.fn().mockRejectedValue(new Error('Network error')),
        get: jest.fn(),
        post: jest.fn(),
        put: jest.fn(),
        delete: jest.fn(),
        abort: jest.fn(),
        abortAll: jest.fn(),
        cleanup: jest.fn(),
      };

      const plugin = createNetworkPlugin({ adapter: errorAdapter });
      plugin.install(mockUploader);

      // 获取增强后的适配器
      const enhancedAdapter = (mockUploader as any).networkAdapter as INetworkAdapter;

      // 发送请求并期望失败
      await expect(
        enhancedAdapter.request({
          url: 'https://example.com/upload',
          method: 'POST',
        }),
      ).rejects.toThrow('Network error');

      // 验证错误事件被发送
      expect((mockUploader as any).eventEmitter.emit).toHaveBeenCalled();
      expect((mockUploader as any).logger.error).toHaveBeenCalled();
    });
  });

  describe('适配器工厂函数', () => {
    test('fetchAdapter 应该创建使用Fetch适配器的插件', () => {
      const plugin = fetchAdapter();
      expect(plugin.name).toBe('network-plugin');
      plugin.install(mockUploader);
      expect((mockUploader as any).networkAdapter).toBeDefined();
    });

    test('xhrAdapter 应该创建使用XHR适配器的插件', () => {
      const plugin = xhrAdapter();
      expect(plugin.name).toBe('network-plugin');
      plugin.install(mockUploader);
      expect((mockUploader as any).networkAdapter).toBeDefined();
    });

    test('customAdapter 应该创建使用自定义适配器的插件', () => {
      // 使用 spyOn 监视请求方法
      const requestSpy = jest.spyOn(mockAdapter, 'request');

      const plugin = customAdapter(mockAdapter);
      expect(plugin.name).toBe('network-plugin');
      plugin.install(mockUploader);
      expect((mockUploader as any).networkAdapter).toBeDefined();

      // 验证使用了提供的自定义适配器
      const enhancedAdapter = (mockUploader as any).networkAdapter as INetworkAdapter;
      enhancedAdapter.request({ url: 'test', method: 'GET' });
      expect(requestSpy).toHaveBeenCalled();
    });
  });
});
