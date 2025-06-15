/**
 * 存储管理器单元测试
 */
import { RetryState, StorageManager } from '../../src/recovery/retry-types';
import { createStorageManager } from '../../src/recovery/storage-manager';

// 辅助函数，用于操作localStorage
class LocalStorageHelper {
  // 清空存储
  clear() {
    localStorage.clear();
  }

  // 获取存储内容
  getStore() {
    const store: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        store[key] = localStorage.getItem(key) || '';
      }
    }
    return store;
  }
}

// 创建符合RetryState接口的测试状态
function createTestRetryState(fileId: string, options: Partial<RetryState> = {}): RetryState {
  const now = Date.now();
  return {
    fileId,
    retryCount: 0,
    lastRetryTime: now,
    chunkRetries: {},
    successfulRetries: 0,
    failedRetries: 0,
    deviceId: 'test-device',
    sessionId: 'test-session',
    createdAt: now,
    updatedAt: now,
    expiresAt: now + 3600000, // 1小时后过期
    networkHistory: [],
    retryHistory: [],
    syncStatus: {
      synced: false,
      lastSyncTime: 0,
    },
    ...options,
  };
}

describe('StorageManager', () => {
  let storageManager: StorageManager;
  let localStorageHelper: LocalStorageHelper;
  const testPrefix = 'test_retry_';
  // 较短的过期时间，方便测试
  const testExpirationTime = 100;

  beforeEach(() => {
    // 清空localStorage
    localStorage.clear();
    localStorageHelper = new LocalStorageHelper();

    // 创建StorageManager实例
    storageManager = createStorageManager({
      prefix: testPrefix,
      expirationTime: testExpirationTime,
    });
  });

  afterEach(() => {
    // 清理localStorage
    localStorage.clear();
  });

  describe('saveRetryState', () => {
    it('应该正确保存重试状态', async () => {
      // 准备测试数据
      const fileId = 'test-file-1';
      const state = createTestRetryState(fileId, {
        retryCount: 2,
        chunkRetries: { 0: 1, 1: 1 },
        successfulRetries: 1,
        failedRetries: 1,
      });

      // 保存状态
      await storageManager.saveRetryState(fileId, state);

      // 检查localStorage是否包含数据
      const storeContent = localStorageHelper.getStore();
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

      await storageManager.saveRetryState(
        fileId1,
        createTestRetryState(fileId1, {
          retryCount: 1,
        }),
      );

      await storageManager.saveRetryState(
        fileId2,
        createTestRetryState(fileId2, {
          retryCount: 1,
        }),
      );

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
      const originalState = createTestRetryState(fileId, {
        retryCount: 3,
        chunkRetries: { 0: 2, 1: 1 },
        successfulRetries: 2,
        failedRetries: 1,
      });

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
      const state = createTestRetryState(fileId, {
        retryCount: 1,
        // 设置过期时间为当前时间+5毫秒
        expiresAt: Date.now() + 5,
      });

      await storageManager.saveRetryState(fileId, state);

      // 等待过期
      await new Promise(resolve => setTimeout(resolve, testExpirationTime + 10));

      // 获取状态，应该返回null
      const retrievedState = await storageManager.getRetryState(fileId);
      expect(retrievedState).toBeNull();

      // 验证状态已从localStorage中清除
      const storeContent = localStorageHelper.getStore();
      const key = `${testPrefix}${fileId}`;
      expect(storeContent[key]).toBeUndefined();
    });
  });

  describe('clearRetryState', () => {
    it('应该清除特定文件的重试状态', async () => {
      // 保存两个文件的状态
      const fileId1 = 'test-file-5';
      const fileId2 = 'test-file-6';

      await storageManager.saveRetryState(fileId1, createTestRetryState(fileId1));
      await storageManager.saveRetryState(fileId2, createTestRetryState(fileId2));

      // 清除第一个文件的状态
      await storageManager.clearRetryState(fileId1);

      // 验证第一个文件的状态已清除
      const state1 = await storageManager.getRetryState(fileId1);
      expect(state1).toBeNull();

      // 验证第二个文件的状态仍然存在
      const state2 = await storageManager.getRetryState(fileId2);
      expect(state2).not.toBeNull();
    });
  });

  describe('clearAllRetryStates', () => {
    it('应该清除所有重试状态', async () => {
      // 保存多个文件的状态
      await storageManager.saveRetryState('test-file-7', createTestRetryState('test-file-7'));
      await storageManager.saveRetryState('test-file-8', createTestRetryState('test-file-8'));
      await storageManager.saveRetryState('test-file-9', createTestRetryState('test-file-9'));

      // 清除所有状态
      await storageManager.clearAllRetryStates();

      // 验证所有状态已清除
      const activeUploads = await storageManager.getActiveUploads();
      expect(activeUploads.length).toBe(0);
    });
  });

  describe('cleanupExpiredStorage', () => {
    it('应该自动清理过期的状态', async () => {
      // 保存一个即将过期的状态
      const fileId = 'test-file-10';
      const state = createTestRetryState(fileId, {
        // 设置过期时间为当前时间+5毫秒
        expiresAt: Date.now() + 5,
      });

      await storageManager.saveRetryState(fileId, state);

      // 等待过期
      await new Promise(resolve => setTimeout(resolve, 20));

      // 创建新的存储管理器，触发启动清理
      const newStorageManager = createStorageManager({
        prefix: testPrefix,
        expirationTime: testExpirationTime,
      });

      // 给清理足够的时间执行
      await new Promise(resolve => setTimeout(resolve, 100));

      // 验证过期状态已被清理
      const retrievedState = await newStorageManager.getRetryState(fileId);
      expect(retrievedState).toBeNull();
    });
  });
});
