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
  IDevModeConfig,
  IRetryConfig,
} from '@file-chunk-uploader/types';

import { createErrorHandler, ErrorHandlerConfig } from './error-handler';
import { createRetryManager } from './recovery';
// 导入重试相关类型
import type {
  RetryStartInfo as IRetryStartInfo,
  RetrySuccessInfo as IRetrySuccessInfo,
  RetryFailedInfo as IRetryFailedInfo,
  RetryManagerOptions,
  EventEmitter,
  StorageManager,
} from './recovery/retry-types';

// 扩展IFileUploaderCore接口以添加可能存在的属性
interface IExtendedFileUploaderCore extends IFileUploaderCore {
  logger?: {
    info(category: string, message: string, data?: any): void;
    warn(category: string, message: string, data?: any): void;
    error(category: string, message: string, data?: any): void;
    debug(category: string, message: string, data?: any): void;
  };
  storageManager?: StorageManager;
}

/**
 * 错误处理插件配置接口
 */
export interface ErrorPluginConfig {
  /** 是否启用插件 */
  enabled?: boolean;

  /** 错误处理器配置 */
  errorHandler?: Partial<ErrorHandlerConfig>;

  /** 重试配置 */
  retry?: IRetryConfig;

  /** 恢复管理器配置 */
  recovery?: Partial<RetryManagerOptions>;

  /** 是否启用详细日志 */
  verboseLogging?: boolean;

  /** 是否启用事件通知 */
  notifyOnError?: boolean;

  /** 是否启用重试事件通知 */
  notifyOnRetry?: boolean;

  /** 是否持久化重试状态 */
  persistRetryState?: boolean;

  /** 开发者模式配置 */
  devMode?: boolean | IDevModeConfig;

  /**
   * 重试相关的自定义钩子
   */
  hooks?: {
    /**
     * 重试开始前的钩子
     * @param retryInfo 重试开始信息
     * @returns 是否继续重试，返回false将取消此次重试
     */
    beforeRetry?: (retryInfo: IRetryStartInfo) => boolean | Promise<boolean>;

    /**
     * 重试结束后的钩子
     * @param retryInfo 重试成功信息
     */
    afterRetry?: (retryInfo: IRetrySuccessInfo) => void | Promise<void>;

    /**
     * 自定义错误过滤规则
     * @param error 错误对象
     * @returns 如果返回true，错误将被处理；返回false表示跳过此错误
     */
    errorFilter?: (error: IUploadError) => boolean | Promise<boolean>;

    /**
     * 重试失败后的钩子
     * @param retryInfo 重试失败信息
     */
    afterRetryFailed?: (retryInfo: IRetryFailedInfo) => void | Promise<void>;

    /**
     * 网络恢复后的钩子
     * @param fileId 文件ID
     */
    onNetworkRecovered?: (fileId: string) => void | Promise<void>;
  };

  /**
   * 开发者分析功能配置
   */
  analysis?: {
    /** 是否启用错误分析 */
    enabled?: boolean;
    /** 是否记录详细的重试日志 */
    detailedRetryLogs?: boolean;
    /** 是否记录网络状况 */
    trackNetworkConditions?: boolean;
    /** 是否分析重试成功率 */
    analyzeRetrySuccess?: boolean;
    /** 是否生成错误报告 */
    generateErrorReports?: boolean;
  };
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
      // 使用扩展后的上传器类型
      const uploaderExt = uploader as IExtendedFileUploaderCore;

      // 合并配置
      const finalConfig: ErrorPluginConfig = {
        enabled: true,
        verboseLogging: false,
        notifyOnError: true,
        notifyOnRetry: true,
        persistRetryState: true,
        analysis: {
          enabled: false,
          detailedRetryLogs: false,
          trackNetworkConditions: false,
          analyzeRetrySuccess: false,
          generateErrorReports: false,
        },
        ...config,
        ...options,
      };

      // 如果未启用，则不安装
      if (finalConfig.enabled === false) {
        return;
      }

