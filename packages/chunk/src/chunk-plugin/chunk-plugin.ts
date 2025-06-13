/**
 * 分片上传插件实现
 * 提供与上传器集成的插件
 */
import type { IChunkConfig, IPlugin } from '@file-chunk-uploader/types';

import { ChunkUploadStrategy } from '../chunk-strategy';

/**
 * 分片上传插件配置
 */
export interface ChunkPluginOptions extends Partial<IChunkConfig> {
  /**
   * 启用标志
   * @default true
   */
  enabled?: boolean;
}

/**
 * 分片上传插件
 * @param options 分片上传选项
 * @returns 插件对象
 */
export const chunkPlugin = (options: ChunkPluginOptions = {}): IPlugin => {
  // 默认启用
  const enabled = options.enabled !== false;
  // 存储策略实例引用，用于清理
  let chunkStrategy: ChunkUploadStrategy | null = null;

  return {
    name: 'chunk',
    version: '1.0.0',
    install: (uploader: any) => {
      if (!enabled) {
        return;
      }

      // 创建分片上传策略
      chunkStrategy = new ChunkUploadStrategy(options);

      // 初始化策略
      chunkStrategy.init(uploader);

      // 注册策略到上传器
      uploader.strategies.set('chunk', chunkStrategy);

      // 记录日志
      if ('logger' in uploader && uploader.logger) {
        uploader.logger.info('plugin', `分片上传插件已安装`, {
          chunkSize: options.chunkSize || '2MB(默认)',
          concurrency: options.concurrency || '3(默认)',
        });
      }
    },

    // 清理资源
    cleanup: async () => {
      // 调用策略的清理方法
      if (chunkStrategy) {
        await chunkStrategy.cleanup();
        chunkStrategy = null;
      }
      // 注意：分片上传策略的资源清理已在策略的cleanup方法中实现
      // 上传器在卸载插件时会调用策略的cleanup方法，因此这里不需要重复清理
    },
  };
};
