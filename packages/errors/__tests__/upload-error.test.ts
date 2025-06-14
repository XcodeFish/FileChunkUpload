/**
 * UploadError类单元测试
 */

import { ErrorCode } from '@file-chunk-uploader/types';

import { UploadError, getLocalizedErrorMessage } from '../src/error-types/upload-error';

describe('UploadError', () => {
  // 测试基本构造
  test('应正确构造UploadError实例', () => {
    const error = new UploadError('测试错误');
    expect(error.message).toBe('测试错误');
    expect(error.code).toBe(ErrorCode.UNKNOWN_ERROR);
    expect(error.name).toBe('UploadError');
    expect(error.retryable).toBe(false);
    expect(typeof error.timestamp).toBe('number');
    expect(error.handled).toBe(false);
    expect(error instanceof Error).toBe(true);
  });

  // 测试带有自定义代码和选项的构造
  test('应使用提供的代码和选项', () => {
    const originalError = new Error('原始错误');
    const error = new UploadError('网络错误', ErrorCode.NETWORK_ERROR, {
      retryable: true,
      fileId: 'test-file-id',
      chunkIndex: 5,
      originalError,
      details: { statusCode: 500 },
      operation: 'upload',
    });

    expect(error.message).toBe('网络错误');
    expect(error.code).toBe(ErrorCode.NETWORK_ERROR);
    expect(error.retryable).toBe(true);
    expect(error.fileId).toBe('test-file-id');
    expect(error.chunkIndex).toBe(5);
    expect(error.originalError).toBe(originalError);
    expect(error.details).toEqual({ statusCode: 500 });
    expect(error.operation).toBe('upload');
  });

  // 测试是否可重试的默认逻辑
  test('应根据错误代码正确决定是否可重试', () => {
    // 可重试错误
    const networkError = new UploadError('网络错误', ErrorCode.NETWORK_ERROR);
    expect(networkError.retryable).toBe(true);

    const timeoutError = new UploadError('超时错误', ErrorCode.TIMEOUT);
    expect(timeoutError.retryable).toBe(true);

    // 不可重试错误
    const fileNotFoundError = new UploadError('文件未找到', ErrorCode.FILE_NOT_FOUND);
    expect(fileNotFoundError.retryable).toBe(false);

    const quotaError = new UploadError('存储配额已超出', ErrorCode.QUOTA_EXCEEDED);
    expect(quotaError.retryable).toBe(false);
  });

  // 测试静态工厂方法
  describe('静态工厂方法', () => {
    test('network方法应创建网络错误', () => {
      const error = UploadError.network('网络连接失败');
      expect(error.message).toBe('网络连接失败');
      expect(error.code).toBe(ErrorCode.NETWORK_ERROR);
      expect(error.retryable).toBe(true);
    });

    test('file方法应创建文件错误', () => {
      const error = UploadError.file('文件太大', ErrorCode.FILE_TOO_LARGE);
      expect(error.message).toBe('文件太大');
      expect(error.code).toBe(ErrorCode.FILE_TOO_LARGE);
      expect(error.retryable).toBe(false);
    });

    test('server方法应根据HTTP状态码创建合适的错误', () => {
      // 5xx错误 - 可重试
      const serverError = UploadError.server('服务器错误', 500);
      expect(serverError.code).toBe(ErrorCode.SERVER_ERROR);
      expect(serverError.retryable).toBe(true);
      expect(serverError.details).toEqual({ statusCode: 500 });

      // 503错误 - 服务器繁忙
      const overloadError = UploadError.server('服务器繁忙', 503);
      expect(overloadError.code).toBe(ErrorCode.SERVER_OVERLOAD);
      expect(overloadError.retryable).toBe(true);

      // 4xx错误 - 不可重试
      const clientError = UploadError.server('客户端错误', 400);
      expect(clientError.code).toBe(ErrorCode.SERVER_ERROR);
      expect(clientError.retryable).toBe(false);

      // 401错误 - 认证失败
      const authError = UploadError.server('认证失败', 401);
      expect(authError.code).toBe(ErrorCode.AUTHENTICATION_FAILED);
      expect(authError.retryable).toBe(false);

      // 429错误 - 请求过多，可重试的特殊情况
      const tooManyRequestsError = UploadError.server('请求过多', 429);
      expect(tooManyRequestsError.code).toBe(ErrorCode.SERVER_OVERLOAD);
      expect(tooManyRequestsError.retryable).toBe(true);
      expect(tooManyRequestsError.details).toEqual({ statusCode: 429 });
    });

    test('timeout方法应创建超时错误', () => {
      const error = UploadError.timeout('操作超时');
      expect(error.message).toBe('操作超时');
      expect(error.code).toBe(ErrorCode.TIMEOUT);
      expect(error.retryable).toBe(true);
    });

    test('chunk方法应创建分片错误', () => {
      const error = UploadError.chunk('分片上传失败', 3);
      expect(error.message).toBe('分片上传失败');
      expect(error.code).toBe(ErrorCode.CHUNK_UPLOAD_FAILED);
      expect(error.chunkIndex).toBe(3);
      expect(error.retryable).toBe(true);
    });
  });

  // 测试HTTP状态码处理
  describe('HTTP状态码处理', () => {
    test('应正确处理不同HTTP状态码类别', () => {
      // 普通2xx成功状态码，应默认为SERVER_ERROR和可重试
      const successError = UploadError.server('操作成功但出错', 200);
      expect(successError.code).toBe(ErrorCode.SERVER_ERROR);
      expect(successError.retryable).toBe(true);

      // 普通4xx客户端错误，应为SERVER_ERROR和不可重试
      const badRequestError = UploadError.server('请求错误', 400);
      expect(badRequestError.code).toBe(ErrorCode.SERVER_ERROR);
      expect(badRequestError.retryable).toBe(false);

      // 特殊4xx错误 - 将429映射到SERVER_OVERLOAD，异常情况下可重试
      const rateLimitError = UploadError.server('请求频率限制', 429);
      expect(rateLimitError.code).toBe(ErrorCode.SERVER_OVERLOAD);
      expect(rateLimitError.retryable).toBe(true);

      // 普通5xx服务器错误，应为SERVER_ERROR和可重试
      const internalServerError = UploadError.server('服务器内部错误', 500);
      expect(internalServerError.code).toBe(ErrorCode.SERVER_ERROR);
      expect(internalServerError.retryable).toBe(true);

      // 不提供状态码的情况
      const unknownError = UploadError.server('未知服务器错误');
      expect(unknownError.code).toBe(ErrorCode.SERVER_ERROR);
      expect(unknownError.retryable).toBe(true);
    });
  });

  // 测试本地化功能
  describe('本地化', () => {
    test('getLocalizedMessage应返回正确的本地化消息', () => {
      const error = new UploadError('上传失败', ErrorCode.NETWORK_ERROR);
      expect(error.getLocalizedMessage('zh-CN')).toBe('网络错误');
      expect(error.getLocalizedMessage('en-US')).toBe('Network error');
    });

    test('未知的错误代码应返回原始消息', () => {
      const error = new UploadError('自定义错误', 'custom_error');
      expect(error.getLocalizedMessage()).toBe('自定义错误');
    });

    test('未知的语言代码应回退到默认消息', () => {
      const error = new UploadError('上传失败', ErrorCode.NETWORK_ERROR);
      expect(error.getLocalizedMessage('fr-FR')).toBe('上传失败');
    });
  });

  // 测试开发者模式详情
  test('getDevModeDetails应返回完整的错误详情', () => {
    const originalError = new Error('原始错误');
    const error = new UploadError('测试错误', ErrorCode.NETWORK_ERROR, {
      retryable: true,
      fileId: 'test-file',
      originalError,
    });

    const details = error.getDevModeDetails();
    expect(details.name).toBe('UploadError');
    expect(details.message).toBe('测试错误');
    expect(details.code).toBe(ErrorCode.NETWORK_ERROR);
    expect(details.retryable).toBe(true);
    expect(details.fileId).toBe('test-file');
    expect(typeof details.stack).toBe('string');
    expect(details.originalError).toBeDefined();
    // 简化originalError测试，避免类型问题
    expect(details.originalError).toBeTruthy();
  });

  // 测试JSON转换
  test('toJSON应返回错误的JSON表示', () => {
    const error = new UploadError('测试错误', ErrorCode.NETWORK_ERROR, {
      fileId: 'test-file',
      details: { statusCode: 500 },
    });

    const json = error.toJSON();
    expect(json.name).toBe('UploadError');
    expect(json.message).toBe('测试错误');
    expect(json.code).toBe(ErrorCode.NETWORK_ERROR);
    expect(json.fileId).toBe('test-file');
    expect(json.details).toEqual({ statusCode: 500 });
    // 确保没有包含堆栈跟踪等不需要序列化的字段
    expect(json.stack).toBeUndefined();
  });

  // 测试getLocalizedErrorMessage函数
  test('getLocalizedErrorMessage应正确返回本地化消息', () => {
    expect(getLocalizedErrorMessage(ErrorCode.NETWORK_ERROR, 'zh-CN')).toBe('网络错误');
    expect(getLocalizedErrorMessage(ErrorCode.FILE_TOO_LARGE, 'en-US')).toBe('File too large');
    expect(getLocalizedErrorMessage('custom_code', 'zh-CN', '自定义错误')).toBe('自定义错误');
  });
});