      // 获取事件发射器
      const eventEmitter = uploader.eventEmitter;

      // 获取开发者模式配置
      let devMode: IDevModeConfig | undefined;
      if (finalConfig.devMode) {
        devMode =
          typeof finalConfig.devMode === 'boolean' ? { enabled: true } : finalConfig.devMode;
      }

      // 创建日志记录器
      const logger = devMode?.enabled && uploaderExt.logger ? uploaderExt.logger : undefined;

      // 创建错误处理器配置
      const errorHandlerConfig: Partial<ErrorHandlerConfig> = {
        ...finalConfig.errorHandler,
        verbose: finalConfig.verboseLogging,
        notifyOnError: finalConfig.notifyOnError,
      };

      // 创建错误处理器 - 注意：这里不再直接传递给retryManager
      createErrorHandler(errorHandlerConfig, logger, eventEmitter);

      // 创建重试配置
      const retryManagerOptions: RetryManagerOptions = {
        config: finalConfig.retry,
        eventEmitter: eventEmitter as unknown as EventEmitter,
        ...(finalConfig.recovery || {}),
      };

      // 如果有存储管理器且配置了持久化重试状态
      if (uploaderExt.storageManager && finalConfig.persistRetryState) {
        retryManagerOptions.storageManager = uploaderExt.storageManager;
      }

      // 创建重试管理器
      const retryManager = createRetryManager(retryManagerOptions);

      // 注册错误处理钩子
      uploader.registerHook('onError', async (error: unknown, context?: IErrorContext) => {
        // 转换通用Error为IUploadError
        let uploadError: IUploadError;

        if (typeof error === 'object' && error !== null && 'code' in error) {
          uploadError = error as IUploadError;
        } else {
          // 如果不是标准的IUploadError，构造一个
          const originalError = error instanceof Error ? error : new Error(String(error));
          uploadError = {
            name: originalError.name,
            message: originalError.message,
            code: 'unknown_error',
            retryable: true,
            timestamp: Date.now(),
            originalError,
            stack: originalError.stack,
          };
        }

        // 如果错误已处理，则跳过
        if (uploadError.handled) {
          return;
        }

        // 应用错误过滤钩子
        if (finalConfig.hooks?.errorFilter) {
          try {
            const shouldProcess = await finalConfig.hooks.errorFilter(uploadError);
            if (!shouldProcess) {
              return;
            }
          } catch (err) {
            // 钩子执行失败，记录日志
            logger?.error('errorHandler', '错误过滤钩子执行失败', err);
          }
        }

        // 标记错误为已处理
        uploadError.handled = true;

        // 填充上下文中缺失的信息
        const completeContext: IErrorContext = context || {
          retryCount: 0,
          timestamp: Date.now(),
        };

        // 开发者模式错误分析
        if (devMode?.enabled && finalConfig.analysis?.enabled && logger) {
          logger.info('errorAnalysis', `错误分析: [${uploadError.code}] ${uploadError.message}`, {
            errorType: uploadError.code,
            fileId: completeContext.fileId,
            chunkIndex: completeContext.chunkIndex,
            retryCount: completeContext.retryCount,
            timestamp: completeContext.timestamp,
            operation: completeContext.operation || uploadError.operation,
            details: uploadError.details || {},
          });

          // 检查是否是重试相关错误
          if (completeContext.retryCount > 0 && finalConfig.analysis?.detailedRetryLogs) {
            logger.debug('errorAnalysis', '重试历史', {
              fileId: completeContext.fileId,
              previousRetries: completeContext.retryCount,
              chunkRetries: completeContext.chunkRetries,
              successfulRetries: completeContext.successfulRetries,
              failedRetries: completeContext.failedRetries,
            });
          }
        }

        // 处理错误并可能触发重试
        try {
          await retryManager.retry(
            uploadError,
            completeContext,
            // 包装重试处理函数，支持用户自定义钩子
            async () => {
              const retryInfo: IRetryStartInfo = {
                fileId: completeContext.fileId,
                chunkIndex: completeContext.chunkIndex,
                retryCount: completeContext.retryCount + 1,
                delay: 0, // 实际延迟由恢复管理器计算
                error: uploadError,
              };

              // 开发者模式记录重试详情
              if (devMode?.enabled && logger) {
                logger.info('retry', `准备重试上传 [${retryInfo.retryCount}]`, {
                  fileId: retryInfo.fileId,
                  chunkIndex: retryInfo.chunkIndex,
                  delay: retryInfo.delay,
                  errorCode: uploadError.code,
                });

                // 增强的开发者模式分析
                if (finalConfig.analysis?.detailedRetryLogs) {
                  logger.debug('retryAnalysis', '重试策略分析', {
                    retryCount: retryInfo.retryCount,
                    delay: retryInfo.delay,
                    errorType: uploadError.code,
                    algorithm: finalConfig.retry?.useExponentialBackoff ? '指数退避' : '线性延迟',
                    maxRetries: finalConfig.retry?.maxRetries || 3,
                    baseDelay: finalConfig.retry?.baseDelay || 1000,
                    timestamp: Date.now(),
                  });
                }
              }

              // 触发重试开始前钩子
              if (finalConfig.hooks?.beforeRetry) {
                try {
                  const shouldContinue = await finalConfig.hooks.beforeRetry(retryInfo);
                  if (!shouldContinue) {
                    if (devMode?.enabled && logger) {
                      logger.info('retry', '重试被用户钩子取消', { retryInfo });
                    }
                    // 用户钩子返回false，取消重试
                    throw new Error('重试被用户钩子取消');
                  }
                } catch (err) {
                  // 钩子执行失败，记录日志
                  logger?.error('errorHandler', '重试前钩子执行失败', err);
                  throw err;
                }
              }

              // 发送重试开始事件
              if (finalConfig.notifyOnRetry) {
                eventEmitter.emit('retry:start', retryInfo);
              }

              // 执行 uploader 的重试钩子
              try {
                await uploader.executeHook('onRetryStart', retryInfo);
              } catch (hookErr) {
                logger?.error('errorHandler', '执行onRetryStart钩子失败', hookErr);
              }
            },
          );
        } catch (handleErr) {
          // 错误处理自身出错，记录日志
          logger?.error('errorHandler', '错误处理过程失败', handleErr);
        }
      });

