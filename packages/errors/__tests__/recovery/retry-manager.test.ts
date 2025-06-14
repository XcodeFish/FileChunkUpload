/**
 * 重试管理器单元测试
 */
import { createRetryManager } from '../../src/recovery/retry-manager';
import {
  RetryManager,
  NetworkDetector,
  EventEmitter,
  StorageManager,
} from '../../src/recovery/retry-types';

/**
 * 模拟事件发射器
 */
class MockEventEmitter implements EventEmitter {
  events: Record<string, any[]> = {};

  emit(event: string, data: any): void {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(data);
  }

  getEvents(event: string): any[] {
    return this.events[event] || [];
  }

  clearEvents(): void {
    this.events = {};
  }
}

/**
 * 模拟网络检测器
 */
class MockNetworkDetector implements NetworkDetector {
  private networkInfo = {
    online: true,
    type: 'wifi' as const,
    speed: 10,
    rtt: 50,
  };

  private listeners: Array<(network: any) => void> = [];

  getCurrentNetwork() {
    return { ...this.networkInfo };
  }

  onNetworkChange(callback: (network: any) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
    };
  }

  setNetworkStatus(status: Partial<typeof this.networkInfo>) {
    this.networkInfo = { ...this.networkInfo, ...status };
    this.notifyListeners();
  }

  private notifyListeners() {
    const networkInfo = this.getCurrentNetwork();
    this.listeners.forEach(listener => listener(networkInfo));
  }

  cleanup(): void {
    this.listeners = [];
  }
}

/**
 * 模拟存储管理器
 */
class MockStorageManager implements StorageManager {
  private storage: Record<string, any> = {};

  async saveRetryState(fileId: string, state: any): Promise<void> {
    this.storage[fileId] = state;
  }

  async getRetryState(fileId: string): Promise<any> {
    return this.storage[fileId] || null;
  }

  async getActiveUploads(): Promise<string[]> {
    return Object.keys(this.storage);
  }

  async deleteRetryState(fileId: string): Promise<void> {
    delete this.storage[fileId];
  }

  async clearRetryState(fileId: string): Promise<void> {
    delete this.storage[fileId];
  }

  async clearAllRetryStates(): Promise<void> {
    this.storage = {};
  }
}

