/**
 * 基础模拟测试
 * 用于验证测试环境设置是否正确
 */

import { UploadError } from '../src/error-types/upload-error';

describe('基础环境测试', () => {
  // 测试模拟的localStorage是否正常工作
  test('localStorage应该正常工作', () => {
    localStorage.setItem('test', 'value');
    expect(localStorage.getItem('test')).toBe('value');
  });

  // 测试window对象是否存在
  test('window对象应该存在', () => {
    expect(window).toBeDefined();
    expect(typeof window.setTimeout).toBe('function');
  });

  // 测试基本错误类
  test('UploadError应该能够创建', () => {
    const error = new UploadError('测试错误', 'TEST_ERROR');
    expect(error.message).toBe('测试错误');
    expect(error.code).toBe('TEST_ERROR');
  });
});
