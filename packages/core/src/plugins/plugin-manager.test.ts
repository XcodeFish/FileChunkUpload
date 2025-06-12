/**
 * 插件管理器测试
 */
import { IFileUploaderCore, IPlugin, IEventEmitter } from '@file-chunk-uploader/types';

import { Logger } from '../developer-mode/logger';

import { PluginManager } from './plugin-manager';

// 创建一个模拟的上传器
const mockUploader = {
  apiVersion: '1.0.0',
  eventEmitter: {
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
  } as unknown as IEventEmitter,
} as IFileUploaderCore;

// 创建一个模拟的Logger
const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
} as unknown as Logger;

// 创建一个测试插件
const createTestPlugin = (
  name: string,
  dependencies: string[] = [],
): IPlugin & { dependencies?: string[] } => ({
  name,
  version: '1.0.0',
  install: jest.fn(),
  lifecycle: {
    init: jest.fn(),
    cleanup: jest.fn(),
    beforeUpload: jest.fn(file => file),
    afterUpload: jest.fn(),
  },
  dependencies,
});

describe('PluginManager', () => {
  let pluginManager: PluginManager;

  beforeEach(() => {
    // 重置所有模拟
    jest.clearAllMocks();
    // 创建插件管理器实例
    pluginManager = new PluginManager(mockUploader, mockUploader.eventEmitter, mockLogger);
  });

  describe('register', () => {
    it('应该成功注册插件', () => {
      const plugin = createTestPlugin('test-plugin');
      const result = pluginManager.register(plugin);

      expect(result).toBe(true);
      expect(plugin.lifecycle?.init).toHaveBeenCalledWith(mockUploader);
      expect(mockLogger.info).toHaveBeenCalledWith('plugin', expect.stringContaining('注册成功'));
      expect(mockUploader.eventEmitter.emit).toHaveBeenCalledWith(
        'plugin:registered',
        expect.objectContaining({
          name: 'test-plugin',
          version: '1.0.0',
        }),
      );
    });

    it('应该拒绝重复注册插件', () => {
      const plugin = createTestPlugin('test-plugin');

      pluginManager.register(plugin);
      const result = pluginManager.register(plugin);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'plugin',
        expect.stringContaining('注册失败'),
        expect.any(Error),
      );
    });

    it('应该处理插件依赖关系', () => {
      const plugin1 = createTestPlugin('plugin1');
      const plugin2 = createTestPlugin('plugin2', ['plugin1']);

      pluginManager.register(plugin1);
      const result = pluginManager.register(plugin2);

      expect(result).toBe(true);
    });

    it('应该处理缺失依赖的情况', () => {
      const plugin = createTestPlugin('test-plugin', ['missing-plugin']);
      const result = pluginManager.register(plugin);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'plugin',
        expect.stringContaining('注册失败'),
        expect.any(Error),
      );
    });
  });

  describe('unregister', () => {
    it('应该成功卸载插件', () => {
      const plugin = createTestPlugin('test-plugin');

      pluginManager.register(plugin);
      const result = pluginManager.unregister('test-plugin');

      expect(result).toBe(true);
      expect(plugin.lifecycle?.cleanup).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('plugin', expect.stringContaining('卸载成功'));
      expect(mockUploader.eventEmitter.emit).toHaveBeenCalledWith(
        'plugin:unregistered',
        expect.objectContaining({
          name: 'test-plugin',
        }),
      );
    });

    it('应该处理卸载不存在的插件', () => {
      const result = pluginManager.unregister('non-existent-plugin');

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith('plugin', expect.stringContaining('未注册'));
    });

    it('应该阻止卸载被依赖的插件', () => {
      const plugin1 = createTestPlugin('plugin1');
      const plugin2 = createTestPlugin('plugin2', ['plugin1']);

      pluginManager.register(plugin1);
      pluginManager.register(plugin2);

      const result = pluginManager.unregister('plugin1');

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'plugin',
        expect.stringContaining('卸载失败'),
        expect.any(Error),
      );
    });
  });

  describe('invokeHook', () => {
    it('应该按顺序调用钩子', async () => {
      const plugin1 = createTestPlugin('plugin1');
      const plugin2 = createTestPlugin('plugin2');

      // 设置测试钩子
      (plugin1.lifecycle!.beforeUpload as jest.Mock).mockImplementation(file => {
        return new File([file], 'modified-by-plugin1.txt', { type: 'text/plain' });
      });

      (plugin2.lifecycle!.beforeUpload as jest.Mock).mockImplementation(file => {
        return new File([file], 'modified-by-plugin2.txt', { type: 'text/plain' });
      });

      pluginManager.register(plugin1);
      pluginManager.register(plugin2);

      const testFile = new File(['test'], 'test.txt', { type: 'text/plain' });
      const result = await pluginManager.invokeHook('beforeUpload', testFile, {});

      expect(result.name).toBe('modified-by-plugin2.txt');
      expect(plugin1.lifecycle!.beforeUpload).toHaveBeenCalledWith(testFile, {});
      expect(plugin2.lifecycle!.beforeUpload).toHaveBeenCalled();
    });

    it('应该处理插件状态管理', () => {
      const plugin = createTestPlugin('test-plugin');

      pluginManager.register(plugin);

      // 禁用插件
      const disableResult = pluginManager.disablePlugin('test-plugin');
      expect(disableResult).toBe(true);
      expect(pluginManager.getPluginState('test-plugin')).toBe('disabled');

      // 启用插件
      const enableResult = pluginManager.enablePlugin('test-plugin');
      expect(enableResult).toBe(true);
      expect(pluginManager.getPluginState('test-plugin')).toBe('enabled');
    });

    it('应该处理插件配置管理', () => {
      const plugin = createTestPlugin('test-plugin');

      // 注册带配置的插件
      pluginManager.register(plugin, { key: 'value' });

      // 获取配置
      const config = pluginManager.getPluginConfig('test-plugin');
      expect(config).toEqual({ key: 'value' });

      // 更新配置
      const updateResult = pluginManager.updatePluginConfig('test-plugin', { key: 'new-value' });
      expect(updateResult).toBe(true);

      // 获取更新后的配置
      const updatedConfig = pluginManager.getPluginConfig('test-plugin');
      expect(updatedConfig).toEqual({ key: 'new-value' });
    });
  });
});