describe('RetryManager', () => {
  let retryManager: RetryManager;
  let eventEmitter: MockEventEmitter;
  let networkDetector: MockNetworkDetector;
  let storageManager: MockStorageManager;

  beforeEach(() => {
    // 设置测试环境
    eventEmitter = new MockEventEmitter();
    networkDetector = new MockNetworkDetector();
    storageManager = new MockStorageManager();

    // 创建重试管理器实例
    retryManager = createRetryManager({
      eventEmitter,
      networkDetector,
      storageManager,
      config: {
        enabled: true,
        maxRetries: 3,
        baseDelay: 10, // 测试中使用较短的延迟
        maxDelay: 500,
        useExponentialBackoff: true,
      },
    });

    // Mock定时器
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('retry', () => {
    it('应该安排并执行重试任务', async () => {
      // 创建错误和上下文
      const error = {
        name: 'NetworkError',
        message: '网络连接失败',
        code: 'network_error',
        retryable: true,
        timestamp: Date.now(),
      };

      const context = {
        fileId: 'test-file-1',
        retryCount: 0,
        timestamp: Date.now(),
      };

      // 创建处理函数（模拟上传任务）
      const handler = jest.fn().mockResolvedValue(undefined);

      // 执行重试
      await retryManager.retry(error, context, handler);

      // 验证事件发出
      const startEvents = eventEmitter.getEvents('retry:start');
      expect(startEvents.length).toBe(1);
      expect(startEvents[0].fileId).toBe('test-file-1');
      expect(startEvents[0].retryCount).toBe(0);

      // 快进时间来触发任务
      jest.advanceTimersByTime(50);

      // 验证处理函数被调用
      expect(handler).toHaveBeenCalledTimes(1);

      // 验证重试成功事件发出
      const successEvents = eventEmitter.getEvents('retry:success');
      expect(successEvents.length).toBe(1);
      expect(successEvents[0].fileId).toBe('test-file-1');
    });

    it('应该在重试失败时正确处理错误', async () => {
      // 创建错误和上下文
      const error = {
        name: 'NetworkError',
        message: '网络连接失败',
        code: 'network_error',
        retryable: true,
        timestamp: Date.now(),
      };

      const context = {
        fileId: 'test-file-2',
        retryCount: 0,
        timestamp: Date.now(),
      };

      // 创建会失败的处理函数
      const handler = jest.fn().mockRejectedValue(new Error('处理失败'));

      // 执行重试
      await retryManager.retry(error, context, handler);

      // 快进时间来触发任务
      jest.advanceTimersByTime(50);

      // 验证处理函数被调用
      expect(handler).toHaveBeenCalledTimes(1);

      // 验证重试失败事件发出
      const failedEvents = eventEmitter.getEvents('retry:failed');
      expect(failedEvents.length).toBe(1);
      expect(failedEvents[0].fileId).toBe('test-file-2');
    });

    it('应该使用指数退避策略增加重试延迟', async () => {
      const error = {
        name: 'NetworkError',
        message: '网络连接失败',
        code: 'network_error',
        retryable: true,
        timestamp: Date.now(),
      };

      const context = {
        fileId: 'test-file-3',
        retryCount: 0,
        timestamp: Date.now(),
      };

      const handler = jest.fn().mockResolvedValue(undefined);

      // 执行首次重试
      await retryManager.retry(error, context, handler);

      // 验证首次重试事件的延迟
      const firstRetry = eventEmitter.getEvents('retry:start')[0];
      expect(firstRetry.delay).toBeGreaterThanOrEqual(10); // baseDelay = 10
      expect(firstRetry.delay).toBeLessThan(20); // baseDelay + jitter

      // 快进时间触发首次重试
      jest.advanceTimersByTime(50);

      // 模拟第二次重试
      const contextRetry2 = { ...context, retryCount: 1, timestamp: Date.now() };
      await retryManager.retry(error, contextRetry2, handler);

      // 验证第二次重试事件的延迟
      const secondRetry = eventEmitter.getEvents('retry:start')[1];
      expect(secondRetry.delay).toBeGreaterThanOrEqual(20); // baseDelay * 2^1
    });

    it('应该在达到最大重试次数后停止重试', async () => {
      const error = {
        name: 'NetworkError',
        message: '网络连接失败',
        code: 'network_error',
        retryable: true,
        timestamp: Date.now(),
      };

      // 已达到最大重试次数的上下文
      const context = {
        fileId: 'test-file-4',
        retryCount: 3, // 配置的maxRetries为3
        timestamp: Date.now(),
      };

      const handler = jest.fn().mockResolvedValue(undefined);

      // 执行重试
      await retryManager.retry(error, context, handler);

      // 验证重试失败事件发出
      const failedEvents = eventEmitter.getEvents('retry:failed');
      expect(failedEvents.length).toBe(1);
      expect(failedEvents[0].fileId).toBe('test-file-4');
      expect(failedEvents[0].reason).toContain('最大重试次数');

      // 验证处理函数未被调用
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('配置和状态管理', () => {
    it('应该保存和恢复重试状态', async () => {
      // 创建错误和上下文
      const error = {
        name: 'NetworkError',
        message: '网络连接失败',
        code: 'network_error',
        retryable: true,
        timestamp: Date.now(),
      };

      const context = {
        fileId: 'test-file-5',
        retryCount: 0,
        timestamp: Date.now(),
      };

      // 执行重试
      await retryManager.retry(error, context, jest.fn().mockResolvedValue(undefined));

      // 验证状态已保存
      const state = await storageManager.getRetryState('test-file-5');
      expect(state).toBeDefined();
      expect(state.fileId).toBe('test-file-5');
      expect(state.retryCount).toBe(1);
    });
  });

  describe('持久化和恢复', () => {
    it('应该保存重试状态', async () => {
      // 创建错误和上下文
      const error = {
        name: 'NetworkError',
        message: '网络连接失败',
        code: 'network_error',
        retryable: true,
        timestamp: Date.now(),
      };

      const context = {
        fileId: 'test-file-6',
        retryCount: 0,
        timestamp: Date.now(),
      };

      // 执行重试
      await retryManager.retry(error, context, jest.fn().mockResolvedValue(undefined));

      // 验证状态已保存
      const state = await storageManager.getRetryState('test-file-6');
      expect(state).toBeDefined();
      expect(state.fileId).toBe('test-file-6');
    });

    it('应该清除重试状态', async () => {
      // 创建错误和上下文
      const error = {
        name: 'NetworkError',
        message: '网络连接失败',
        code: 'network_error',
        retryable: true,
        timestamp: Date.now(),
      };

      const context = {
        fileId: 'test-file-7',
        retryCount: 0,
        timestamp: Date.now(),
      };

      // 执行重试
      await retryManager.retry(error, context, jest.fn().mockResolvedValue(undefined));

      // 清除状态
      await storageManager.deleteRetryState('test-file-7');

      // 验证状态已清除
      const state = await storageManager.getRetryState('test-file-7');
      expect(state).toBeNull();
    });
  });
});
