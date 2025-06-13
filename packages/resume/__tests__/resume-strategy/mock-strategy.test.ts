/**
 * 使用模拟类的测试文件，验证断点续传策略功能
 */
import { MockResumeUploadStrategy, TestResumeUploadStrategyOptions } from '../mocks/type-overrides';

describe('ResumeUploadStrategy 模拟测试', () => {
  let resumeStrategy: MockResumeUploadStrategy;
  let mockFile: File;

  const mockEventEmitter = {
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
  };

  beforeEach(() => {
    mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' });

    const options: TestResumeUploadStrategyOptions = {
      storage: {
        dbName: 'test-db',
        storeName: 'test-store',
      },
      chunkSize: 512,
      maxConcurrentUploads: 3,
      eventEmitter: mockEventEmitter as any,
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      } as any,
    };

    resumeStrategy = new MockResumeUploadStrategy(options);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('文件处理', () => {
    it('应该为文件生成唯一ID', () => {
      const fileId = resumeStrategy.generateFileId(mockFile);
      expect(fileId).toBeTruthy();
      expect(typeof fileId).toBe('string');
      expect(fileId).toContain('mock-file-id');
      expect(fileId).toContain(mockFile.name);
    });

    it('应该处理文件分片', async () => {
      const result = await resumeStrategy.processFile(mockFile);
      expect(result).toEqual({
        fileId: expect.any(String),
        fileName: 'test.txt',
        fileSize: mockFile.size,
        chunkSize: 512,
        totalChunks: expect.any(Number),
        chunks: expect.any(Array),
      });
    });
  });

  describe('续传功能', () => {
    it('应该检查文件是否有续传状态', async () => {
      const fileId = resumeStrategy.generateFileId(mockFile);
      const hasState = await resumeStrategy.hasUploadState(fileId);
      expect(hasState).toBe(true);
    });

    it('应该恢复上传状态', async () => {
      const fileId = resumeStrategy.generateFileId(mockFile);
      const uploadState = await resumeStrategy.resumeUpload(fileId);

      expect(uploadState).toEqual({
        fileId: fileId,
        fileName: 'mock-file.txt',
        fileSize: 1024,
        chunkSize: 512,
        totalChunks: 2,
        uploadedChunks: [0],
        lastUpdated: expect.any(Number),
      });
    });
  });
});
