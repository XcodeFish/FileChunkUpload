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
 * 错误处理插件配置选项
 */
export interface ErrorPluginOptions {
  /**
   * 是否启用插件
   */
  enabled?: boolean;
  /**
   * 重试配置
   */
  retryConfig?: IRetryConfig;
  /**
   * 兼容旧版接口的配置
   */
  errorHandler?: Record<string, any>;
  /**
   * 兼容旧版接口的恢复配置
   */
  recovery?: Record<string, any>;
}

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
   * 是否启用
   */
  private enabled: boolean;

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
  constructor(options: ErrorPluginOptions = {}) {
    this.enabled = options.enabled !== false;

    // 兼容旧版接口
    const errorHandlerOptions = options.errorHandler || {};

    this.retryConfig = options.retryConfig || {
      enabled: true,
      maxRetries: errorHandlerOptions.maxRetries || 3,
      baseDelay: errorHandlerOptions.baseDelay || 1000,
      maxDelay: errorHandlerOptions.maxDelay || 30000,
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
    if (!this.enabled) {
      return;
    }

    // 兼容旧版接口 - 注册钩子
    uploader.registerHook?.('onError', async (error: IUploadError, context: IErrorContext) => {
      await this.handleError(uploader, error, context);
    });

    uploader.registerHook?.('onRetrySuccess', async (context: IErrorContext) => {
      await this.handleRetrySuccess(uploader, context);
    });

    uploader.registerHook?.('onDestroy', async () => {
      await this.cleanupInternal();
    });

    // 监听错误事件 - 新接口
    uploader.on?.('error', async (error: IUploadError, context: IErrorContext) => {
      await this.handleError(uploader, error, context);
    });

    // 监听上传完成事件，清理相关资源
    uploader.on?.('complete', () => {
      this.cleanupInternal().catch(err => {
        console.error('清理重试管理器资源失败:', err);
      });
    });
  }

  /**
   * 实现IPlugin接口的cleanup方法
   */
  async cleanup(): Promise<void> {
    await this.cleanupInternal();
  }

  /**
   * 处理错误
   */
  private async handleError(
    uploader: any,
    error: IUploadError,
    context: IErrorContext,
  ): Promise<void> {
    // 创建扩展上下文
    const extendedContext: ExtendedErrorContext = {
      fileId: context.fileId,
      chunkIndex: context.chunkIndex,
      retryCount: context.retryCount || 0,
      timestamp: Date.now(),
      lastError: error,
    };

    // 处理重试
    await this.retryManager.retry(error, extendedContext, async () => {
      // 重试处理逻辑
      if (extendedContext.chunkIndex !== undefined) {
        // 重试分片上传
        await uploader.retryChunk?.(extendedContext.fileId || '', extendedContext.chunkIndex);
      } else {
        // 重试整个文件上传
        await uploader.retryFile?.(extendedContext.fileId || '');
      }
    });
  }

  /**
   * 处理重试成功
   */
  private async handleRetrySuccess(uploader: any, context: IErrorContext): Promise<void> {
    // 将IErrorContext转换为ExtendedErrorContext
    const extendedContext: ExtendedErrorContext = {
      ...context,
      timestamp: context.timestamp || Date.now(),
      // 确保lastError是IUploadError类型
      lastError: context.lastError as IUploadError | undefined,
    };

    await this.retryManager.handleRetrySuccess(extendedContext);
  }

  /**
   * 清理资源
   */
  private async cleanupInternal(): Promise<void> {
    await this.retryManager.cleanup();
  }
}

/**
 * 创建错误处理插件
 * @param options 插件选项
 * @returns 错误处理插件实例
 */
export function errorPlugin(options: ErrorPluginOptions = {}): ErrorPlugin {
  return new ErrorPlugin(options);
}
