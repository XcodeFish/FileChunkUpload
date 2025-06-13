/**
 * 分片上传插件实现
 * 提供与上传器集成的插件
 */
import type {
  IChunkConfig,
  IDevModeConfig,
  IFileInfo,
  IFileUploader,
  IFileUploaderCore,
  ILogger,
  IPlugin,
  IPluginLifecycle,
  IRetryStartInfo,
  IUploadConfig,
  IUploadError,
  IUploadResult,
  IUploadStrategy,
  PluginHookFunction,
} from '@file-chunk-uploader/types';

import { ChunkUploadStrategy } from '../chunk-strategy';
import { ChunkLogCategory, registerChunkLogCategories } from '../utils';

/**
 * 分片上传插件配置
 */
export interface ChunkPluginOptions extends Partial<IChunkConfig> {
  /**
   * 启用标志
   * @default true
   */
  enabled?: boolean;

  /**
   * 是否按顺序上传分片
   * @default false
   */
  sequential?: boolean;

  /**
   * 分片大小计算策略
   * - fixed: 使用固定分片大小
   * - adaptive: 根据文件大小和网络状况动态调整
   * @default 'fixed'
   */
  chunkSizeStrategy?: 'fixed' | 'adaptive';

  /**
   * 开发者模式配置
   * - true: 启用默认开发者模式
   * - object: 使用自定义开发者模式配置
   * - false: 禁用开发者模式
   * @default false
   */
  devMode?: boolean | IDevModeConfig;

  /**
   * 分片处理相关的自定义钩子
   */
  hooks?: {
    /**
     * 分片创建之前的钩子
     * @param file 要分片的文件
     * @param chunkSize 将要使用的分片大小
     * @returns 可能修改后的分片大小
     */
    beforeCreateChunks?: (file: File, chunkSize: number) => number | Promise<number>;

    /**
     * 分片创建之后的钩子
     * @param chunks 创建的分片数组
     * @param file 原始文件
     * @returns 可能修改后的分片数组
     */
    afterCreateChunks?: (chunks: Blob[], file: File) => Blob[] | Promise<Blob[]>;

    /**
     * 所有分片上传完成后，合并前的钩子
     * @param fileId 文件ID
     * @param chunkCount 分片总数
     */
    beforeMergeChunks?: (fileId: string, chunkCount: number) => void | Promise<void>;
  };
}

// 类型守卫函数，检查uploader是否支持registerHook
function hasRegisterHook(
  obj: any,
): obj is { registerHook: (hookName: string, handler: PluginHookFunction) => void } {
  return (
    obj &&
    typeof obj === 'object' &&
    'registerHook' in obj &&
    typeof obj.registerHook === 'function'
  );
}

// 类型守卫函数，检查uploader是否支持registerLogCategory
function hasRegisterLogCategory(
  obj: any,
): obj is { registerLogCategory: (category: string, description: string) => void } {
  return (
    obj &&
    typeof obj === 'object' &&
    'registerLogCategory' in obj &&
    typeof obj.registerLogCategory === 'function'
  );
}

