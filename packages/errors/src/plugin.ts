/**
 * 错误处理插件
 * 提供错误重试和恢复功能
 * @packageDocumentation
 */

import { IPlugin, IRetryConfig, IErrorContext, IUploadError } from '@file-chunk-uploader/types';

import { createRetryManager } from './recovery';
import { ExtendedErrorContext } from './recovery/retry-types';

// 注意：此处为了符合IPlugin接口规范，我们使用any类型，但后续应当完善为具体类型
// 理想情况下应该创建或导入具体的IFileUploaderCore接口

/**
 * 错误处理插件
 * 提供错误重试和恢复功能
 */
export class ErrorPlugin implements IPlugin {
  /**
   * 插件名称
   */
  readonly name = 'error-plugin';

  /**
   * 插件版本
   */
  readonly version = '1.0.0';

  /**
   * 重试配置
   */
  private retryConfig: IRetryConfig;

  /**
   * 重试管理器
   */
  private retryManager: ReturnType<typeof createRetryManager>;

  /**
   * 构造函数
   * @param options 插件选项
   */
  constructor(options: { retryConfig?: IRetryConfig } = {}) {
    this.retryConfig = options.retryConfig || {
      enabled: true,
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      useExponentialBackoff: true,
    };

    // 创建重试管理器
    this.retryManager = createRetryManager({
      config: this.retryConfig,
    });
  }

  /**
   * 安装插件
   * @param uploader 上传器实例，提供必要的方法和事件处理
   * @param options 插件选项
   */
  install(uploader: any, _options?: Record<string, unknown>): void {
    // 监听错误事件
    uploader.on('error', async (error: IUploadError, context: IErrorContext) => {
      // 转换为扩展上下文
      const extendedContext: ExtendedErrorContext = {
        ...context,
        timestamp: Date.now(),
        lastError: error, // 确保lastError是IUploadError类型
      };

      // 处理重试
      await this.retryManager.retry(error, extendedContext, async () => {
        // 重试处理逻辑
        if (context.chunkIndex !== undefined) {
          // 重试分片上传
          await uploader.retryChunk(context.fileId || '', context.chunkIndex);
        } else {
          // 重试整个文件上传
          await uploader.retryFile(context.fileId || '');
        }
      });
    });

    // 监听上传完成事件，清理相关资源
    uploader.on('complete', () => {
      this.retryManager.cleanup().catch(err => {
        console.error('清理重试管理器资源失败:', err);
      });
    });
  }
}
