/**
 * 模拟存储管理器测试文件
 */
import { MockStorageManager } from '../mocks/type-overrides';

describe('StorageManager 模拟测试', () => {
  let storageManager: MockStorageManager;

  beforeEach(() => {
    storageManager = new MockStorageManager();
  });

  describe('基本操作', () => {
    it('应该成功初始化', async () => {
      await expect(storageManager.init()).resolves.not.toThrow();
    });

    it('应该能获取数据', async () => {
      const result = await storageManager.get('test-key');
      expect(result).toBeTruthy();
      expect(result.key).toBe('test-key');
      expect(result.value).toBe('mock-value');
    });

    it('应该能保存数据', async () => {
      await expect(storageManager.set('test-key', { data: 'test' })).resolves.not.toThrow();
    });

    it('应该能删除数据', async () => {
      await expect(storageManager.delete('test-key')).resolves.not.toThrow();
    });

    it('应该能清空所有数据', async () => {
      await expect(storageManager.clear()).resolves.not.toThrow();
    });

    it('应该能关闭连接', async () => {
      await expect(storageManager.close()).resolves.not.toThrow();
    });
  });
});
