/**
 * 错误处理测试
 * 用于测试错误处理和重试机制
 */

import { UploadError, ErrorCode } from '../__mocks__/error-types';

describe('错误处理测试', () => {
  // 测试基本错误创建
  test('应正确创建上传错误', () => {
    const error = new UploadError('测试错误', ErrorCode.NETWORK_ERROR);
    expect(error.message).toBe('测试错误');
    expect(error.code).toBe(ErrorCode.NETWORK_ERROR);
    expect(error.retryable).toBe(true); // 网络错误默认可重试
  });

  // 测试特定错误类型的重试属性
  test('不同类型错误应具有正确的重试属性', () => {
    const networkError = new UploadError('网络错误', ErrorCode.NETWORK_ERROR);
    expect(networkError.retryable).toBe(true);

    const fileError = new UploadError('文件错误', ErrorCode.FILE_ERROR);
    expect(fileError.retryable).toBe(false);

    const authError = new UploadError('认证错误', ErrorCode.AUTH_ERROR);
    expect(authError.retryable).toBe(false);
  });

  // 测试明确设置重试属性
  test('应尊重显式设置的重试属性', () => {
    const error1 = new UploadError('测试错误', ErrorCode.NETWORK_ERROR, { retryable: false });
    expect(error1.retryable).toBe(false); // 虽然是网络错误，但显式设置为不可重试

    const error2 = new UploadError('测试错误', ErrorCode.FILE_ERROR, { retryable: true });
    expect(error2.retryable).toBe(true); // 虽然是文件错误，但显式设置为可重试
  });

  // 测试工厂方法
  test('静态工厂方法应该创建正确类型的错误', () => {
    const networkError = UploadError.network('网络连接失败');
    expect(networkError.code).toBe(ErrorCode.NETWORK_ERROR);
    expect(networkError.retryable).toBe(true);

    const serverError = UploadError.server('服务器错误', 500);
    expect(serverError.code).toBe(ErrorCode.SERVER_ERROR);
    expect(serverError.retryable).toBe(true);
    expect(serverError.details?.status).toBe(500);

    const timeoutError = UploadError.timeout('请求超时');
    expect(timeoutError.code).toBe(ErrorCode.TIMEOUT_ERROR);
    expect(timeoutError.retryable).toBe(true);

    const fileError = UploadError.file('文件无法读取');
    expect(fileError.code).toBe(ErrorCode.FILE_ERROR);
    expect(fileError.retryable).toBe(false);
  });

  // 测试服务器错误的特殊状态码处理
  test('服务器错误应根据状态码设置不同属性', () => {
    const error500 = UploadError.server('内部服务器错误', 500);
    expect(error500.code).toBe(ErrorCode.SERVER_ERROR);
    expect(error500.retryable).toBe(true);

    const error429 = UploadError.server('请求过多', 429);
    expect(error429.code).toBe(ErrorCode.SERVER_OVERLOAD);
    expect(error429.retryable).toBe(true);

    const error401 = UploadError.server('未授权', 401);
    expect(error401.code).toBe(ErrorCode.AUTH_ERROR);
    expect(error401.retryable).toBe(false);

    const error403 = UploadError.server('禁止访问', 403);
    expect(error403.code).toBe(ErrorCode.AUTH_ERROR);
    expect(error403.retryable).toBe(false);
  });
});