      // 注册重试成功钩子
      uploader.registerHook('onRetrySuccess', async (context: IErrorContext) => {
        try {
          // 处理重试成功
          await retryManager.handleRetrySuccess(context);

          // 构建重试成功信息
          const successInfo: IRetrySuccessInfo = {
            fileId: context.fileId || '',
            chunkIndex: context.chunkIndex,
            successCount: context.successfulRetries || 1,
          };

          // 触发重试成功事件
          if (finalConfig.notifyOnRetry) {
            eventEmitter.emit('retry:success', successInfo);
          }

          // 开发者模式记录重试成功
          if (devMode?.enabled && logger) {
            logger.info('retry', `重试上传成功 [${context.fileId}]`, {
              fileId: context.fileId,
              chunkIndex: context.chunkIndex,
              successCount: successInfo.successCount,
            });

            // 增强的开发者模式分析
            if (finalConfig.analysis?.analyzeRetrySuccess) {
              logger.debug('retryAnalysis', '重试成功分析', {
                fileId: context.fileId,
                totalRetries: context.retryCount,
                successfulRetries: context.successfulRetries,
                timestamp: Date.now(),
                elapsedTime: context.timestamp ? Date.now() - context.timestamp : undefined,
              });
            }
          }

          // 执行用户自定义的重试成功钩子
          if (finalConfig.hooks?.afterRetry) {
            try {
              await finalConfig.hooks.afterRetry(successInfo);
            } catch (err) {
              logger?.error('errorHandler', '重试成功钩子执行失败', err);
            }
          }
        } catch (err) {
          logger?.error('errorHandler', '处理重试成功失败', err);
        }
      });

