/**
 * 错误处理器单元测试
 */
import { ErrorCode } from '@file-chunk-uploader/types';

import { ErrorHandler, ErrorHandlerConfig } from '../src/error-handler/error-handler';
import { UploadError } from '../src/error-types/upload-error';

describe('ErrorHandler', () => {
  // 创建基本错误处理器配置
  const defaultConfig: ErrorHandlerConfig = {
    maxRetries: 3,
    baseDelay: 100,
    maxDelay: 3000,
    useExponentialBackoff: true,
  };

  test('处理可重试的网络错误', () => {
    const handler = new ErrorHandler(defaultConfig);
    const error = new UploadError('网络连接失败', ErrorCode.NETWORK_ERROR);
    const context = {
      fileId: 'test-123',
      retryCount: 0,
      timestamp: Date.now(),
    };

    const action = handler.handle(error, context);

    expect(action.type).toBe('retry');
    expect(action.delay).toBeGreaterThan(0);
  });

  test('处理网络断开错误', () => {
    const handler = new ErrorHandler(defaultConfig);
    const error = new UploadError('网络连接断开', ErrorCode.NETWORK_DISCONNECT);
    const context = {
      fileId: 'test-123',
      retryCount: 0,
      timestamp: Date.now(),
    };

    const action = handler.handle(error, context);

    expect(action.type).toBe('wait_for_connection');
  });

  test('处理服务器过载错误', () => {
    const handler = new ErrorHandler(defaultConfig);
    const error = new UploadError('服务器繁忙', ErrorCode.SERVER_OVERLOAD);
    const context = {
      fileId: 'test-123',
      retryCount: 4, // 超出默认最大重试次数
      timestamp: Date.now(),
    };

    const action = handler.handle(error, context);

    // 即使超出最大重试次数，服务器过载仍会再尝试一次
    expect(action.type).toBe('retry');
    expect(action.delay).toBe(30000); // 特殊延迟
  });

  test('处理配额超出错误', () => {
    const handler = new ErrorHandler(defaultConfig);
    const error = new UploadError('存储配额已满', ErrorCode.QUOTA_EXCEEDED, {
      retryable: false,
    });
    const context = {
      fileId: 'test-123',
      retryCount: 0,
      timestamp: Date.now(),
    };

    const action = handler.handle(error, context);

    expect(action.type).toBe('fail');
    expect(action.recoverable).toBe(false);
  });

  test('处理分片大小无效错误', () => {
    const handler = new ErrorHandler(defaultConfig);
    const error = new UploadError('分片大小无效', ErrorCode.INVALID_CHUNK_SIZE);
    const context = {
      fileId: 'test-123',
      retryCount: 0,
      timestamp: Date.now(),
      chunkSize: 1024 * 1024, // 1MB
    };

    const action = handler.handle(error, context);

    expect(action.type).toBe('adjust_and_retry');
    expect((action as any).newChunkSize).toBe(512 * 1024); // 减半
  });

  test('超过最大重试次数后失败', () => {
    const handler = new ErrorHandler(defaultConfig);
    const error = new UploadError('网络连接失败', ErrorCode.NETWORK_ERROR);
    const context = {
      fileId: 'test-123',
      retryCount: 3, // 等于最大重试次数
      timestamp: Date.now(),
    };

    const action = handler.handle(error, context);

    expect(action.type).toBe('fail');
    expect(action.recoverable).toBe(true);
  });

  test('不可重试的错误直接失败', () => {
    const handler = new ErrorHandler(defaultConfig);
    const error = new UploadError('文件类型不允许', ErrorCode.FILE_TYPE_NOT_ALLOWED, {
      retryable: false,
    });
    const context = {
      fileId: 'test-123',
      retryCount: 0,
      timestamp: Date.now(),
    };

    const action = handler.handle(error, context);

    expect(action.type).toBe('fail');
    expect(action.recoverable).toBe(false);
  });

  test('指数退避算法计算延迟', () => {
    const handler = new ErrorHandler({
      ...defaultConfig,
      baseDelay: 100,
      useExponentialBackoff: true,
    });

    // @ts-expect-error 访问私有方法进行测试
    const delay1 = handler['calculateRetryDelay'](0);
    // @ts-expect-error 访问私有方法进行测试
    const delay2 = handler['calculateRetryDelay'](1);
    // @ts-expect-error 访问私有方法进行测试
    const delay3 = handler['calculateRetryDelay'](2);

    // 基础延迟应该是指数增长 (baseDelay * 2^retryCount)
    // 但每次也有随机抖动，所以我们检查大致范围
    expect(delay1).toBeGreaterThanOrEqual(100); // 100 * 2^0
    expect(delay1).toBeLessThan(1100); // 100 + 1000（最大抖动）

    expect(delay2).toBeGreaterThanOrEqual(200); // 100 * 2^1
    expect(delay2).toBeLessThan(1200); // 200 + 1000（最大抖动）

    expect(delay3).toBeGreaterThanOrEqual(400); // 100 * 2^2
    expect(delay3).toBeLessThan(1400); // 400 + 1000（最大抖动）
  });

  test('线性增长算法计算延迟', () => {
    const handler = new ErrorHandler({
      ...defaultConfig,
      baseDelay: 100,
      useExponentialBackoff: false,
    });

    // @ts-expect-error 访问私有方法进行测试
    const delay1 = handler['calculateRetryDelay'](0);
    // @ts-expect-error 访问私有方法进行测试
    const delay2 = handler['calculateRetryDelay'](1);
    // @ts-expect-error 访问私有方法进行测试
    const delay3 = handler['calculateRetryDelay'](2);

    // 线性增长: baseDelay * (retryCount + 1)
    expect(delay1).toBe(100); // 100 * (0+1)
    expect(delay2).toBe(200); // 100 * (1+1)
    expect(delay3).toBe(300); // 100 * (2+1)
  });

  test('根据错误类型获取最大重试次数', () => {
    const handler = new ErrorHandler({
      ...defaultConfig,
      errorTypeRetries: {
        network: 5,
        server: 4,
        timeout: 3,
        unknown: 2,
      },
    });

    const networkError = new UploadError('网络错误', ErrorCode.NETWORK_ERROR);
    const serverError = new UploadError('服务器错误', ErrorCode.SERVER_ERROR);
    const timeoutError = new UploadError('超时错误', ErrorCode.TIMEOUT);
    const unknownError = new UploadError('未知错误', 'unknown_error');

    // @ts-expect-error 访问私有方法进行测试
    expect(handler['getMaxRetriesForError'](networkError)).toBe(5);
    // @ts-expect-error 访问私有方法进行测试
    expect(handler['getMaxRetriesForError'](serverError)).toBe(4);
    // @ts-expect-error 访问私有方法进行测试
    expect(handler['getMaxRetriesForError'](timeoutError)).toBe(3);
    // @ts-expect-error 访问私有方法进行测试
    expect(handler['getMaxRetriesForError'](unknownError)).toBe(2);
  });

  test('默认值替换', () => {
    const handler = new ErrorHandler({
      maxRetries: 5, // 覆盖默认值
    });

    // @ts-expect-error 访问私有属性进行测试
    expect(handler['config'].maxRetries).toBe(5);
    // @ts-expect-error 访问私有属性进行测试
    expect(handler['config'].baseDelay).toBe(1000); // 使用默认值
  });

  test('错误统计功能', () => {
    const handler = new ErrorHandler(defaultConfig);

    const error1 = new UploadError('网络错误', ErrorCode.NETWORK_ERROR);
    const error2 = new UploadError('服务器错误', ErrorCode.SERVER_ERROR);
    const error3 = new UploadError('网络错误', ErrorCode.NETWORK_ERROR);

    // 模拟三个错误
    handler.handle(error1, { fileId: 'file1', retryCount: 0, timestamp: Date.now() });
    handler.handle(error2, { fileId: 'file2', retryCount: 0, timestamp: Date.now() });
    handler.handle(error3, { fileId: 'file3', retryCount: 0, timestamp: Date.now() });

    // 获取统计信息
    const stats = handler.aggregateErrors();

    expect(stats.count).toBe(3);
    expect(stats.types[ErrorCode.NETWORK_ERROR]).toBe(2);
    expect(stats.types[ErrorCode.SERVER_ERROR]).toBe(1);
  });

  test('清除错误记录', () => {
    const handler = new ErrorHandler(defaultConfig);

    const error = new UploadError('网络错误', ErrorCode.NETWORK_ERROR);
    handler.handle(error, { fileId: 'file1', retryCount: 0, timestamp: Date.now() });

    expect(handler.getErrorRecords().length).toBe(1);

    handler.clearErrorRecords();

    expect(handler.getErrorRecords().length).toBe(0);
  });
});
