import { chunkPlugin } from '../chunk-plugin';
import { ChunkLogCategory } from '../utils';

// 模拟上传器
const createMockUploader = () => {
  const hooks: Record<string, Array<(...args: any[]) => any>> = {};
  const strategies = new Map();
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  const logCategories: Record<string, string> = {};

  return {
    registerHook: jest.fn((name: string, fn: (...args: any[]) => any) => {
      hooks[name] = hooks[name] || [];
      hooks[name].push(fn);
    }),
    registerLogCategory: jest.fn((category: string, description: string) => {
      logCategories[category] = description;
    }),
    strategies,
    logger,
    // 帮助测试的额外属性
    _hooks: hooks,
    _logCategories: logCategories,
    executeHook: async (name: string, ...args: any[]) => {
      if (!hooks[name]) return args[0];

      let result = args[0];
      for (const hook of hooks[name]) {
        result = await hook(...args);
      }
      return result;
    },
  };
};

describe('ChunkPlugin', () => {
  it('应该创建插件实例', () => {
    const plugin = chunkPlugin();

    expect(plugin.name).toBe('chunk');
    expect(plugin.version).toBeTruthy();
    expect(typeof plugin.install).toBe('function');
    expect(typeof plugin.cleanup).toBe('function');
    expect(plugin.lifecycle).toBeDefined();
  });

  it('应该使用默认配置', () => {
    const plugin = chunkPlugin();
    const uploader = createMockUploader();

    plugin.install(uploader as any);

    expect(uploader.logger.info).toHaveBeenCalledWith(
      ChunkLogCategory.CHUNK_PLUGIN,
      '分片上传插件已安装',
      expect.objectContaining({
        chunkSize: '2MB(默认)',
        concurrency: '3(默认)',
      }),
    );
  });

  it('应该使用自定义配置', () => {
    const plugin = chunkPlugin({
      chunkSize: 5 * 1024 * 1024, // 5MB
      concurrency: 5,
      sequential: true,
    });
    const uploader = createMockUploader();

    plugin.install(uploader as any);

    expect(uploader.logger.info).toHaveBeenCalledWith(
      ChunkLogCategory.CHUNK_PLUGIN,
      '分片上传插件已安装',
      expect.objectContaining({
        chunkSize: '5MB',
        concurrency: 5,
        sequential: true,
        strategy: 'fixed',
      }),
    );
  });

  it('应该注册策略到上传器', () => {
    const plugin = chunkPlugin();
    const uploader = createMockUploader();

    plugin.install(uploader as any);

    expect(uploader.strategies.has('chunk')).toBe(true);
    expect(uploader.strategies.get('chunk')).toBeDefined();
  });

  it('应该注册钩子到上传器', () => {
    const plugin = chunkPlugin();
    const uploader = createMockUploader();

    plugin.install(uploader as any);

    // 检查关键钩子是否被注册
    expect(uploader.registerHook).toHaveBeenCalledWith('beforeUpload', expect.any(Function));
    expect(uploader.registerHook).toHaveBeenCalledWith('beforeChunkUpload', expect.any(Function));
    expect(uploader.registerHook).toHaveBeenCalledWith('afterChunkUpload', expect.any(Function));
    expect(uploader.registerHook).toHaveBeenCalledWith('afterUpload', expect.any(Function));
  });

  it('应该注册日志分类', () => {
    const plugin = chunkPlugin();
    const uploader = createMockUploader();

    plugin.install(uploader as any);

    // 检查日志分类是否被注册
    expect(uploader.registerLogCategory).toHaveBeenCalledWith(
      ChunkLogCategory.CHUNK_PLUGIN,
      expect.any(String),
    );
    expect(uploader.registerLogCategory).toHaveBeenCalledWith(
      ChunkLogCategory.CHUNK_STRATEGY,
      expect.any(String),
    );
  });

  it('应该执行文件处理钩子', async () => {
    const plugin = chunkPlugin({
      hooks: {
        beforeCreateChunks: jest.fn((file, chunkSize) => chunkSize * 2),
      },
    });
    const uploader = createMockUploader();
    plugin.install(uploader as any);

    const file = new File(['test'], 'test.txt');
    const config = { chunk: { chunkSize: 1024 } };

    await uploader.executeHook('beforeUpload', file, config);

    expect(plugin.lifecycle!.beforeUpload).toBeDefined();
    expect(config.chunk!.chunkSize).toBe(2048); // 应该被beforeCreateChunks钩子修改为原来的2倍
  });

  it('应该正确处理清理', async () => {
    const plugin = chunkPlugin();
    const uploader = createMockUploader();
    plugin.install(uploader as any);

    await plugin.cleanup!();
    // 由于cleanup主要是内部资源清理，我们确保它不会抛出错误
    expect(true).toBe(true);
  });
});
