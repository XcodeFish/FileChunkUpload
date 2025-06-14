/**
 * 存储管理器单元测试
 */
import { StorageManager } from '../../src/recovery/retry-types';
import { createStorageManager } from '../../src/recovery/storage-manager';

// 模拟localStorage
class MockLocalStorage {
  private store: Record<string, string> = {};
  private originalLocalStorage: Storage | null = null;

  // 保存原始localStorage并替换为模拟实现
  setup() {
    this.originalLocalStorage = global.localStorage;

    const mockStorage = {
      getItem: (key: string): string | null => {
        return key in this.store ? this.store[key] : null;
      },
      setItem: (key: string, value: string): void => {
        this.store[key] = value;
      },
      removeItem: (key: string): void => {
        delete this.store[key];
      },
      clear: (): void => {
        this.store = {};
      },
      key: (index: number): string | null => {
        return Object.keys(this.store)[index] || null;
      },
      length: 0, // 会在get访问器中动态计算
    };

    // 添加length属性的getter
    Object.defineProperty(mockStorage, 'length', {
      get: function () {
        return Object.keys(this.store).length;
      },
    });

    // 替换全局localStorage
    global.localStorage = mockStorage as Storage;
  }

  // 恢复原始localStorage
  restore() {
    if (this.originalLocalStorage) {
      global.localStorage = this.originalLocalStorage;
    }
  }

  // 清空存储
  clear() {
    this.store = {};
  }

  // 获取存储内容
  getStore() {
    return { ...this.store };
  }
}

