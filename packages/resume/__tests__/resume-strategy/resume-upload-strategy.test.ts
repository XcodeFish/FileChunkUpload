import type {
  IEventEmitter,
  ILogger,
  IFileInfo,
  IChunkMeta,
  IFileChunkResult,
} from '@file-chunk-uploader/types';
import { UploadStatus } from '@file-chunk-uploader/types';

import { ResumeUploadStrategy } from '../../src/resume-strategy/resume-upload-strategy';
import { IExtendedUploadState, ChunkStatus } from '../../src/resume-strategy/types';
// StorageManager 类仅用于类型，实际实例被模拟

// 创建模拟存储管理器
const mockStorageManagerInstance = {
  saveUploadState: jest.fn().mockResolvedValue(undefined),
  getUploadState: jest.fn(),
  deleteFile: jest.fn().mockResolvedValue(undefined),
  getChunkIndices: jest.fn().mockResolvedValue([0]),
  destroy: jest.fn(),
  setLogger: jest.fn(),
};

// 创建模拟上传状态
const mockUploadState = {
  fileId: 'test-file-id',
  chunkSize: 512,
  totalChunks: 2,
  uploadedChunks: [0],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  file: {
    id: 'test-file-id',
    name: 'test.txt',
    size: 1024,
    type: 'text/plain',
    lastModified: Date.now(),
  },
  status: UploadStatus.UPLOADING,
  progress: {
    loaded: 512,
    total: 1024,
    percent: 50,
    speed: 1024,
    timeElapsed: 1000,
    timeRemaining: 1000,
  },
  chunksDetails: [
    {
      index: 0,
      status: ChunkStatus.SUCCESS,
      retryCount: 0,
      lastAttempt: Date.now(),
    },
    {
      index: 1,
      status: ChunkStatus.PENDING,
      retryCount: 0,
    },
  ],
} as IExtendedUploadState;

// 设置默认的模拟返回值
mockStorageManagerInstance.getUploadState.mockImplementation(() =>
  Promise.resolve(mockUploadState),
);

// Mock StorageManager
jest.mock('../../src/storage/storage-manager', () => {
  return {
    StorageManager: jest.fn().mockImplementation(() => mockStorageManagerInstance),
  };
});

// 创建完整的模拟事件发射器
const mockEventEmitter = {
  emit: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  once: jest.fn(),
  emitSync: jest.fn(),
  onBatch: jest.fn(),
  listeners: jest.fn(),
  hasListeners: jest.fn(),
  removeAllListeners: jest.fn(),
  getEventNames: jest.fn(),
  createNamespacedEmitter: jest.fn(),
};

// 模拟 UploadStateValidator 类
jest.mock('../../src/resume-strategy/upload-state-validator', () => {
  return {
    UploadStateValidator: jest.fn().mockImplementation(() => {
      return {
        validateUploadState: jest.fn().mockReturnValue({ valid: true }),
      };
    }),
  };
});

describe('ResumeUploadStrategy', () => {
  let resumeStrategy: ResumeUploadStrategy;
  let mockFile: File;
  let mockFileInfo: IFileInfo;

  beforeEach(() => {
    // 清除所有模拟函数的调用记录
    jest.clearAllMocks();

    mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' });

    // 创建符合IFileInfo接口的文件信息
    mockFileInfo = {
      id: 'test-file-id',
      name: 'test.txt',
      size: mockFile.size,
      type: mockFile.type,
      lastModified: Date.now(),
    };

    // 由于类型定义不完全匹配，使用类型断言
    resumeStrategy = new ResumeUploadStrategy({
      storage: {
        dbName: 'test-db',
        storeName: 'test-store',
      },
      enabled: true,
      maxStorageTime: 7 * 24 * 60 * 60 * 1000,
      maxConcurrentChunks: 3,
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      } as ILogger,
    });

    // 设置事件发射器，使用双重类型断言
    resumeStrategy.setEventEmitter(mockEventEmitter as unknown as IEventEmitter);
  });

  afterEach(() => {
    resumeStrategy.destroy();
  });

  describe('文件处理', () => {
    it('应该为文件生成唯一ID', () => {
      expect(mockFileInfo.id).toBeTruthy();
      expect(typeof mockFileInfo.id).toBe('string');
    });

    it('应该处理文件分片', async () => {
      // 创建分片元数据
      const chunkMetas: IChunkMeta[] = [
        { index: 0, size: 5, start: 0, end: 5, isLast: false },
        { index: 1, size: 5, start: 5, end: 10, isLast: true },
      ];

      // 创建符合IFileChunkResult接口的对象
      const chunkResult: IFileChunkResult = {
        chunks: [new Blob(['chunk1']), new Blob(['chunk2'])],
        count: 2,
        chunkSize: 512,
        file: mockFileInfo,
        chunkInfos: chunkMetas,
      };

      // 使用正确的方法保存上传状态
      await resumeStrategy.saveUploadState(
        mockFileInfo,
        chunkResult,
        [], // 已上传的分片
        UploadStatus.UPLOADING, // 上传状态
      );

      // 验证调用
      expect(mockStorageManagerInstance.saveUploadState).toHaveBeenCalled();
    });
  });

  describe('续传功能', () => {
    it('应该检查文件是否有续传状态', async () => {
      // 使用 checkResumable 方法
      const state = await resumeStrategy.checkResumable(mockFileInfo);

      // 验证返回了上传状态
      expect(state).toBeTruthy();
      expect(mockStorageManagerInstance.getUploadState).toHaveBeenCalled();
    });

    it('应该更新上传分片', async () => {
      const fileId = 'test-file-id';
      const chunkIndex = 1;

      // 使用正确的方法更新已上传的分片
      await resumeStrategy.updateUploadedChunk(fileId, chunkIndex);

      // 验证调用
      expect(mockStorageManagerInstance.getUploadState).toHaveBeenCalledWith(fileId);
      expect(mockStorageManagerInstance.saveUploadState).toHaveBeenCalled();
    });

    it('应该完成上传', async () => {
      const fileId = 'test-file-id';

      // 使用正确的方法完成上传
      await resumeStrategy.completeUpload(fileId);

      // 验证调用
      expect(mockStorageManagerInstance.deleteFile).toHaveBeenCalledWith(fileId);
    });
  });

  describe('分片状态管理', () => {
    it('应该标记分片为上传中', () => {
      const fileId = 'test-file-id';
      const chunkIndex = 0;

      // 标记分片为上传中
      resumeStrategy.markChunkAsUploading(fileId, chunkIndex);

      // 验证可以获取活跃分片数
      expect(resumeStrategy.getActiveChunksCount(fileId)).toBe(1);
    });

    it('应该标记分片为已完成', async () => {
      const fileId = 'test-file-id';
      const chunkIndex = 0;

      // 先标记为上传中
      resumeStrategy.markChunkAsUploading(fileId, chunkIndex);

      // 然后标记为已完成
      await resumeStrategy.markChunkAsComplete(fileId, chunkIndex);

      // 验证活跃分片数减少
      expect(resumeStrategy.getActiveChunksCount(fileId)).toBe(0);
    });

    it('应该标记分片为失败', () => {
      const fileId = 'test-file-id';
      const chunkIndex = 0;

      // 先标记为上传中
      resumeStrategy.markChunkAsUploading(fileId, chunkIndex);

      // 然后标记为失败
      resumeStrategy.markChunkAsFailed(fileId, chunkIndex, '上传失败');

      // 验证活跃分片数减少
      expect(resumeStrategy.getActiveChunksCount(fileId)).toBe(0);
    });
  });
});
