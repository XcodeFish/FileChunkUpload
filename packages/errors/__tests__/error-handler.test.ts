/**
 * 错误处理器单元测试
 */
import { ErrorCode } from '@file-chunk-uploader/types';

import { createErrorHandler, ErrorHandler } from '../src/error-handler';
import { UploadError } from '../src/error-types';

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    errorHandler = createErrorHandler() as ErrorHandler;
  });

  describe('handle', () => {
    it('应该处理可重试的错误并返回重试动作', () => {
      const error = new UploadError('网络错误', ErrorCode.NETWORK_ERROR, {
        retryable: true,
      });
      const context = { retryCount: 0, timestamp: Date.now() };

      const action = errorHandler.handle(error, context);

      expect(action.type).toBe('retry');
      expect(action.delay).toBeGreaterThan(0);
      expect(action.message).toContain('重试');
    });

    it('应该处理网络断开错误并返回等待连接动作', () => {
      const error = new UploadError('网络连接断开', ErrorCode.NETWORK_DISCONNECT, {
        retryable: true,
      });
      const context = { retryCount: 0, timestamp: Date.now() };

      const action = errorHandler.handle(error, context);

      expect(action.type).toBe('wait_for_connection');
      expect(action.message).toContain('网络连接');
    });

    it('应该处理服务器过载错误并返回特殊延迟重试', () => {
      const error = new UploadError('服务器过载', ErrorCode.SERVER_OVERLOAD, {
        retryable: true,
      });
      const context = { retryCount: 3, timestamp: Date.now() };

      const action = errorHandler.handle(error, context);

      expect(action.type).toBe('retry');
      expect(action.delay).toBe(30000); // 特殊延迟30秒
      expect(action.message).toContain('服务器繁忙');
    });

    it('应该处理配额超出错误并返回不可恢复的失败', () => {
      const error = new UploadError('存储配额已满', ErrorCode.QUOTA_EXCEEDED, {
        retryable: false,
      });
      const context = { retryCount: 0, timestamp: Date.now() };

      const action = errorHandler.handle(error, context);

      expect(action.type).toBe('fail');
      expect(action.recoverable).toBe(false);
      expect(action.message).toContain('存储配额已满');
    });

    it('应该处理分片大小无效错误并返回调整分片大小动作', () => {
      const error = new UploadError('分片大小无效', ErrorCode.CHUNK_SIZE_INVALID, {
        retryable: true,
      });
      const context = { retryCount: 0, timestamp: Date.now(), chunkSize: 1024 * 1024 };

      const action = errorHandler.handle(error, context);

      expect(action.type).toBe('adjust_and_retry');
      expect(action.newChunkSize).toBe(512 * 1024);
      expect(action.message).toContain('分片大小调整');
    });

    it('应该在超过最大重试次数时返回失败动作', () => {
      const error = new UploadError('网络错误', ErrorCode.NETWORK_ERROR, {
        retryable: true,
      });
      const context = { retryCount: 5, timestamp: Date.now() };

      const action = errorHandler.handle(error, context);

      expect(action.type).toBe('fail');
      expect(action.recoverable).toBe(true);
      expect(action.message).toBe('网络错误');
    });
  });

  describe('aggregateErrors', () => {
    it('应该正确聚合错误统计', () => {
      const error1 = new UploadError('网络错误', ErrorCode.NETWORK_ERROR, {
        retryable: true,
        fileId: 'file1',
      });
      const error2 = new UploadError('服务器错误', ErrorCode.SERVER_ERROR, {
        retryable: true,
        fileId: 'file1',
      });
      const error3 = new UploadError('网络错误', ErrorCode.NETWORK_ERROR, {
        retryable: true,
        fileId: 'file2',
      });

      const context = { retryCount: 0, timestamp: Date.now() };

      // 记录错误
      errorHandler.handle(error1, context);
      errorHandler.handle(error2, context);
      errorHandler.handle(error3, context);

      // 获取统计
      const report = errorHandler.aggregateErrors();

      expect(report.count).toBe(3);
      expect(report.types[ErrorCode.NETWORK_ERROR]).toBe(2);
      expect(report.types[ErrorCode.SERVER_ERROR]).toBe(1);
      expect(report.details?.length).toBe(3);
    });

    it('应该根据时间窗口过滤错误', () => {
      const now = Date.now();

      // 创建一个模拟错误生成函数，使用指定的时间戳
      const createErrorWithTimestamp = (
        message: string,
        code: ErrorCode,
        timestamp: number,
        options = {},
      ) => {
        // 创建错误对象
        const error = new UploadError(message, code, options);
        // 使用Object.defineProperty修改只读属性
        Object.defineProperty(error, 'timestamp', {
          value: timestamp,
          writable: false,
          configurable: true,
        });
        return error;
      };

      // 模拟一小时前的错误
      const oldError = createErrorWithTimestamp(
        '网络错误',
        ErrorCode.NETWORK_ERROR,
        now - 3600001, // 1小时1毫秒前
        {
          retryable: true,
          fileId: 'file1',
        },
      );

      // 模拟最近的错误
      const recentError = createErrorWithTimestamp(
        '服务器错误',
        ErrorCode.SERVER_ERROR,
        now - 1000, // 1秒前
        {
          retryable: true,
          fileId: 'file1',
        },
      );

      const context = { retryCount: 0, timestamp: now };

      // 记录错误
      errorHandler.handle(oldError, context);
      errorHandler.handle(recentError, context);

      // 获取过去30分钟的统计
      const report = errorHandler.aggregateErrors(1800000); // 30分钟

      expect(report.count).toBe(1);
      expect(report.types[ErrorCode.SERVER_ERROR]).toBe(1);
      expect(report.types[ErrorCode.NETWORK_ERROR]).toBeUndefined();
    });
  });

  describe('clearErrorRecords', () => {
    it('应该清除所有错误记录', () => {
      const error = new UploadError('网络错误', ErrorCode.NETWORK_ERROR, {
        retryable: true,
      });
      const context = { retryCount: 0, timestamp: Date.now() };

      // 记录错误
      errorHandler.handle(error, context);

      // 验证错误已记录
      expect(errorHandler.getErrorRecords().length).toBe(1);

      // 清除错误
      errorHandler.clearErrorRecords();

      // 验证错误已清除
      expect(errorHandler.getErrorRecords().length).toBe(0);
    });
  });
});
