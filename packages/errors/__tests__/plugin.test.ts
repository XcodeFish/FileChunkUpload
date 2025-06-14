/**
 * 错误处理插件单元测试
 */
import { ErrorCode } from '@file-chunk-uploader/types';

import { UploadError } from '../src/error-types';
import { errorPlugin } from '../src/plugin';

// 模拟上传器核心
class MockUploaderCore {
  hooks: Record<string, Array<(...args: any[]) => any>> = {};
  events: Record<string, any[]> = {};

  registerHook(hookName: string, handler: (...args: any[]) => any): void {
    if (!this.hooks[hookName]) {
      this.hooks[hookName] = [];
    }
    this.hooks[hookName].push(handler);
  }

  async executeHook(hookName: string, ...args: any[]): Promise<void> {
    const handlers = this.hooks[hookName] || [];
    for (const handler of handlers) {
      await handler(...args);
    }
  }

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

describe('ErrorPlugin', () => {
  let uploaderCore: MockUploaderCore;
  let plugin: ReturnType<typeof errorPlugin>;

  beforeEach(() => {
    uploaderCore = new MockUploaderCore();
    plugin = errorPlugin({
      errorHandler: {
        maxRetries: 2,
        baseDelay: 100,
      },
      recovery: {
        useSmartDecision: true,
        notifyOnRetry: true,
      },
    });
  });

  it('应该正确安装插件', () => {
    plugin.install(uploaderCore as any);
    expect(uploaderCore.hooks['onError']).toBeDefined();
    expect(uploaderCore.hooks['onRetrySuccess']).toBeDefined();
    expect(uploaderCore.hooks['onDestroy']).toBeDefined();
  });

  it('应该处理错误并发出重试事件', async () => {
    plugin.install(uploaderCore as any);

    const error = new UploadError('网络错误', ErrorCode.NETWORK_ERROR, {
      retryable: true,
      fileId: 'file1',
    });
    const context = { retryCount: 0, timestamp: Date.now(), fileId: 'file1' };

    await uploaderCore.executeHook('onError', error, context);

    // 验证重试事件已发出
    const retryEvents = uploaderCore.getEvents('retry:start');
    expect(retryEvents.length).toBe(1);
    expect(retryEvents[0].fileId).toBe('file1');
  });

  it('应该处理重试成功', async () => {
    plugin.install(uploaderCore as any);

    const context = { retryCount: 1, timestamp: Date.now(), fileId: 'file1', chunkIndex: 1 };

    await uploaderCore.executeHook('onRetrySuccess', context);

    // 验证成功事件已发出
    const successEvents = uploaderCore.getEvents('retry:success');
    expect(successEvents.length).toBe(1);
    expect(successEvents[0].fileId).toBe('file1');
  });

  it('应该在禁用时不安装', () => {
    const disabledPlugin = errorPlugin({ enabled: false });
    disabledPlugin.install(uploaderCore as any);

    // 验证没有钩子被注册
    expect(uploaderCore.hooks['onError']).toBeUndefined();
  });
});