describe('StorageManager', () => {
  let storageManager: StorageManager;
  let mockStorage: MockLocalStorage;
  const testPrefix = 'test_retry_';
  // 较短的过期时间，方便测试
  const testExpirationTime = 100;

  beforeEach(() => {
    // 设置模拟localStorage
    mockStorage = new MockLocalStorage();
    mockStorage.setup();

    // 创建StorageManager实例
    storageManager = createStorageManager(testPrefix, testExpirationTime);
  });

  afterEach(() => {
    // 清理并恢复原始localStorage
    mockStorage.clear();
    mockStorage.restore();
  });

  describe('saveRetryState', () => {
    it('应该正确保存重试状态', async () => {
      // 准备测试数据
      const fileId = 'test-file-1';
      const state = {
        fileId,
        retryCount: 2,
        lastRetryTime: Date.now(),
        chunkRetries: { 0: 1, 1: 1 },
        successfulRetries: 1,
        failedRetries: 1,
      };

      // 保存状态
      await storageManager.saveRetryState(fileId, state);

      // 检查localStorage是否包含数据
      const storeContent = mockStorage.getStore();
      const key = `${testPrefix}${fileId}`;

      expect(storeContent).toHaveProperty(key);

      // 验证状态内容
      const savedState = JSON.parse(storeContent[key]);
      expect(savedState).toMatchObject({
        fileId,
        retryCount: 2,
        successfulRetries: 1,
        failedRetries: 1,
      });

      // 验证添加的元数据
      expect(savedState).toHaveProperty('timestamp');
      expect(savedState).toHaveProperty('expiration');
      expect(typeof savedState.timestamp).toBe('number');
      expect(typeof savedState.expiration).toBe('number');
    });

    it('应该更新活动上传列表', async () => {
      // 保存两个文件的状态
      const fileId1 = 'test-file-1';
      const fileId2 = 'test-file-2';

      await storageManager.saveRetryState(fileId1, {
        fileId: fileId1,
        retryCount: 1,
        lastRetryTime: Date.now(),
        chunkRetries: {},
        successfulRetries: 0,
        failedRetries: 0,
      });

      await storageManager.saveRetryState(fileId2, {
        fileId: fileId2,
        retryCount: 1,
        lastRetryTime: Date.now(),
        chunkRetries: {},
        successfulRetries: 0,
        failedRetries: 0,
      });

      // 获取活动上传列表
      const activeUploads = await storageManager.getActiveUploads();

      // 验证列表包含两个文件ID
      expect(activeUploads).toContain(fileId1);
      expect(activeUploads).toContain(fileId2);
      expect(activeUploads.length).toBe(2);
    });
  });

  describe('getRetryState', () => {
    it('应该返回保存的重试状态', async () => {
      // 保存状态
      const fileId = 'test-file-3';
      const originalState = {
        fileId,
        retryCount: 3,
        lastRetryTime: Date.now(),
        chunkRetries: { 0: 2, 1: 1 },
        successfulRetries: 2,
        failedRetries: 1,
      };

      await storageManager.saveRetryState(fileId, originalState);

      // 获取状态
      const retrievedState = await storageManager.getRetryState(fileId);

      // 验证获取的状态
      expect(retrievedState).not.toBeNull();
      expect(retrievedState).toMatchObject(originalState);
    });

    it('不存在的文件ID应该返回null', async () => {
      const state = await storageManager.getRetryState('non-existent-file');
      expect(state).toBeNull();
    });

    it('应该返回null并清理过期状态', async () => {
      // 保存状态
      const fileId = 'test-file-4';
      const state = {
        fileId,
        retryCount: 1,
        lastRetryTime: Date.now(),
        chunkRetries: {},
        successfulRetries: 0,
        failedRetries: 0,
      };

      await storageManager.saveRetryState(fileId, state);

      // 等待过期
      await new Promise(resolve => setTimeout(resolve, testExpirationTime + 10));

      // 获取状态，应该返回null
      const retrievedState = await storageManager.getRetryState(fileId);
      expect(retrievedState).toBeNull();

      // 检查文件ID是否从活动上传列表中移除
      const activeUploads = await storageManager.getActiveUploads();
      expect(activeUploads).not.toContain(fileId);
    });
  });

  describe('clearRetryState', () => {
    it('应该清除特定文件的重试状态', async () => {
      // 保存两个文件的状态
      const fileId1 = 'test-file-5';
      const fileId2 = 'test-file-6';

      await storageManager.saveRetryState(fileId1, {
        fileId: fileId1,
        retryCount: 1,
        lastRetryTime: Date.now(),
        chunkRetries: {},
        successfulRetries: 0,
        failedRetries: 0,
      });

      await storageManager.saveRetryState(fileId2, {
        fileId: fileId2,
        retryCount: 1,
        lastRetryTime: Date.now(),
        chunkRetries: {},
        successfulRetries: 0,
        failedRetries: 0,
      });

      // 清除第一个文件的状态
      await storageManager.clearRetryState(fileId1);

      // 验证只有第一个文件被清除
      expect(await storageManager.getRetryState(fileId1)).toBeNull();
      expect(await storageManager.getRetryState(fileId2)).not.toBeNull();

      // 验证活动上传列表已更新
      const activeUploads = await storageManager.getActiveUploads();
      expect(activeUploads).not.toContain(fileId1);
      expect(activeUploads).toContain(fileId2);
    });
  });

  describe('clearAllRetryStates', () => {
    it('应该清除所有重试状态', async () => {
      // 保存多个文件的状态
      const fileIds = ['test-file-7', 'test-file-8', 'test-file-9'];

      for (const fileId of fileIds) {
        await storageManager.saveRetryState(fileId, {
          fileId,
          retryCount: 1,
          lastRetryTime: Date.now(),
          chunkRetries: {},
          successfulRetries: 0,
          failedRetries: 0,
        });
      }

      // 清除所有状态
      await storageManager.clearAllRetryStates();

      // 验证所有状态已清除
      for (const fileId of fileIds) {
        expect(await storageManager.getRetryState(fileId)).toBeNull();
      }

      // 验证活动上传列表为空
      expect(await storageManager.getActiveUploads()).toEqual([]);
    });
  });

  describe('cleanupExpiredStorage', () => {
    it('应该自动清理过期的状态', async () => {
      // 保存状态
      const fileId = 'test-file-10';
      const state = {
        fileId,
        retryCount: 1,
        lastRetryTime: Date.now(),
        chunkRetries: {},
        successfulRetries: 0,
        failedRetries: 0,
      };

      await storageManager.saveRetryState(fileId, state);

      // 验证状态已保存
      expect(await storageManager.getRetryState(fileId)).not.toBeNull();

      // 等待过期
      await new Promise(resolve => setTimeout(resolve, testExpirationTime + 10));

      // 创建新的存储管理器，触发启动清理
      const newStorageManager = createStorageManager(testPrefix, testExpirationTime);

      // 给清理足够的时间执行
      await new Promise(resolve => setTimeout(resolve, 10));

      // 验证状态已被自动清理
      expect(await newStorageManager.getRetryState(fileId)).toBeNull();

      // 检查活动上传列表
      const activeUploads = await newStorageManager.getActiveUploads();
      expect(activeUploads).not.toContain(fileId);
    });
  });
});
