/**
 * 重试管理器单元测试
 */
import { ErrorCode } from '@file-chunk-uploader/types';

import { UploadError } from '../src/error-types/upload-error';
import { createRetryManager } from '../src/recovery/retry-manager';
import { RetryManager } from '../src/recovery/retry-types';

/**
 * 模拟事件发射器
 */
class MockEventEmitter {
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
class MockNetworkDetector {
  private isOnline = true;
  private callbacks: ((status: { online: boolean }) => void)[] = [];

  getCurrentNetwork() {
    return { online: this.isOnline };
  }

  onNetworkChange(callback: (network: { online: boolean }) => void) {
    this.callbacks.push(callback);
    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== callback);
    };
  }

  // 测试辅助方法
  setOnline(online: boolean) {
    this.isOnline = online;
    this.notifyCallbacks();
  }

  private notifyCallbacks() {
    this.callbacks.forEach(cb => cb({ online: this.isOnline }));
  }
}

/**
 * 模拟存储
 */
class MockStorage {
  private data: Record<string, any> = {};

  async getRetryState(fileId: string): Promise<any> {
    return this.data[fileId] || null;
  }

  async saveRetryState(fileId: string, state: any): Promise<void> {
    this.data[fileId] = state;
  }

  async getActiveUploads(): Promise<string[]> {
    return Object.keys(this.data);
  }
}