      // 注册重试失败钩子
      uploader.registerHook('onRetryFailed', async (info: IRetryFailedInfo) => {
        // 触发重试失败事件
        if (finalConfig.notifyOnRetry) {
          eventEmitter.emit('retry:failed', info);
        }

        // 开发者模式记录重试失败
        if (devMode?.enabled && logger) {
          logger.warn('retry', `重试上传失败 [${info.fileId}]`, {
            fileId: info.fileId,
            errorCode: info.error.code,
            recoverable: info.recoverable,
            message: info.error.message,
          });

          // 增强的开发者模式分析
          if (finalConfig.analysis?.generateErrorReports) {
            logger.debug('retryAnalysis', '重试失败分析', {
              fileId: info.fileId,
              errorType: info.error.code,
              recoverable: info.recoverable,
              errorDetails: info.error.details || {},
              timestamp: Date.now(),
            });
          }
        }

        // 执行用户自定义的重试失败钩子
        if (finalConfig.hooks?.afterRetryFailed) {
          try {
            await finalConfig.hooks.afterRetryFailed(info);
          } catch (err) {
            logger?.error('errorHandler', '重试失败钩子执行失败', err);
          }
        }
      });

      // 注册网络恢复钩子
      eventEmitter.on(
        'retry:network_recovered',
        async (data: { fileId: string; chunkIndex?: number }) => {
          // 开发者模式记录网络恢复
          if (devMode?.enabled && logger) {
            logger.info('network', `网络已恢复，准备继续上传 [${data.fileId}]`, {
              fileId: data.fileId,
              chunkIndex: data.chunkIndex,
            });

            // 增强的网络状况跟踪
            if (finalConfig.analysis?.trackNetworkConditions) {
              const networkInfo = retryManagerOptions.networkDetector?.getCurrentNetwork();
              if (networkInfo) {
                logger.debug('networkAnalysis', '网络恢复状况', {
                  fileId: data.fileId,
                  online: networkInfo.online,
                  type: networkInfo.type,
                  speed: networkInfo.speed,
                  rtt: networkInfo.rtt,
                  timestamp: Date.now(),
                });
              }
            }
          }

          // 执行用户自定义的网络恢复钩子
          if (finalConfig.hooks?.onNetworkRecovered && data.fileId) {
            try {
              await finalConfig.hooks.onNetworkRecovered(data.fileId);
            } catch (err) {
              logger?.error('errorHandler', '网络恢复钩子执行失败', err);
            }
          }
        },
      );

      // 注册清理钩子
      uploader.registerHook('onDestroy', async () => {
        await retryManager.cleanup();
      });

      // 记录插件安装成功日志
      if (finalConfig.verboseLogging || (devMode?.enabled && logger)) {
        const logMode = devMode?.enabled
          ? '开发者模式'
          : finalConfig.verboseLogging
          ? '详细模式'
          : '基础模式';

        logger?.info('errorHandler', `错误处理插件已安装 [${logMode}]`, {
          retryEnabled: finalConfig.retry?.enabled !== false,
          persistRetryState: finalConfig.persistRetryState,
          notifyOnRetry: finalConfig.notifyOnRetry,
          notifyOnError: finalConfig.notifyOnError,
          analysisEnabled: finalConfig.analysis?.enabled,
        });
      }
    },
    hooks: {
      // 上传前钩子：清空前一个文件的错误记录
      onBeforeUpload: file => {
        return file;
      },

      // 重试相关钩子
      onRetryStart: (info: any) => {
        return info;
      },
      onRetrySuccess: (info: any) => {
        return info;
      },
      onRetryFailed: (info: any) => {
        return info;
      },
    },
    // 提供清理方法
    cleanup: () => {
      // 清理资源
    },
  };
}

/**
 * 默认导出错误处理插件
 */
export default errorPlugin;
