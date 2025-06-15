/**
 * 重试状态持久化测试
 * @packageDocumentation
 */

import { DefaultRetryStateStorage, createRetryStateStorage } from '../recovery/retry-state-storage';
import { NetworkInfo, RetryState } from '../recovery/retry-types';

// 模拟StorageManager
const mockStorageManager = {
  saveRetryState: jest.fn().mockResolvedValue(undefined),
  getRetryState: jest.fn(),
  getActiveUploads: jest.fn().mockResolvedValue(['file-1', 'file-2']),
  deleteRetryState: jest.fn().mockResolvedValue(undefined),
  clearRetryState: jest.fn().mockResolvedValue(undefined),
  clearAllRetryStates: jest.fn().mockResolvedValue(undefined),
};

describe('RetryStateStorage', () => {
  let stateStorage: DefaultRetryStateStorage;

  beforeEach(() => {
    jest.clearAllMocks();
    stateStorage = createRetryStateStorage({
      storageManager: mockStorageManager,
      enableSync: true,
    }) as DefaultRetryStateStorage;

    // 覆盖设备ID和会话ID生成方法，使其返回固定值以便测试
    Object.defineProperty(stateStorage, 'deviceId', {
      value: 'test-device-id',
    });

    Object.defineProperty(stateStorage, 'sessionId', {
      value: 'test-session-id',
    });
  });

  describe('saveState', () => {
    it('应该保存扩展的重试状态', async () => {
      const fileId = 'test-file-id';
      const state: Partial<RetryState> = {
        fileId,
        retryCount: 3,
        lastRetryTime: 1000,
        chunkRetries: { 1: 2, 2: 1 },
        successfulRetries: 2,
        failedRetries: 1,
      };

      await stateStorage.saveState(fileId, state as RetryState);

      expect(mockStorageManager.saveRetryState).toHaveBeenCalledWith(
        fileId,
        expect.objectContaining({
          ...state,
          deviceId: 'test-device-id',
          sessionId: 'test-session-id',
          createdAt: expect.any(Number),
          updatedAt: expect.any(Number),
          expiresAt: expect.any(Number),
          networkHistory: expect.any(Array),
          retryHistory: expect.any(Array),
          syncStatus: expect.objectContaining({
            synced: false,
            lastSyncTime: expect.any(Number),
          }),
        }),
      );
    });
  });

  describe('loadState', () => {
    it('应该加载已存在的扩展重试状态', async () => {
      const fileId = 'test-file-id';
      const existingState: RetryState = {
        fileId,
        retryCount: 3,
        lastRetryTime: 1000,
        chunkRetries: { 1: 2, 2: 1 },
        successfulRetries: 2,
        failedRetries: 1,
        deviceId: 'old-device-id',
        sessionId: 'old-session-id',
        createdAt: 1000,
        updatedAt: 2000,
        expiresAt: 3000,
        networkHistory: [],
        retryHistory: [],
        syncStatus: {
          synced: false,
          lastSyncTime: 0,
        },
      };

      mockStorageManager.getRetryState.mockResolvedValueOnce(existingState);

      const result = await stateStorage.loadState(fileId);

      expect(result).toEqual(existingState);
      expect(mockStorageManager.getRetryState).toHaveBeenCalledWith(fileId);
    });

    it('应该将基本状态转换为扩展状态', async () => {
      const fileId = 'test-file-id';
      const basicState = {
        fileId,
        retryCount: 3,
        lastRetryTime: 1000,
        chunkRetries: { 1: 2, 2: 1 },
        successfulRetries: 2,
        failedRetries: 1,
      };

      mockStorageManager.getRetryState.mockResolvedValueOnce(basicState);

      const result = await stateStorage.loadState(fileId);

      expect(result).toEqual(
        expect.objectContaining({
          ...basicState,
          deviceId: 'test-device-id',
          sessionId: 'test-session-id',
          createdAt: expect.any(Number),
          updatedAt: expect.any(Number),
          expiresAt: expect.any(Number),
          networkHistory: [],
          retryHistory: [],
          syncStatus: expect.objectContaining({
            synced: false,
            lastSyncTime: 0,
          }),
        }),
      );
    });

    it('应该在状态不存在时返回null', async () => {
      const fileId = 'non-existent-file';
      mockStorageManager.getRetryState.mockResolvedValueOnce(null);

      const result = await stateStorage.loadState(fileId);

      expect(result).toBeNull();
    });
  });

  describe('recordSuccess', () => {
    it('应该记录重试成功', async () => {
      const fileId = 'test-file-id';
      const existingState: RetryState = {
        fileId,
        retryCount: 3,
        lastRetryTime: 1000,
        chunkRetries: {},
        successfulRetries: 1,
        failedRetries: 1,
        deviceId: 'test-device-id',
        sessionId: 'test-session-id',
        createdAt: 1000,
        updatedAt: 2000,
        expiresAt: 3000,
        networkHistory: [],
        retryHistory: [],
        syncStatus: {
          synced: false,
          lastSyncTime: 0,
        },
      };

      mockStorageManager.getRetryState.mockResolvedValueOnce(existingState);

      await stateStorage.recordSuccess(fileId);

      expect(mockStorageManager.saveRetryState).toHaveBeenCalledWith(
        fileId,
        expect.objectContaining({
          successfulRetries: 2,
          retryHistory: [
            expect.objectContaining({
              timestamp: expect.any(Number),
              success: true,
            }),
          ],
        }),
      );
    });
  });

  describe('recordFailure', () => {
    it('应该记录重试失败', async () => {
      const fileId = 'test-file-id';
      const existingState: RetryState = {
        fileId,
        retryCount: 3,
        lastRetryTime: 1000,
        chunkRetries: {},
        successfulRetries: 1,
        failedRetries: 1,
        deviceId: 'test-device-id',
        sessionId: 'test-session-id',
        createdAt: 1000,
        updatedAt: 2000,
        expiresAt: 3000,
        networkHistory: [],
        retryHistory: [],
        syncStatus: {
          synced: false,
          lastSyncTime: 0,
        },
      };

      mockStorageManager.getRetryState.mockResolvedValueOnce(existingState);

      await stateStorage.recordFailure(fileId, 'Test error', 'TEST_ERROR');

      expect(mockStorageManager.saveRetryState).toHaveBeenCalledWith(
        fileId,
        expect.objectContaining({
          failedRetries: 2,
          retryHistory: [
            expect.objectContaining({
              timestamp: expect.any(Number),
              success: false,
              errorMessage: 'Test error',
              errorCode: 'TEST_ERROR',
            }),
          ],
        }),
      );
    });
  });

  describe('recordNetworkState', () => {
    it('应该记录网络状态', async () => {
      const fileId = 'test-file-id';
      const existingState: RetryState = {
        fileId,
        retryCount: 3,
        lastRetryTime: 1000,
        chunkRetries: {},
        successfulRetries: 1,
        failedRetries: 1,
        deviceId: 'test-device-id',
        sessionId: 'test-session-id',
        createdAt: 1000,
        updatedAt: 2000,
        expiresAt: 3000,
        networkHistory: [],
        retryHistory: [],
        syncStatus: {
          synced: false,
          lastSyncTime: 0,
        },
      };

      const networkInfo: NetworkInfo = {
        online: true,
        type: 'wifi',
        speed: 10,
        rtt: 50,
        lastChecked: 1000,
      };

      mockStorageManager.getRetryState.mockResolvedValueOnce(existingState);

      await stateStorage.recordNetworkState(fileId, networkInfo);

      expect(mockStorageManager.saveRetryState).toHaveBeenCalledWith(
        fileId,
        expect.objectContaining({
          networkHistory: [
            expect.objectContaining({
              timestamp: expect.any(Number),
              network: networkInfo,
            }),
          ],
        }),
      );
    });

    it('应该限制网络历史记录数量', async () => {
      const fileId = 'test-file-id';
      const networkHistory = Array(10)
        .fill(0)
        .map((_, i) => ({
          timestamp: 1000 + i,
          network: {
            online: true,
            type: 'wifi' as const,
            speed: 10,
            rtt: 50,
            lastChecked: 1000 + i,
          },
        }));

      const existingState: RetryState = {
        fileId,
        retryCount: 3,
        lastRetryTime: 1000,
        chunkRetries: {},
        successfulRetries: 1,
        failedRetries: 1,
        deviceId: 'test-device-id',
        sessionId: 'test-session-id',
        createdAt: 1000,
        updatedAt: 2000,
        expiresAt: 3000,
        networkHistory,
        retryHistory: [],
        syncStatus: {
          synced: false,
          lastSyncTime: 0,
        },
      };

      const newNetworkInfo: NetworkInfo = {
        online: true,
        type: 'cellular',
        speed: 5,
        rtt: 100,
        lastChecked: 2000,
      };

      mockStorageManager.getRetryState.mockResolvedValueOnce(existingState);

      await stateStorage.recordNetworkState(fileId, newNetworkInfo);

      // 验证保留了最新的10条记录（删除最旧的一条，添加新的一条）
      expect(mockStorageManager.saveRetryState).toHaveBeenCalledWith(
        fileId,
        expect.objectContaining({
          networkHistory: expect.arrayContaining([
            expect.objectContaining({
              network: newNetworkInfo,
            }),
          ]),
        }),
      );

      const savedState = mockStorageManager.saveRetryState.mock.calls[0][1];
      expect(savedState.networkHistory.length).toBe(10);
      // 确保第一条记录不是最旧的记录
      expect(savedState.networkHistory[0].timestamp).not.toBe(1000);
    });
  });

  describe('getAllActiveStates', () => {
    it('应该获取所有活动的重试状态', async () => {
      const state1: RetryState = {
        fileId: 'file-1',
        retryCount: 3,
        lastRetryTime: 1000,
        chunkRetries: {},
        successfulRetries: 1,
        failedRetries: 1,
        deviceId: 'test-device-id',
        sessionId: 'test-session-id',
        createdAt: 1000,
        updatedAt: 2000,
        expiresAt: Date.now() + 10000, // 未过期
        networkHistory: [],
        retryHistory: [],
        syncStatus: {
          synced: false,
          lastSyncTime: 0,
        },
      };

      const state2: RetryState = {
        fileId: 'file-2',
        retryCount: 2,
        lastRetryTime: 1500,
        chunkRetries: {},
        successfulRetries: 0,
        failedRetries: 2,
        deviceId: 'test-device-id',
        sessionId: 'test-session-id',
        createdAt: 1500,
        updatedAt: 2500,
        expiresAt: Date.now() - 10000, // 已过期
        networkHistory: [],
        retryHistory: [],
        syncStatus: {
          synced: false,
          lastSyncTime: 0,
        },
      };

      mockStorageManager.getRetryState.mockResolvedValueOnce(state1).mockResolvedValueOnce(state2);

      const result = await stateStorage.getAllActiveStates();

      expect(result.length).toBe(1);
      expect(result[0].fileId).toBe('file-1');
    });
  });

  describe('cleanupExpiredStates', () => {
    it('应该清理过期的重试状态', async () => {
      const state1: RetryState = {
        fileId: 'file-1',
        retryCount: 3,
        lastRetryTime: 1000,
        chunkRetries: {},
        successfulRetries: 1,
        failedRetries: 1,
        deviceId: 'test-device-id',
        sessionId: 'test-session-id',
        createdAt: 1000,
        updatedAt: 2000,
        expiresAt: Date.now() + 10000, // 未过期
        networkHistory: [],
        retryHistory: [],
        syncStatus: {
          synced: false,
          lastSyncTime: 0,
        },
      };

      const state2: RetryState = {
        fileId: 'file-2',
        retryCount: 2,
        lastRetryTime: 1500,
        chunkRetries: {},
        successfulRetries: 0,
        failedRetries: 2,
        deviceId: 'test-device-id',
        sessionId: 'test-session-id',
        createdAt: 1500,
        updatedAt: 2500,
        expiresAt: Date.now() - 10000, // 已过期
        networkHistory: [],
        retryHistory: [],
        syncStatus: {
          synced: false,
          lastSyncTime: 0,
        },
      };

      mockStorageManager.getRetryState.mockResolvedValueOnce(state1).mockResolvedValueOnce(state2);

      await stateStorage.cleanupExpiredStates();

      expect(mockStorageManager.deleteRetryState).toHaveBeenCalledTimes(1);
      expect(mockStorageManager.deleteRetryState).toHaveBeenCalledWith('file-2');
    });
  });

  describe('getSessionId', () => {
    it('应该返回当前会话ID', () => {
      expect(stateStorage.getSessionId()).toBe('test-session-id');
    });
  });
});
