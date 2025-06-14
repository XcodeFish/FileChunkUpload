/**
 * Jest 模拟设置文件
 *
 * 此文件用于设置 Jest 的模拟实现
 */

/* global jest */

// 模拟 @file-chunk-uploader/types 包中的类型
jest.mock(
  '@file-chunk-uploader/types',
  () => {
    return {
      // 模拟接口
      IUploadError: {},
      IErrorContext: {},
      IRetryConfig: {},
      IPlugin: {},
    };
  },
  { virtual: true },
);

// 模拟错误类型
jest.mock('./src/error-types/upload-error', () => {
  return require('./__mocks__/error-types');
});

// 模拟事件发射器
jest.mock('./src/utils/event-emitter', () => {
  return require('./__mocks__/event-emitter');
});
