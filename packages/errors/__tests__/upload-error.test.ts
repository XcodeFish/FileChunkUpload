/**
 * 上传错误类单元测试
 */
import { ErrorCode } from '@file-chunk-uploader/types';

import { UploadError } from '../src/error-types/upload-error';

describe('UploadError', () => {
  test('创建一个基本的上传错误', () => {
    const error = new UploadError('测试错误消息', ErrorCode.UNKNOWN_ERROR);

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(UploadError);
    expect(error.message).toBe('测试错误消息');
    expect(error.code).toBe(ErrorCode.UNKNOWN_ERROR);
    expect(error.retryable).toBe(true); // 默认可重试
  });

  test('创建一个带有不可重试选项的错误', () => {
    const error = new UploadError('配额已满', ErrorCode.QUOTA_EXCEEDED, {
      retryable: false,
    });

    expect(error.message).toBe('配额已满');
    expect(error.code).toBe(ErrorCode.QUOTA_EXCEEDED);
    expect(error.retryable).toBe(false);
  });

  test('创建一个带有详细信息的错误', () => {
    const details = {
      fileSize: 1024 * 1024,
      fileMime: 'image/jpeg',
    };

    const error = new UploadError('文件类型不允许', ErrorCode.FILE_TYPE_NOT_ALLOWED, {
      details,
      retryable: false,
    });

    expect(error.message).toBe('文件类型不允许');
    expect(error.code).toBe(ErrorCode.FILE_TYPE_NOT_ALLOWED);
    expect(error.details).toEqual(details);
  });

  test('创建一个带有文件ID的错误', () => {
    const error = new UploadError('上传失败', ErrorCode.UPLOAD_FAILED, {
      fileId: 'test-file-123',
    });

    expect(error.message).toBe('上传失败');
    expect(error.code).toBe(ErrorCode.UPLOAD_FAILED);
    expect(error.fileId).toBe('test-file-123');
  });

  test('创建一个带有分片索引的错误', () => {
    const error = new UploadError('分片上传失败', ErrorCode.CHUNK_UPLOAD_FAILED, {
      fileId: 'test-file-123',
      chunkIndex: 5,
    });

    expect(error.message).toBe('分片上传失败');
    expect(error.code).toBe(ErrorCode.CHUNK_UPLOAD_FAILED);
    expect(error.fileId).toBe('test-file-123');
    expect(error.chunkIndex).toBe(5);
  });

  test('创建一个带有原始错误的错误', () => {
    const originalError = new Error('网络请求失败');
    const error = new UploadError('网络错误', ErrorCode.NETWORK_ERROR, {
      originalError,
    });

    expect(error.message).toBe('网络错误');
    expect(error.code).toBe(ErrorCode.NETWORK_ERROR);
    expect(error.originalError).toBe(originalError);
  });

  test('创建一个带有操作名称的错误', () => {
    const error = new UploadError('操作失败', ErrorCode.OPERATION_FAILED, {
      operation: 'createUpload',
    });

    expect(error.message).toBe('操作失败');
    expect(error.code).toBe(ErrorCode.OPERATION_FAILED);
    expect(error.operation).toBe('createUpload');
  });

  test('创建一个自定义拓展错误代码的错误', () => {
    // 使用非枚举中的字符串作为错误代码
    const error = new UploadError('资源不存在', 'resource_not_found');

    expect(error.message).toBe('资源不存在');
    expect(error.code).toBe('resource_not_found');
  });

  test('从HTTP状态码创建错误', () => {
    // 404错误
    const error404 = UploadError.fromHttpStatus(404, 'Not Found');
    expect(error404.code).toBe('resource_not_found');
    expect(error404.retryable).toBe(false);

    // 409错误
    const error409 = UploadError.fromHttpStatus(409, 'Conflict');
    expect(error409.code).toBe('resource_conflict');
    expect(error409.retryable).toBe(false);

    // 413错误
    const error413 = UploadError.fromHttpStatus(413, 'Payload Too Large');
    expect(error413.code).toBe(ErrorCode.FILE_TOO_LARGE);
    expect(error413.retryable).toBe(false);

    // 415错误
    const error415 = UploadError.fromHttpStatus(415, 'Unsupported Media Type');
    expect(error415.code).toBe('unsupported_media_type');
    expect(error415.retryable).toBe(false);

    // 500错误
    const error500 = UploadError.fromHttpStatus(500, 'Internal Server Error');
    expect(error500.code).toBe(ErrorCode.SERVER_ERROR);
    expect(error500.retryable).toBe(true);

    // 503错误
    const error503 = UploadError.fromHttpStatus(503, 'Service Unavailable');
    expect(error503.code).toBe(ErrorCode.SERVER_OVERLOAD);
    expect(error503.retryable).toBe(true);

    // 未知错误
    const errorUnknown = UploadError.fromHttpStatus(499, 'Unknown Error');
    expect(errorUnknown.code).toBe(ErrorCode.UNKNOWN_ERROR);
    expect(errorUnknown.retryable).toBe(true);
  });

  test('错误本地化', () => {
    const error = new UploadError('网络错误', ErrorCode.NETWORK_ERROR);

    // 默认使用消息本身
    expect(error.getLocalizedMessage()).toBe('网络错误');

    // 使用自定义本地化提供程序
    const localizer = (code: string) => {
      const messages: Record<string, string> = {
        [ErrorCode.NETWORK_ERROR]: '网络连接失败，请检查您的网络设置',
      };
      return messages[code] || '未知错误';
    };

    expect(error.getLocalizedMessage(localizer)).toBe('网络连接失败，请检查您的网络设置');
  });

  test('开发者错误详情', () => {
    const originalError = new Error('ECONNREFUSED');
    const error = new UploadError('网络错误', ErrorCode.NETWORK_ERROR, {
      originalError,
      details: { url: 'https://api.example.com/upload', method: 'POST' },
    });

    // 不启用开发者模式
    expect(error.getDeveloperMessage()).toBe('网络错误 [network_error]');

    // 启用开发者模式
    expect(error.getDeveloperMessage(true)).toContain('网络错误 [network_error]');
    expect(error.getDeveloperMessage(true)).toContain('ECONNREFUSED');
    expect(error.getDeveloperMessage(true)).toContain('https://api.example.com/upload');
  });
});
