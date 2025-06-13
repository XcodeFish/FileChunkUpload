import { IRequestConfig } from '@file-chunk-uploader/types';

import { FetchAdapter } from '../src/adapters/fetch-adapter';
import { XhrAdapter } from '../src/adapters/xhr-adapter';

// 保存原始全局对象
const originalFetch = global.fetch;
const originalXMLHttpRequest = global.XMLHttpRequest;
const originalAbortController = global.AbortController;

// 模拟 AbortController
class MockAbortController {
  signal: {
    aborted: boolean;
    addEventListener: (event: string, handler: () => void) => void;
    removeEventListener: (event: string, handler: () => void) => void;
    onabort: null | (() => void);
  };

  private _abortHandlers: (() => void)[] = [];

  constructor() {
    this.signal = {
      aborted: false,
      addEventListener: (event: string, handler: () => void) => {
        if (event === 'abort') {
          this._abortHandlers.push(handler);
        }
      },
      removeEventListener: (event: string, handler: () => void) => {
        if (event === 'abort') {
          const index = this._abortHandlers.indexOf(handler);
          if (index !== -1) {
            this._abortHandlers.splice(index, 1);
          }
        }
      },
      onabort: null,
    };
  }

  abort(): void {
    this.signal.aborted = true;

    // 触发所有中止处理函数
    this._abortHandlers.forEach(handler => handler());

    // 触发onabort事件
    if (this.signal.onabort) {
      this.signal.onabort();
    }
  }
}

// 存储创建的XHR实例
const mockXhrInstances: MockXMLHttpRequest[] = [];

// 模拟 XMLHttpRequest
class MockXMLHttpRequest {
  // 公共属性和方法
  open = jest.fn();
  send = jest.fn();
  setRequestHeader = jest.fn();
  abort = jest.fn();
  readyState = 0;
  status = 200;
  statusText = 'OK';
  responseText = JSON.stringify({ success: true });
  response = { success: true };
  getAllResponseHeaders = jest.fn(() => '');
  addEventListener = jest.fn();

  // 事件处理器
  onload: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onabort: ((event: any) => void) | null = null;
  ontimeout: ((event: any) => void) | null = null;
  onreadystatechange: ((event: any) => void) | null = null;
  onprogress: ((event: any) => void) | null = null;

  // 上传对象
  upload = {
    onprogress: null as ((event: any) => void) | null,
    addEventListener: jest.fn(),
  };

  constructor() {
    // 添加实例到数组
    mockXhrInstances.push(this);
  }

  // 触发加载完成事件
  mockLoad(): void {
    this.readyState = 4;
    if (this.onreadystatechange) {
      this.onreadystatechange({} as Event);
    }
    if (this.onload) {
      this.onload({} as Event);
    }
  }

  // 触发错误事件
  mockError(): void {
    if (this.onerror) {
      this.onerror({} as Event);
    }
  }

  // 触发中止事件
  mockAbort(): void {
    if (this.onabort) {
      this.onabort({} as Event);
    }
  }

  // 触发上传进度事件
  mockUploadProgress(loaded: number, total: number): void {
    const progressEvent = {
      lengthComputable: true,
      loaded,
      total,
    } as ProgressEvent;

    if (this.upload.onprogress) {
      this.upload.onprogress(progressEvent);
    }
  }
}

// 安装和清理模拟
beforeAll(() => {
  // 模拟 fetch
  global.fetch = jest.fn();

  // 模拟 AbortController
  (global as any).AbortController = MockAbortController;

  // 模拟 XMLHttpRequest
  (global as any).XMLHttpRequest = jest.fn().mockImplementation(() => new MockXMLHttpRequest());
});

afterAll(() => {
  // 恢复原始对象
  global.fetch = originalFetch;
  (global as any).XMLHttpRequest = originalXMLHttpRequest;
  (global as any).AbortController = originalAbortController;
});

