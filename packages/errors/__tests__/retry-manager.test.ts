/**
 * 重试管理器单元测试
 */
import { ErrorCode } from '@file-chunk-uploader/types';

import { UploadError } from '../src/error-types';
import { createRetryManager, RetryManager } from '../src/recovery';
import { ExtendedErrorContext } from '../src/recovery/retry-types';

// 模拟事件发射器
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

// 模拟网络检测器
class MockNetworkDetector {
  private _online = true;
  private listeners: Array<(network: any) => void> = [];

  getCurrentNetwork(): any {
    return {
      online: this._online,
      type: 'wifi',
      speed: 10,
      rtt: 50,
      lastChecked: Date.now(),
    };
  }

  setOnline(online: boolean): void {
    this._online = online;
    if (online) {
      const network = this.getCurrentNetwork();
      this.listeners.forEach(listener => listener(network));
    }
  }

  onNetworkChange(callback: (network: any) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  cleanup(): void {
    this.listeners = [];
  }
}

describe('RetryManager', () => {
  let retryManager: RetryManager;
  let eventEmitter: MockEventEmitter;
  let networkDetector: MockNetworkDetector;

  beforeEach(() => {
    eventEmitter = new MockEventEmitter();
    networkDetector = new MockNetworkDetector();
    retryManager = createRetryManager({
      eventEmitter,
      networkDetector,
      config: {
        enabled: true,
        maxRetries: 3,
        useExponentialBackoff: true,
      },
    }) as unknown as RetryManager;
  });

  describe('retry', () => {
    it('应该处理可重试的错误并发出重试事件', async () => {
      const error = new UploadError('网络错误', ErrorCode.NETWORK_ERROR, {
        retryable: true,
        fileId: 'file1',
      });
      const context: ExtendedErrorContext = {
        retryCount: 0,
        timestamp: Date.now(),
        fileId: 'file1',
      };

      await retryManager.retry(error, context, async () => {
        // 模拟重试处理函数
      });

      // 验证重试开始事件已发出
      const retryEvents = eventEmitter.getEvents('retry:start');
      expect(retryEvents.length).toBe(1);
      expect(retryEvents[0].fileId).toBe('file1');
      expect(retryEvents[0].retryCount).toBe(0);
    });

    it('应该处理网络断开错误并等待网络恢复', async () => {
      const error = new UploadError('网络连接断开', ErrorCode.NETWORK_DISCONNECT, {
        retryable: true,
        fileId: 'file1',
      });
      const context: ExtendedErrorContext = {
        retryCount: 0,
        timestamp: Date.now(),
        fileId: 'file1',
      };

      // 设置网络为离线
      networkDetector.setOnline(false);

      await retryManager.retry(error, context, async () => {
        // 模拟重试处理函数
      });

      // 模拟网络恢复
      eventEmitter.clearEvents();
      networkDetector.setOnline(true);

      // 等待一段时间让重试任务执行
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('应该处理不可重试的错误并发出失败事件', async () => {
      const error = new UploadError('存储配额已满', ErrorCode.QUOTA_EXCEEDED, {
        retryable: false,
        fileId: 'file1',
      });
      const context: ExtendedErrorContext = {
        retryCount: 0,
        timestamp: Date.now(),
        fileId: 'file1',
      };

      await retryManager.retry(error, context, async () => {
        // 模拟重试处理函数
      });

      // 验证失败事件已发出
      const failedEvents = eventEmitter.getEvents('retry:failed');
      expect(failedEvents.length).toBe(1);
      expect(failedEvents[0].fileId).toBe('file1');
      expect(failedEvents[0].recoverable).toBe(false);
    });
  });

  describe('handleRetrySuccess', () => {
    it('应该正确处理重试成功', async () => {
      const context: ExtendedErrorContext = {
        retryCount: 1,
        timestamp: Date.now(),
        fileId: 'file1',
        chunkIndex: 1,
        startTime: Date.now() - 1000,
      };

      await retryManager.handleRetrySuccess(context);

      // 验证成功事件已发出
      const successEvents = eventEmitter.getEvents('retry:success');
      expect(successEvents.length).toBe(1);
      expect(successEvents[0].fileId).toBe('file1');
      expect(successEvents[0].chunkIndex).toBe(1);
    });
  });

  describe('cleanup', () => {
    it('应该清理所有资源', async () => {
      // 添加一些错误和任务
      const error = new UploadError('网络错误', ErrorCode.NETWORK_ERROR, {
        retryable: true,
        fileId: 'file1',
      });
      const context: ExtendedErrorContext = {
        retryCount: 0,
        timestamp: Date.now(),
        fileId: 'file1',
      };

      await retryManager.retry(error, context, async () => {
        // 模拟重试处理函数
      });

      // 执行清理
      await retryManager.cleanup();

      // 验证后续操作不会产生事件
      eventEmitter.clearEvents();
      await retryManager.handleRetrySuccess(context);

      // 应该没有新事件产生
      expect(eventEmitter.getEvents('retry:success').length).toBe(0);
    });
  });
});