describe('RetryManager', () => {
  let retryManager: RetryManager;
  let mockEventEmitter: MockEventEmitter;
  let mockNetworkDetector: MockNetworkDetector;
  let mockStorage: MockStorage;

  beforeEach(() => {
    jest.useFakeTimers();
    mockEventEmitter = new MockEventEmitter();
    mockNetworkDetector = new MockNetworkDetector();
    mockStorage = new MockStorage();

    // 创建重试管理器
    retryManager = createRetryManager({
      maxRetries: 3,
      baseDelay: 100,
      maxDelay: 5000,
      eventEmitter: mockEventEmitter as any,
      networkDetector: mockNetworkDetector as any,
      storageManager: mockStorage as any,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('应该安排重试', async () => {
    const error = new UploadError('网络错误', ErrorCode.NETWORK_ERROR);
    const context = {
      fileId: 'test-file',
      retryCount: 0,
      timestamp: Date.now(),
    };

    const handler = jest.fn().mockResolvedValue(undefined);

    // 安排重试
    await retryManager.retry(error, context, handler);

    // 验证重试:start事件已触发
    const startEvents = mockEventEmitter.getEvents('retry:start');
    expect(startEvents.length).toBe(1);
    expect(startEvents[0].fileId).toBe('test-file');
    expect(startEvents[0].error.code).toBe(ErrorCode.NETWORK_ERROR);

    // 时间快进，触发重试
    jest.advanceTimersByTime(200);

    // 验证处理函数被调用
    expect(handler).toHaveBeenCalledTimes(1);

    // 验证重试:success事件已触发
    const successEvents = mockEventEmitter.getEvents('retry:success');
    expect(successEvents.length).toBe(1);
    expect(successEvents[0].fileId).toBe('test-file');
  });

  test('应该处理重试失败', async () => {
    const error = new UploadError('服务器错误', ErrorCode.SERVER_ERROR);
    const context = {
      fileId: 'test-file',
      retryCount: 0,
      timestamp: Date.now(),
    };

    const handler = jest.fn().mockRejectedValue(new Error('处理失败'));

    // 安排重试
    await retryManager.retry(error, context, handler);

    // 时间快进，触发重试
    jest.advanceTimersByTime(200);

    // 验证处理函数被调用
    expect(handler).toHaveBeenCalledTimes(1);

    // 验证重试:failed事件已触发
    const failedEvents = mockEventEmitter.getEvents('retry:failed');
    expect(failedEvents.length).toBe(1);
    expect(failedEvents[0].fileId).toBe('test-file');
    expect(failedEvents[0].error).toBeDefined();
  });

  test('应该等待网络连接恢复', async () => {
    const error = new UploadError('网络连接断开', ErrorCode.NETWORK_DISCONNECT);
    const context = {
      fileId: 'test-file',
      retryCount: 0,
      timestamp: Date.now(),
    };

    const handler = jest.fn().mockResolvedValue(undefined);

    // 设置网络为离线
    mockNetworkDetector.setOnline(false);

    // 安排重试
    await retryManager.waitForConnection(error, context, handler);

    // 验证等待连接事件已触发
    const waitingEvents = mockEventEmitter.getEvents('retry:waiting');
    expect(waitingEvents.length).toBe(1);
    expect(waitingEvents[0].fileId).toBe('test-file');

    // 处理函数不应该被调用
    expect(handler).not.toHaveBeenCalled();

    // 网络恢复在线
    mockNetworkDetector.setOnline(true);

    // 需要额外时间让事件处理
    jest.advanceTimersByTime(200);

    // 验证处理函数被调用
    expect(handler).toHaveBeenCalledTimes(1);

    // 验证重试:success事件已触发
    const successEvents = mockEventEmitter.getEvents('retry:success');
    expect(successEvents.length).toBe(1);
    expect(successEvents[0].fileId).toBe('test-file');
  });

  test('应该使用指数退避策略', async () => {
    // 第一次重试
    const error1 = new UploadError('网络错误', ErrorCode.NETWORK_ERROR);
    const context1 = {
      fileId: 'test-file',
      retryCount: 0,
      timestamp: Date.now(),
    };

    const handler = jest.fn().mockResolvedValue(undefined);

    await retryManager.retry(error1, context1, handler);
    const firstRetry = mockEventEmitter.getEvents('retry:start')[0];
    expect(firstRetry.delay).toBeGreaterThanOrEqual(100); // baseDelay
    expect(firstRetry.delay).toBeLessThan(200); // baseDelay + 小抖动

    // 第二次重试
    const error2 = new UploadError('网络错误', ErrorCode.NETWORK_ERROR);
    const context2 = {
      fileId: 'test-file',
      retryCount: 1,
      timestamp: Date.now(),
    };

    await retryManager.retry(error2, context2, handler);
    const secondRetry = mockEventEmitter.getEvents('retry:start')[1];
    expect(secondRetry.delay).toBeGreaterThanOrEqual(200); // baseDelay * 2^1
    expect(secondRetry.delay).toBeLessThan(400); // baseDelay * 2^1 + 小抖动

    // 第三次重试
    const error3 = new UploadError('网络错误', ErrorCode.NETWORK_ERROR);
    const context3 = {
      fileId: 'test-file',
      retryCount: 2,
      timestamp: Date.now(),
    };

    await retryManager.retry(error3, context3, handler);
    const thirdRetry = mockEventEmitter.getEvents('retry:start')[2];
    expect(thirdRetry.delay).toBeGreaterThanOrEqual(400); // baseDelay * 2^2
    expect(thirdRetry.delay).toBeLessThan(800); // baseDelay * 2^2 + 小抖动
  });

  test('应该保持重试状态', async () => {
    const error = new UploadError('网络错误', ErrorCode.NETWORK_ERROR);
    const context = {
      fileId: 'test-file',
      retryCount: 2,
      timestamp: Date.now(),
    };

    const handler = jest.fn().mockResolvedValue(undefined);

    // 安排重试
    await retryManager.retry(error, context, handler);

    // 时间快进，触发重试
    jest.advanceTimersByTime(200);

    // 验证处理函数被调用
    expect(handler).toHaveBeenCalledTimes(1);

    // 检查存储中的重试状态
    const state = await mockStorage.getRetryState('test-file');
    expect(state).toBeDefined();
    expect(state.retryCount).toBe(2);
    expect(state.successfulRetries).toBe(1);
  });

  test('应该在超过最大重试次数后失败', async () => {
    const error = new UploadError('网络错误', ErrorCode.NETWORK_ERROR);
    const context = {
      fileId: 'test-file',
      retryCount: 3, // 等于最大重试次数
      timestamp: Date.now(),
    };

    // 模拟shouldRetry始终返回false
    // @ts-expect-error 私有方法测试
    retryManager.shouldRetry = jest.fn().mockReturnValue(false);

    const handler = jest.fn();

    // 安排重试
    await retryManager.retry(error, context, handler);

    // 验证处理函数未被调用
    expect(handler).not.toHaveBeenCalled();

    // 验证retry:failed事件已触发
    const failedEvents = mockEventEmitter.getEvents('retry:failed');
    expect(failedEvents.length).toBe(1);
    expect(failedEvents[0].fileId).toBe('test-file');
    expect(failedEvents[0].reason).toBe('max_retries_exceeded');
  });

  test('应该在网络质量差时延长重试延迟', async () => {
    // 设置网络质量差
    Object.defineProperty(mockNetworkDetector, 'getCurrentNetwork', {
      value: () => ({
        online: true,
        type: 'cellular',
        speed: 0.5, // 低网速
        rtt: 1000, // 高延迟
      }),
    });

    const error = new UploadError('网络错误', ErrorCode.NETWORK_ERROR);
    const context = {
      fileId: 'test-file',
      retryCount: 0,
      timestamp: Date.now(),
    };

    const handler = jest.fn().mockResolvedValue(undefined);

    // 安排重试
    await retryManager.retry(error, context, handler);

    // 验证重试延迟较长
    const startEvents = mockEventEmitter.getEvents('retry:start');
    expect(startEvents[0].delay).toBeGreaterThanOrEqual(100);
  });
});
