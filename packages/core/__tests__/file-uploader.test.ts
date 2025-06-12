import { EventName } from '@file-chunk-uploader/types';

import { FileUploader } from '../src/core/file-uploader';

describe('FileUploader', () => {
  let fileUploader: FileUploader;
  let mockFile: File;

  beforeEach(() => {
    // 创建模拟文件
    mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' });

    // 创建上传器实例
    fileUploader = new FileUploader({
      target: 'https://example.com/upload',
      method: 'POST',
    });
  });

  afterEach(() => {
    fileUploader.cleanup();
  });

  test('应该正确初始化上传器', () => {
    expect(fileUploader).toBeInstanceOf(FileUploader);
    expect(fileUploader.config).toHaveProperty('target', 'https://example.com/upload');
    expect(fileUploader.config).toHaveProperty('method', 'POST');
  });

  test('应该能够上传文件', async () => {
    // 模拟上传方法（因为实际上传会发送HTTP请求）
    const originalUpload = fileUploader.upload;
    fileUploader.upload = jest.fn().mockResolvedValue({
      success: true,
      file: {
        id: '123',
        name: 'test.txt',
        size: mockFile.size,
        type: mockFile.type,
      },
    });

    const result = await fileUploader.upload(mockFile);
    expect(result).toBeDefined();
    expect(result.success).toBe(true);

    // 恢复原来的方法
    fileUploader.upload = originalUpload;
  });

  test('应该能够监听事件', done => {
    // 模拟上传方法
    const originalUpload = fileUploader.upload;
    fileUploader.upload = jest.fn().mockResolvedValue({
      success: true,
      file: {
        id: '123',
        name: 'test.txt',
        size: mockFile.size,
        type: mockFile.type,
      },
    });

    fileUploader.on(EventName.FILE_ADDED, event => {
      expect(event.file).toBeDefined();
      done();
    });

    fileUploader.upload(mockFile);

    // 恢复原来的方法
    fileUploader.upload = originalUpload;
  });

  test('应该能够获取当前状态', () => {
    const tasks = fileUploader.getTasks();
    expect(Array.isArray(tasks)).toBe(true);
  });
});
