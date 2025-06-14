/**
 * 错误处理器事件通知和日志功能测试
 */
import { ErrorHandler, createErrorHandler } from '../src/error-handler';
import { UploadError } from '../src/error-types';

// 模拟Logger
class MockLogger {
  logs: Array<{ level: string; category: string; message: string; data?: any }> = [];

  debug(category: string, message: string, data?: any): void {
    this.logs.push({ level: 'debug', category, message, data });
  }

  info(category: string, message: string, data?: any): void {
    this.logs.push({ level: 'info', category, message, data });
  }

  warn(category: string, message: string, data?: any): void {
    this.logs.push({ level: 'warn', category, message, data });
  }

  error(category: string, message: string, data?: any): void {
    this.logs.push({ level: 'error', category, message, data });
  }

  clear(): void {
    this.logs = [];
  }
}

// 模拟EventEmitter
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

  getAllEvents(): Record<string, any[]> {
    return this.events;
  }

  clear(): void {
    this.events = {};
  }
}

describe('ErrorHandler 事件通知和日志功能', () => {
  let errorHandler: ErrorHandler;
  let logger: MockLogger;
  let eventEmitter: MockEventEmitter;

  beforeEach(() => {
    logger = new MockLogger();
    eventEmitter = new MockEventEmitter();
    errorHandler = createErrorHandler(
      {
        verbose: true,
        notifyOnError: true,
      },
      logger as any,
      eventEmitter as any,
    ) as ErrorHandler;
  });

  afterEach(() => {
    logger.clear();
    eventEmitter.clear();
  });

  test('应该记录错误日志', () => {
    const error = new UploadError('上传失败', 'network_error', {
      fileId: 'file-1',
      chunkIndex: 2,
    });

    const context = {
      fileId: 'file-1',
      chunkIndex: 2,
      retryCount: 0,
      timestamp: Date.now(),
    };

    errorHandler.handle(error, context);

    // 检查是否记录了错误日志
    expect(logger.logs.length).toBeGreaterThan(0);
    expect(logger.logs[0].level).toBe('error');
    expect(logger.logs[0].category).toBe('errors');
    expect(logger.logs[0].message).toContain('network_error');
  });

  test('应该记录重试决策日志', () => {
    const error = new UploadError('上传失败', 'network_error', {
      fileId: 'file-1',
      chunkIndex: 2,
      retryable: true,
    });

    const context = {
      fileId: 'file-1',
      chunkIndex: 2,
      retryCount: 0,
      timestamp: Date.now(),
    };

    errorHandler.handle(error, context);

    // 查找决策日志
    const decisionLog = logger.logs.find(
      log => log.level === 'info' && log.message.includes('决策: 重试上传'),
    );

    expect(decisionLog).toBeDefined();
    expect(decisionLog!.data).toHaveProperty('retryCount', 0);
    expect(decisionLog!.data).toHaveProperty('fileId', 'file-1');
    expect(decisionLog!.data).toHaveProperty('chunkIndex', 2);
  });

  test('应该发送错误事件通知', () => {
    const error = new UploadError('上传失败', 'network_error', {
      fileId: 'file-1',
      chunkIndex: 2,
    });

    const context = {
      fileId: 'file-1',
      chunkIndex: 2,
      retryCount: 0,
      timestamp: Date.now(),
    };

    errorHandler.handle(error, context);

    // 检查通用错误事件
    expect(eventEmitter.getEvents('error').length).toBe(1);
    expect(eventEmitter.getEvents('error')[0]).toHaveProperty('error', error);
    expect(eventEmitter.getEvents('error')[0]).toHaveProperty('context', context);

    // 检查错误类型特定事件
    expect(eventEmitter.getEvents('error:network_error').length).toBe(1);

    // 检查文件特定错误事件
    expect(eventEmitter.getEvents('file:file-1:error').length).toBe(1);
  });

  test('应该处理不可重试的错误', () => {
    const error = new UploadError('存储配额已满', 'quota_exceeded', {
      fileId: 'file-1',
      retryable: false,
    });

    const context = {
      fileId: 'file-1',
      retryCount: 0,
      timestamp: Date.now(),
    };

    const action = errorHandler.handle(error, context);

    // 检查结果是失败
    expect(action.type).toBe('fail');
    expect(action.recoverable).toBe(false);

    // 查找失败决策日志
    const decisionLog = logger.logs.find(
      log => log.level === 'info' && log.message.includes('决策: 上传失败'),
    );

    expect(decisionLog).toBeDefined();
    expect(decisionLog!.data).toHaveProperty('recoverable', false);
  });

  test('应该跳过日志记录和事件通知（当禁用时）', () => {
    // 创建一个禁用了日志和事件的处理器
    const silentHandler = createErrorHandler(
      {
        verbose: false,
        notifyOnError: false,
      },
      logger as any,
      eventEmitter as any,
    );

    const error = new UploadError('上传失败', 'network_error');
    const context = { retryCount: 0, timestamp: Date.now() };

    silentHandler.handle(error, context);

    // 应该只有错误日志，没有决策日志
    const errorLogs = logger.logs.filter(log => log.level === 'error');
    const infoLogs = logger.logs.filter(log => log.level === 'info');

    expect(errorLogs.length).toBe(1);
    expect(infoLogs.length).toBe(0);

    // 不应该发出事件
    expect(Object.keys(eventEmitter.getAllEvents()).length).toBe(0);
  });
});
