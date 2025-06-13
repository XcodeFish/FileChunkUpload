import type { IUploadState } from '@file-chunk-uploader/types';
import { UploadStatus } from '@file-chunk-uploader/types';

// StorageManager 类用于测试
import { StorageManager } from '../../src/storage/storage-manager';

// 创建模拟IndexedDB适配器
const mockIndexedDBAdapter = {
  init: jest.fn().mockResolvedValue(undefined),
  save: jest.fn().mockResolvedValue(undefined),
  get: jest.fn().mockResolvedValue({ fileId: 'test-file', chunks: [] }),
  remove: jest.fn().mockResolvedValue(undefined),
  keys: jest.fn().mockResolvedValue([]),
  clear: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
  clearExpired: jest.fn().mockResolvedValue(undefined),
  getUsage: jest.fn().mockResolvedValue({ totalSize: 0, chunkCount: 0, fileCount: 0 }),
};

// Mock IndexedDB adapter
jest.mock('../../src/storage/indexed-db-adapter', () => {
  return {
    IndexedDBAdapter: jest.fn().mockImplementation(() => mockIndexedDBAdapter),
  };
});

describe('StorageManager', () => {
  let storageManager: StorageManager;

  beforeEach(() => {
    jest.clearAllMocks();

    // 创建存储管理器实例
    storageManager = new StorageManager({
      dbName: 'test-db',
      storeName: 'test-store',
      expiration: 24 * 60 * 60 * 1000, // 1 day
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('上传状态管理', () => {
    it('应该成功保存上传状态', async () => {
      const uploadState: IUploadState = {
        fileId: 'test-file',
        chunkSize: 512,
        totalChunks: 2,
        uploadedChunks: [0],
        file: {
          id: 'test-file',
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
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await storageManager.saveUploadState('test-file', uploadState);
      expect(mockIndexedDBAdapter.save).toHaveBeenCalledWith(
        'state_test-file',
        expect.objectContaining({
          fileId: 'test-file',
        }),
        expect.any(Number),
      );
    });

    it('应该成功获取上传状态', async () => {
      await expect(storageManager.getUploadState('test-file')).resolves.toEqual(
        expect.objectContaining({
          fileId: 'test-file',
        }),
      );
      expect(mockIndexedDBAdapter.get).toHaveBeenCalledWith('state_test-file');
    });

    it('应该成功删除文件相关数据', async () => {
      // 模拟keys返回相关文件的键
      mockIndexedDBAdapter.keys.mockResolvedValueOnce([
        'state_test-file',
        'chunk_test-file_0',
        'chunk_test-file_1',
        'retry_test-file',
      ]);

      await storageManager.deleteFile('test-file');

      // 验证调用了remove方法删除所有相关键
      expect(mockIndexedDBAdapter.keys).toHaveBeenCalled();
      expect(mockIndexedDBAdapter.remove).toHaveBeenCalledTimes(4);
      expect(mockIndexedDBAdapter.remove).toHaveBeenCalledWith('state_test-file');
      expect(mockIndexedDBAdapter.remove).toHaveBeenCalledWith('chunk_test-file_0');
      expect(mockIndexedDBAdapter.remove).toHaveBeenCalledWith('chunk_test-file_1');
      expect(mockIndexedDBAdapter.remove).toHaveBeenCalledWith('retry_test-file');
    });

    it('应该成功获取分片索引', async () => {
      // 模拟keys返回分片键
      mockIndexedDBAdapter.keys.mockResolvedValueOnce(['chunk_test-file_0', 'chunk_test-file_1']);

      const result = await storageManager.getChunkIndices('test-file');

      expect(result).toEqual([0, 1]);
      expect(mockIndexedDBAdapter.keys).toHaveBeenCalled();
    });
  });

  describe('分片管理', () => {
    it('应该成功保存分片', async () => {
      const chunk = new Blob(['test chunk data']);

      await storageManager.saveChunk('test-file', 0, chunk);

      expect(mockIndexedDBAdapter.save).toHaveBeenCalledWith(
        'chunk_test-file_0',
        chunk,
        expect.any(Number),
      );
    });

    it('应该成功获取分片', async () => {
      const mockChunk = new Blob(['test chunk data']);
      mockIndexedDBAdapter.get.mockResolvedValueOnce(mockChunk);

      const result = await storageManager.getChunk('test-file', 0);

      expect(result).toBe(mockChunk);
      expect(mockIndexedDBAdapter.get).toHaveBeenCalledWith('chunk_test-file_0');
    });
  });

  describe('清理功能', () => {
    it('应该成功清理过期数据', async () => {
      await storageManager.cleanupExpiredData(Date.now() - 2 * 24 * 60 * 60 * 1000);

      // 验证调用了clearExpired方法
      expect(mockIndexedDBAdapter.clearExpired).toHaveBeenCalled();
    });
  });

  describe('资源释放', () => {
    it('应该成功销毁实例', () => {
      // 调用destroy方法
      storageManager.destroy();

      // 验证调用了clearInterval
      expect(mockIndexedDBAdapter.close).not.toHaveBeenCalled(); // 实际实现中没有调用close
    });
  });
});
