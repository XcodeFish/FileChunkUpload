/**
 * 错误恢复管理器单元测试
 */
import { ErrorCode } from '@file-chunk-uploader/types';

import { createErrorHandler } from '../src/error-handler';
import { UploadError } from '../src/error-types';
import { createRecoveryManager, RecoveryManager } from '../src/recovery';

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
  private _isOnline = true;
  private listeners: Array<() => void> = [];

  isOnline(): boolean {
    return this._isOnline;
  }

  setOnline(online: boolean): void {
    this._isOnline = online;
    if (online) {
      this.listeners.forEach(listener => listener());
    }
  }

  addOnlineListener(listener: () => void): void {
    this.listeners.push(listener);
  }

  removeOnlineListener(listener: () => void): void {
    this.listeners = this.listeners.filter(l => l !== listener);
  }
}

describe('RecoveryManager', () => {
  let errorHandler: ReturnType<typeof createErrorHandler>;
  let recoveryManager: RecoveryManager;
  let eventEmitter: MockEventEmitter;
  let networkDetector: MockNetworkDetector;

  beforeEach(() => {
    errorHandler = createErrorHandler();
    eventEmitter = new MockEventEmitter();
    networkDetector = new MockNetworkDetector();
    recoveryManager = createRecoveryManager(errorHandler, {
      eventEmitter,
      networkDetector,
      config: {
        useSmartDecision: true,
        notifyOnRetry: true,
      },
    }) as RecoveryManager;
  });

  describe('handleError', () => {
    it('应该处理可重试的错误并发出重试事件', async () => {
      const error = new UploadError('网络错误', ErrorCode.NETWORK_ERROR, {
        retryable: true,
        fileId: 'file1',
      });
      const context = { retryCount: 0, timestamp: Date.now(), fileId: 'file1' };

      await recoveryManager.handleError(error, context);

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
      const context = { retryCount: 0, timestamp: Date.now(), fileId: 'file1' };

      // 设置网络为离线
      networkDetector.setOnline(false);

      await recoveryManager.handleError(error, context);

      // 验证等待事件已发出
      const waitingEvents = eventEmitter.getEvents('retry:waiting');
      expect(waitingEvents.length).toBe(1);
      expect(waitingEvents[0].fileId).toBe('file1');
      expect(waitingEvents[0].reason).toBe('network_disconnect');

      // 模拟网络恢复
      eventEmitter.clearEvents();
      networkDetector.setOnline(true);

      // 验证网络恢复事件已发出
      const recoveredEvents = eventEmitter.getEvents('retry:network_recovered');
      expect(recoveredEvents.length).toBeGreaterThan(0);
    });

    it('应该处理分片大小无效错误并调整分片大小', async () => {
      const error = new UploadError('分片大小无效', ErrorCode.CHUNK_SIZE_INVALID, {
        retryable: true,
        fileId: 'file1',
      });
      const context = {
        retryCount: 0,
        timestamp: Date.now(),
        fileId: 'file1',
        chunkIndex: 1,
        chunkSize: 1024 * 1024,
      };

      await recoveryManager.handleError(error, context);

      // 验证调整分片大小事件已发出
      const adjustEvents = eventEmitter.getEvents('retry:adjusting');
      expect(adjustEvents.length).toBe(1);
      expect(adjustEvents[0].fileId).toBe('file1');
      expect(adjustEvents[0].chunkIndex).toBe(1);
      expect(adjustEvents[0].oldChunkSize).toBe(1024 * 1024);
    });

    it('应该处理不可重试的错误并发出失败事件', async () => {
      const error = new UploadError('存储配额已满', ErrorCode.QUOTA_EXCEEDED, {
        retryable: false,
        fileId: 'file1',
      });
      const context = { retryCount: 0, timestamp: Date.now(), fileId: 'file1' };

      await recoveryManager.handleError(error, context);

      // 验证失败事件已发出
      const failedEvents = eventEmitter.getEvents('retry:failed');
      expect(failedEvents.length).toBe(1);
      expect(failedEvents[0].fileId).toBe('file1');
      expect(failedEvents[0].recoverable).toBe(false);
    });
  });

  describe('handleRetrySuccess', () => {
    it('应该正确处理重试成功', async () => {
      const context = { retryCount: 1, timestamp: Date.now(), fileId: 'file1', chunkIndex: 1 };

      await recoveryManager.handleRetrySuccess(context);

      // 验证成功事件已发出
      const successEvents = eventEmitter.getEvents('retry:success');
      expect(successEvents.length).toBe(1);
      expect(successEvents[0].fileId).toBe('file1');
      expect(successEvents[0].chunkIndex).toBe(1);
      expect(successEvents[0].successCount).toBe(1);
    });
  });

  describe('cleanup', () => {
    it('应该清理所有资源', async () => {
      // 添加一些错误和任务
      const error = new UploadError('网络错误', ErrorCode.NETWORK_ERROR, {
        retryable: true,
        fileId: 'file1',
      });
      const context = { retryCount: 0, timestamp: Date.now(), fileId: 'file1' };

      await recoveryManager.handleError(error, context);

      // 执行清理
      await recoveryManager.cleanup();

      // 验证后续操作不会产生事件
      eventEmitter.clearEvents();
      await recoveryManager.handleRetrySuccess(context);

      // 应该没有新事件产生
      expect(eventEmitter.getEvents('retry:success').length).toBe(0);
    });
  });
});