describe('Network Adapters', () => {
  // 每个测试之前重置所有模拟
  beforeEach(() => {
    jest.clearAllMocks();
    ((global as any).XMLHttpRequest as jest.Mock).mockClear();
    mockXhrInstances.length = 0;
  });

  describe('FetchAdapter', () => {
    let adapter: FetchAdapter;

    beforeEach(() => {
      adapter = new FetchAdapter();

      // 模拟成功的fetch响应
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: jest.fn().mockResolvedValue(JSON.stringify({ success: true })),
        json: jest.fn().mockResolvedValue({ success: true }),
        headers: new Headers(),
      });
    });

    test('应该正确发送请求', async () => {
      const config: IRequestConfig = {
        url: 'https://example.com/api',
        method: 'GET',
      };

      const response = await adapter.request(config);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/api',
        expect.objectContaining({
          method: 'GET',
        }),
      );

      expect(response).toEqual(
        expect.objectContaining({
          status: 200,
          statusText: 'OK',
          data: { success: true },
        }),
      );
    });

    test('应该处理请求错误', async () => {
      // 模拟失败的fetch响应
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const config: IRequestConfig = {
        url: 'https://example.com/api',
        method: 'GET',
      };

      await expect(adapter.request(config)).rejects.toThrow('Network error');
    });

    test('应该处理非200响应', async () => {
      // 模拟404响应
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: jest.fn().mockResolvedValue(JSON.stringify({ error: 'Not found' })),
        json: jest.fn().mockResolvedValue({ error: 'Not found' }),
        headers: new Headers(),
      });

      const config: IRequestConfig = {
        url: 'https://example.com/api',
        method: 'GET',
      };

      await expect(adapter.request(config)).rejects.toThrow('请求失败，状态码: 404');
    });

    test('应该支持请求中止', async () => {
      // 创建自定义错误对象，确保它有正确的名称
      const abortError = {
        name: 'AbortError',
        message: 'The operation was aborted',
      };

      // 模拟fetch在中止时抛出AbortError
      (global.fetch as jest.Mock).mockImplementation(() => {
        return new Promise((_, reject) => {
          // 立即返回一个被拒绝的Promise，模拟中止
          reject(abortError);
        });
      });

      const abortController = new MockAbortController();

      const config: IRequestConfig = {
        url: 'https://example.com/api',
        method: 'GET',
        abortController: abortController as unknown as AbortController,
      };

      // 发送请求
      const requestPromise = adapter.request(config);

      // 中止请求
      abortController.abort();

      try {
        await requestPromise;
        fail('请求应该失败');
      } catch (error: any) {
        expect(error.name).toBe('AbortError');
      }
    });
  });

  describe('XhrAdapter', () => {
    let adapter: XhrAdapter;
    let xhr: MockXMLHttpRequest;

    beforeEach(() => {
      // 清空XHR实例数组
      mockXhrInstances.length = 0;

      // 确保XMLHttpRequest的mock计数器被重置
      ((global as any).XMLHttpRequest as jest.Mock).mockClear();

      // 创建适配器
      adapter = new XhrAdapter();
    });

    test('应该正确发送请求', async () => {
      const config: IRequestConfig = {
        url: 'https://example.com/api',
        method: 'GET',
      };

      // 发送请求
      const requestPromise = adapter.request(config);

      // 确保XHR实例已创建
      expect(mockXhrInstances.length).toBeGreaterThan(0);

      // 获取最新创建的XHR实例
      xhr = mockXhrInstances[mockXhrInstances.length - 1];

      // 模拟XHR加载完成
      xhr.mockLoad();

      const response = await requestPromise;

      expect(xhr.open).toHaveBeenCalledWith('GET', 'https://example.com/api', true);
      expect(xhr.send).toHaveBeenCalled();

      expect(response).toEqual(
        expect.objectContaining({
          status: 200,
          statusText: 'OK',
          data: { success: true },
        }),
      );
    });

    test('应该处理请求错误', async () => {
      const config: IRequestConfig = {
        url: 'https://example.com/api',
        method: 'GET',
      };

      // 发送请求
      const requestPromise = adapter.request(config);

      // 确保XHR实例已创建
      expect(mockXhrInstances.length).toBeGreaterThan(0);

      // 获取最新创建的XHR实例
      xhr = mockXhrInstances[mockXhrInstances.length - 1];

      // 模拟XHR错误
      xhr.mockError();

      await expect(requestPromise).rejects.toThrow();
    });

    test('应该处理上传进度事件', async () => {
      const onProgress = jest.fn();
      const config: IRequestConfig = {
        url: 'https://example.com/api',
        method: 'POST',
        onProgress,
      };

      // 发送请求
      const requestPromise = adapter.request(config);

      // 确保XHR实例已创建
      expect(mockXhrInstances.length).toBeGreaterThan(0);

      // 获取最新创建的XHR实例
      xhr = mockXhrInstances[mockXhrInstances.length - 1];

      // 创建进度事件
      const progressEvent = {
        lengthComputable: true,
        loaded: 50,
        total: 100,
      } as ProgressEvent;

      // 直接调用进度回调
      if (xhr.onprogress) {
        xhr.onprogress(progressEvent);
      }

      // 模拟XHR加载完成
      xhr.mockLoad();

      await requestPromise;

      // 验证进度回调被调用，且参数包含正确的加载值和百分比
      expect(onProgress).toHaveBeenCalled();
      const progressArg = onProgress.mock.calls[0][0];
      expect(progressArg.loaded).toBe(50);
      expect(progressArg.percent).toBe(50);
    });

    test('应该支持请求中止', async () => {
      // 使用jest.spyOn来监视abort方法
      jest.spyOn(adapter, 'abort');

      const config: IRequestConfig = {
        url: 'https://example.com/api',
        method: 'GET',
        requestId: 'test-request',
      };

      // 发送请求
      const requestPromise = adapter.request(config);

      // 确保XHR实例已创建
      expect(mockXhrInstances.length).toBeGreaterThan(0);

      // 获取最新创建的XHR实例
      xhr = mockXhrInstances[mockXhrInstances.length - 1];

      // 中止请求
      adapter.abort('test-request');

      // 验证abort方法被调用
      expect(adapter.abort).toHaveBeenCalledWith('test-request');
      expect(xhr.abort).toHaveBeenCalled();

      // 模拟中止事件
      xhr.mockAbort();

      // 确认请求被拒绝
      await expect(requestPromise).rejects.toThrow();
    });
  });
});
