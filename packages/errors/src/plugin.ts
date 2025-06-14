/**
 * 错误处理插件
 * 提供错误处理和重试功能的插件实现
 * @packageDocumentation
 */

import {
  IPlugin,
  IFileUploaderCore,
  IUploadError,
  IErrorContext,
} from '@file-chunk-uploader/types';

import { createErrorHandler, ErrorHandlerConfig } from './error-handler';
import { createRecoveryManager, RecoveryManagerConfig } from './recovery';

/**
 * 错误处理插件配置接口
 */
export interface ErrorPluginConfig {
  /** 是否启用插件 */
  enabled?: boolean;
  /** 错误处理器配置 */
  errorHandler?: Partial<ErrorHandlerConfig>;
  /** 恢复管理器配置 */
  recovery?: RecoveryManagerConfig;
  /** 是否启用详细日志 */
  verboseLogging?: boolean;
  /** 是否启用事件通知 */
  notifyOnError?: boolean;
}

/**
 * 创建错误处理插件
 * @param config 插件配置
 * @returns 错误处理插件
 */
export function errorPlugin(config: ErrorPluginConfig = {}): IPlugin {
  return {
    name: 'error-handler',
    version: '1.0.0',
    install: (uploader: IFileUploaderCore, options = {}) => {
      // 合并配置
      const finalConfig: ErrorPluginConfig = {
        enabled: true,
        verboseLogging: false,
        notifyOnError: true,
        ...config,
        ...options,
      };

      // 如果未启用，则不安装
      if (finalConfig.enabled === false) {
        return;
      }

      // 获取事件发射器
      const eventEmitter = uploader.eventEmitter;

      // 创建错误处理器配置
      const errorHandlerConfig: Partial<ErrorHandlerConfig> = {
        ...finalConfig.errorHandler,
        verbose: finalConfig.verboseLogging,
        notifyOnError: finalConfig.notifyOnError,
      };

      // 创建错误处理器
      const errorHandler = createErrorHandler(errorHandlerConfig, undefined, eventEmitter);

      // 创建恢复管理器
      const recoveryManager = createRecoveryManager(errorHandler, {
        // 使用上传器的事件系统
        eventEmitter: eventEmitter,
        config: finalConfig.recovery,
      });

      // 注册错误处理钩子
      uploader.registerHook('onError', async (error: IUploadError, context?: IErrorContext) => {
        // 如果错误已处理，则跳过
        if (error.handled) {
          return;
        }

        // 标记错误为已处理
        error.handled = true;

        // 处理错误
        await recoveryManager.handleError(
          error,
          context || { retryCount: 0, timestamp: Date.now() },
        );
      });

      // 注册重试成功钩子
      uploader.registerHook('onRetrySuccess', async (context: IErrorContext) => {
        await recoveryManager.handleRetrySuccess(context);
      });

      // 注册清理钩子
      uploader.registerHook('onDestroy', async () => {
        await recoveryManager.cleanup();
      });

      // 记录插件安装成功日志
      if (finalConfig.verboseLogging) {
        console.info(`[错误处理插件] 已安装 [${finalConfig.verboseLogging ? '详细' : '基础'}模式]`);
      }
    },
    hooks: {
      // 可以在这里添加其他钩子
      onBeforeUpload: file => {
        // 清空前一个文件的错误记录
        return file;
      },
    },
  };
}