// 类型守卫函数，检查uploader是否拥有strategies Map
function hasStrategiesMap(obj: any): obj is { strategies: Map<string, IUploadStrategy> } {
  return obj && typeof obj === 'object' && 'strategies' in obj && obj.strategies instanceof Map;
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
  // 记录日志实例
  let logger: ILogger | null = null;

  // 插件生命周期钩子
  const lifecycle: IPluginLifecycle = {
    /**
     * 初始化钩子
     * @param uploader 上传器实例
     */
    init: (uploader: IFileUploaderCore) => {
      if (!enabled) return;

      // 获取日志记录器
      if ('logger' in uploader) {
        const loggerObj = uploader.logger as ILogger;
        if (loggerObj && typeof loggerObj.debug === 'function') {
          logger = loggerObj;

          // 注册日志分类
          if ('registerLogCategory' in uploader) {
            registerChunkLogCategories((category, description) => {
              (uploader as any).registerLogCategory(category, description);
            });
          }
        }
      }

      // 创建分片上传策略
      chunkStrategy = new ChunkUploadStrategy(options);

      // 初始化策略
      if ('strategies' in uploader && chunkStrategy) {
        try {
          chunkStrategy.init(uploader as unknown as IFileUploader);
        } catch (error) {
          console.error('分片上传策略初始化失败:', error);
          throw new Error(`分片上传插件初始化策略失败: ${(error as Error).message}`);
        }
      } else if (!('strategies' in uploader)) {
        console.warn('分片上传插件警告: 上传器不支持策略管理, 部分功能可能不可用');
      }

      // 注册策略到上传器
      if (hasStrategiesMap(uploader)) {
        uploader.strategies.set('chunk', chunkStrategy);
      } else if ('strategies' in uploader) {
        console.warn('分片上传插件警告: 上传器的strategies属性不是Map类型');
      }

      // 注册日志分类
      if ('registerLogCategory' in uploader) {
        try {
          registerChunkLogCategories((category, description) => {
            if (hasRegisterLogCategory(uploader)) {
              uploader.registerLogCategory(category, description);
            }
          });
        } catch (error) {
          console.warn('分片上传插件警告: 注册日志分类失败', error);
        }
      }

      // 记录日志
      if (logger) {
        logger.info(ChunkLogCategory.CHUNK_PLUGIN, '分片上传插件已初始化', {
          chunkSize: options.chunkSize ? `${options.chunkSize / 1024 / 1024}MB` : '2MB(默认)',
          concurrency: options.concurrency || '3(默认)',
          sequential: options.sequential || false,
          strategy: options.chunkSizeStrategy || 'fixed',
        });
      }
    },

    /**
     * 上传前钩子
     * @param file 要上传的文件
     * @param config 上传配置
     * @returns 可能修改后的文件
     */
    beforeUpload: async (file: File, config: IUploadConfig): Promise<File> => {
      if (!enabled || !chunkStrategy) return file;

      // 记录日志
      if (logger) {
        logger.debug(ChunkLogCategory.CHUNK_STRATEGY, `准备处理文件: ${file.name}`, {
          size: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
          type: file.type,
        });
      }

      // 调用自定义钩子
      if (options.hooks?.beforeCreateChunks) {
        const chunkSize = config.chunk?.chunkSize || options.chunkSize || 2 * 1024 * 1024;
        const newChunkSize = await options.hooks.beforeCreateChunks(file, chunkSize);

        // 如果钩子返回了新的分片大小，更新配置
        if (newChunkSize && newChunkSize > 0) {
          if (!config.chunk) config.chunk = {};
          config.chunk.chunkSize = newChunkSize;

          if (logger) {
            logger.debug(ChunkLogCategory.CHUNK_STRATEGY, `分片大小已调整`, {
              originalSize: `${(chunkSize / 1024 / 1024).toFixed(2)}MB`,
              newSize: `${(newChunkSize / 1024 / 1024).toFixed(2)}MB`,
            });
          }
        }
      }

      return file;
    },

    /**
     * 分片上传前钩子
     * @param chunk 要上传的分片
     * @param index 分片索引
     * @param total 总分片数
     * @returns 可能修改后的分片
     */
    beforeChunkUpload: async (chunk: Blob, index: number, total: number): Promise<Blob> => {
      if (!enabled || !chunkStrategy) return chunk;

      // 记录日志
      if (logger) {
        logger.debug(ChunkLogCategory.CHUNK_UPLOAD, `准备上传分片 ${index + 1}/${total}`, {
          size: `${(chunk.size / 1024).toFixed(2)}KB`,
        });
      }

      return chunk;
    },

    /**
     * 分片上传后钩子
     * @param response 分片上传响应
     * @param chunk 已上传的分片
     * @param index 分片索引
     */
    afterChunkUpload: async (
      response: Record<string, unknown>,
      chunk: Blob,
      index: number,
    ): Promise<void> => {
      if (!enabled || !chunkStrategy) return;

      // 记录日志
      if (logger) {
        logger.debug(ChunkLogCategory.CHUNK_UPLOAD, `分片 ${index + 1} 上传完成`, {
          size: `${(chunk.size / 1024).toFixed(2)}KB`,
          response: response,
        });
      }
    },

    /**
     * 上传完成钩子
     * @param result 上传结果
     */
    afterUpload: async (result: IUploadResult): Promise<void> => {
      if (!enabled || !chunkStrategy) return;

      // 记录日志
      if (logger && result.file && result.success) {
        const fileInfo: IFileInfo = result.file;
        logger.info(ChunkLogCategory.CHUNK_STRATEGY, `文件上传完成`, {
          fileId: fileInfo.id,
          fileName: fileInfo.name,
          size: `${(fileInfo.size / 1024 / 1024).toFixed(2)}MB`,
        });
      }
    },

    /**
     * 错误处理钩子
     * @param error 错误对象
     * @returns 是否已处理该错误
     */
    onError: async (error: Error): Promise<boolean> => {
      if (!enabled || !chunkStrategy) return false;

      // 记录日志
      if (logger) {
        const uploadError = error as Partial<IUploadError>;
        logger.error(ChunkLogCategory.CHUNK_PLUGIN, `上传错误: ${error.message}`, {
          code: uploadError.code || 'unknown_error',
          retryable: uploadError.retryable || false,
          details: uploadError.details,
        });
      }

      // 返回false表示未处理该错误，应继续传播
      return false;
    },

    /**
     * 重试开始钩子
     * @param retryInfo 重试信息
     */
    onRetryStart: async (retryInfo: IRetryStartInfo): Promise<void> => {
      if (!enabled || !chunkStrategy) return;

      // 记录日志
      if (logger) {
        logger.info(ChunkLogCategory.CHUNK_UPLOAD, `开始第${retryInfo.retryCount}次重试`, {
          fileId: retryInfo.fileId,
          chunkIndex: retryInfo.chunkIndex,
          delay: `${retryInfo.delay}ms`,
          error: retryInfo.error.message,
        });
      }
    },

    /**
     * 清理资源钩子
     */
    cleanup: async (): Promise<void> => {
      if (!enabled || !chunkStrategy) return;

      // 调用策略的清理方法
      await chunkStrategy.cleanup();
      chunkStrategy = null;

      // 记录日志
      if (logger) {
        logger.debug(ChunkLogCategory.CHUNK_PLUGIN, '分片上传插件已清理');
      }
    },
  };

  // 返回插件定义
  return {
    name: 'chunk',
    version: '1.0.0',
    install: (uploader: IFileUploaderCore) => {
      if (!enabled) {
        return;
      }

      // 检查上传器参数合法性
      if (!uploader) {
        throw new Error('分片上传插件安装失败: 上传器实例为空');
      }

      // 安装生命周期钩子
      for (const [key, hook] of Object.entries(lifecycle)) {
        if (hook && typeof hook === 'function') {
          if (hasRegisterHook(uploader)) {
            uploader.registerHook(key, hook as PluginHookFunction);
          } else {
            console.warn(`分片上传插件警告: 上传器不支持注册钩子 "${key}", 部分功能可能不可用`);
          }
        }
      }

      // 创建分片上传策略
      chunkStrategy = new ChunkUploadStrategy(options);

      // 初始化策略
      if ('strategies' in uploader && chunkStrategy) {
        try {
          chunkStrategy.init(uploader as unknown as IFileUploader);
        } catch (error) {
          console.error('分片上传策略初始化失败:', error);
          throw new Error(`分片上传插件初始化策略失败: ${(error as Error).message}`);
        }
      } else if (!('strategies' in uploader)) {
        console.warn('分片上传插件警告: 上传器不支持策略管理, 部分功能可能不可用');
      }

      // 注册策略到上传器
      if (hasStrategiesMap(uploader)) {
        uploader.strategies.set('chunk', chunkStrategy);
      } else if ('strategies' in uploader) {
        console.warn('分片上传插件警告: 上传器的strategies属性不是Map类型');
      }

      // 注册日志分类
      if ('registerLogCategory' in uploader) {
        try {
          registerChunkLogCategories((category, description) => {
            if (hasRegisterLogCategory(uploader)) {
              uploader.registerLogCategory(category, description);
            }
          });
        } catch (error) {
          console.warn('分片上传插件警告: 注册日志分类失败', error);
        }
      }

      // 记录日志
      if ('logger' in uploader) {
        const loggerObj = uploader.logger as ILogger;
        if (loggerObj && typeof loggerObj.info === 'function') {
          logger = loggerObj;
          logger.info(ChunkLogCategory.CHUNK_PLUGIN, `分片上传插件已安装`, {
            chunkSize: options.chunkSize ? `${options.chunkSize / 1024 / 1024}MB` : '2MB(默认)',
            concurrency: options.concurrency || '3(默认)',
            sequential: options.sequential || false,
            strategy: options.chunkSizeStrategy || 'fixed',
          });
        }
      }
    },
    lifecycle,
    // 清理资源
    cleanup: async () => {
      // 调用生命周期的清理方法
      if (lifecycle.cleanup) {
        await lifecycle.cleanup();
      }
    },
  };
};
