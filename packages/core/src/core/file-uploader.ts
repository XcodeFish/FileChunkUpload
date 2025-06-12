/**
 * 文件上传器基础类
 * 实现文件上传的核心功能，支持暂停、恢复、取消等操作
 */
import {
  IFileUploader,
  IFileUploaderCore,
  IUploadConfig,
  IUploadTask,
  IUploadResult,
  IUploadProgress,
  IEventEmitter,
  IPluginManager,
  IPlugin,
  IStorageManager,
  INetworkAdapter,
  EventName,
  IFileInfo,
  UploadStatus,
} from '@file-chunk-uploader/types';
import { generateFileId } from '@file-chunk-uploader/utils';

import { Logger } from '../developer-mode';
import { LogLevel } from '../developer-mode/types';
import { EventEmitter } from '../events';
import { PluginManager } from '../plugins';

import { getDefaultConfig } from './config';
import { UploaderTask } from './uploader-task';

/**
 * 文件上传器基础类
 */
export class FileUploader implements IFileUploader, IFileUploaderCore {
  /** 上传配置 */
  public config: IUploadConfig;

  /** 插件管理器 */
  public pluginManager: IPluginManager;

  /** 事件发射器 */
  public eventEmitter: IEventEmitter;

  /** 上传策略映射 */
  public strategies: Map<string, any> = new Map();

  /** 网络适配器 */
  public networkAdapter?: INetworkAdapter;

  /** 存储管理器 */
  public storageManager?: IStorageManager;

  /** 日志记录器 */
  public logger?: Logger;

  /** API版本 */
  public apiVersion = '1.0.0';

  /** 上传任务映射 */
  private tasks: Map<string, UploaderTask> = new Map();

  /**
   * 创建文件上传器实例
   * @param config 上传配置
   */
  constructor(config: Partial<IUploadConfig> = {}) {
    // 合并默认配置
    this.config = {
      ...getDefaultConfig(),
      ...config,
    };

    // 初始化事件发射器
    this.eventEmitter = new EventEmitter();

    // 准备Logger配置
    let loggerLevel = LogLevel.INFO;
    if (this.config.devMode && typeof this.config.devMode !== 'boolean') {
      if (this.config.devMode.logger?.level !== undefined) {
        loggerLevel = this.config.devMode.logger.level;
      }
    }

    // 初始化日志记录器
    this.logger = new Logger({
      level: loggerLevel,
      colorize: true,
      enabledCategories: true,
    });

    // 初始化插件管理器
    this.pluginManager = new PluginManager(this, this.eventEmitter, this.logger, {
      enableHealthMonitoring: true,
      enablePriorityControl: true,
      enableStateManagement: true,
      checkApiCompatibility: true,
      enableTracing: !!this.config.devMode,
    });

    // 触发初始化事件
    this.eventEmitter.emit(EventName.UPLOADER_INITIALIZED, { timestamp: Date.now() });

    // 记录日志
    this.logger.info('core', '文件上传器初始化完成', { config: this.config });
  }

  /**
   * 上传文件
   * @param file 要上传的文件
   * @param options 上传选项，会覆盖实例配置
   * @returns 上传结果Promise
   */
  public async upload(file: File | Blob, options?: Partial<IUploadConfig>): Promise<IUploadResult> {
    // 合并配置
    const config = {
      ...this.config,
      ...(options || {}),
    };

    // 创建文件信息
    const fileInfo: IFileInfo = {
      id: generateFileId(file),
      name: 'name' in file ? file.name : `blob-${Date.now()}`,
      size: file.size,
      type: file.type,
      lastModified: 'lastModified' in file ? file.lastModified : Date.now(),
    };

    // 执行beforeUpload钩子，允许插件修改文件
    try {
      const processedFile = await this.executeHook('beforeUpload', file, config);

      if (!processedFile) {
        throw new Error('上传被取消');
      }

      // 创建并启动上传任务
      const task = new UploaderTask(
        fileInfo,
        processedFile,
        config,
        this.eventEmitter,
        this.strategies,
        this.logger,
      );

      // 保存任务
      this.tasks.set(fileInfo.id, task);

      // 触发文件添加事件
      this.eventEmitter.emit(EventName.FILE_ADDED, { file: fileInfo });

      // 开始上传
      const result = await task.start();

      // 触发上传完成事件
      if (result.success) {
        this.eventEmitter.emit(EventName.UPLOAD_SUCCESS, {
          file: fileInfo,
          result,
          completeTime: Date.now(),
          duration: task.getTimeElapsed(),
        });
      } else {
        this.eventEmitter.emit(EventName.UPLOAD_ERROR, {
          file: fileInfo,
          error: result.error || new Error('上传失败'),
          recoverable: false,
        });
      }

      this.eventEmitter.emit(EventName.UPLOAD_COMPLETE, {
        file: fileInfo,
        ...(result.success
          ? { result, completeTime: Date.now(), duration: task.getTimeElapsed() }
          : { error: result.error || new Error('上传失败'), recoverable: false }),
      });

      // 执行afterUpload钩子
      await this.executeHook('afterUpload', result);

      return result;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));

      // 触发错误事件
      this.eventEmitter.emit(EventName.UPLOAD_ERROR, {
        file: fileInfo,
        error: errorObj,
        recoverable: false,
      });

      // 记录错误日志
      this.logger?.error('core', `上传失败: ${errorObj.message}`, { fileId: fileInfo.id, error });

      // 返回错误结果
      return {
        success: false,
        file: fileInfo,
        error: errorObj,
      };
    }
  }

  /**
   * 上传多个文件
   * @param files 要上传的文件数组
   * @param options 上传选项
   * @returns 上传结果数组Promise
   */
  public async uploadMultiple(
    files: Array<File | Blob>,
    options?: Partial<IUploadConfig>,
  ): Promise<IUploadResult[]> {
    const results: IUploadResult[] = [];

    // 触发多文件添加事件
    const fileInfos = files.map(file => ({
      id: generateFileId(file),
      name: 'name' in file ? file.name : `blob-${Date.now()}`,
      size: file.size,
      type: file.type,
      lastModified: 'lastModified' in file ? file.lastModified : Date.now(),
    }));

    this.eventEmitter.emit(EventName.FILES_ADDED, { files: fileInfos });

    // 顺序上传每个文件
    for (const file of files) {
      const result = await this.upload(file, options);
      results.push(result);
    }

    return results;
  }

  /**
   * 以Observable方式上传文件
   * @param file 要上传的文件
   * @param options 上传选项
   * @returns Observable对象，用于订阅上传进度和结果
   */
  public uploadObservable(file: File | Blob, options?: Partial<IUploadConfig>): any {
    // 创建一个简单的Observable实现
    return {
      subscribe: (observer: {
        next?: (progress: number) => void;
        error?: (error: Error) => void;
        complete?: () => void;
      }) => {
        const fileId = generateFileId(file);

        // 监听进度
        const progressHandler = (data: { progress: IUploadProgress }) => {
          if (observer.next) {
            observer.next(data.progress.percent);
          }
        };

        // 监听成功
        const successHandler = () => {
          if (observer.complete) {
            observer.complete();
          }
        };

        // 监听错误
        const errorHandler = (data: { error: Error }) => {
          if (observer.error) {
            observer.error(data.error);
          }
        };

        // 添加事件监听
        this.eventEmitter.on(`${EventName.UPLOAD_PROGRESS}:${fileId}`, progressHandler as any);
        this.eventEmitter.on(`${EventName.UPLOAD_SUCCESS}:${fileId}`, successHandler);
        this.eventEmitter.on(`${EventName.UPLOAD_ERROR}:${fileId}`, errorHandler as any);

        // 开始上传
        this.upload(file, options).catch(error => {
          if (observer.error) {
            observer.error(error);
          }
        });

        // 返回取消订阅方法
        return {
          unsubscribe: () => {
            this.eventEmitter.off(`${EventName.UPLOAD_PROGRESS}:${fileId}`, progressHandler as any);
            this.eventEmitter.off(`${EventName.UPLOAD_SUCCESS}:${fileId}`, successHandler);
            this.eventEmitter.off(`${EventName.UPLOAD_ERROR}:${fileId}`, errorHandler as any);
            this.cancel(fileId);
          },
        };
      },
    };
  }

  /**
   * 暂停上传
   * @param fileId 文件ID，不提供则暂停所有上传
   */
  public pause(fileId?: string): void {
    if (fileId) {
      const task = this.tasks.get(fileId);
      if (task) {
        this.executeHook('beforePause')
          .then(() => {
            task.pause();
            this.eventEmitter.emit(EventName.UPLOAD_PAUSE, task.getFileInfo());
          })
          .catch(error => {
            this.logger?.error('core', `暂停上传失败: ${error.message}`, { fileId, error });
          });
      }
    } else {
      // 暂停所有任务
      this.executeHook('beforePause')
        .then(() => {
          for (const task of this.tasks.values()) {
            if (task.getStatus() === UploadStatus.UPLOADING) {
              task.pause();
              this.eventEmitter.emit(EventName.UPLOAD_PAUSE, task.getFileInfo());
            }
          }
        })
        .catch(error => {
          this.logger?.error('core', `暂停所有上传失败: ${error.message}`, { error });
        });
    }
  }

  /**
   * 恢复上传
   * @param fileId 文件ID，不提供则恢复所有暂停的上传
   */
  public resume(fileId?: string): void {
    if (fileId) {
      const task = this.tasks.get(fileId);
      if (task && task.getStatus() === UploadStatus.PAUSED) {
        this.executeHook('beforeResume')
          .then(() => {
            task.resume();
            this.eventEmitter.emit(EventName.UPLOAD_RESUME, task.getFileInfo());
          })
          .catch(error => {
            this.logger?.error('core', `恢复上传失败: ${error.message}`, { fileId, error });
          });
      }
    } else {
      // 恢复所有暂停的任务
      this.executeHook('beforeResume')
        .then(() => {
          for (const task of this.tasks.values()) {
            if (task.getStatus() === UploadStatus.PAUSED) {
              task.resume();
              this.eventEmitter.emit(EventName.UPLOAD_RESUME, task.getFileInfo());
            }
          }
        })
        .catch(error => {
          this.logger?.error('core', `恢复所有上传失败: ${error.message}`, { error });
        });
    }
  }

  /**
   * 取消上传
   * @param fileId 文件ID，不提供则取消所有上传
   */
  public cancel(fileId?: string): void {
    if (fileId) {
      const task = this.tasks.get(fileId);
      if (task) {
        this.executeHook('beforeCancel')
          .then(() => {
            task.cancel();
            this.eventEmitter.emit(EventName.UPLOAD_CANCEL, task.getFileInfo());
          })
          .catch(error => {
            this.logger?.error('core', `取消上传失败: ${error.message}`, { fileId, error });
          });
      }
    } else {
      // 取消所有任务
      this.executeHook('beforeCancel')
        .then(() => {
          for (const task of this.tasks.values()) {
            if (
              [UploadStatus.UPLOADING, UploadStatus.PAUSED, UploadStatus.PENDING].includes(
                task.getStatus(),
              )
            ) {
              task.cancel();
              this.eventEmitter.emit(EventName.UPLOAD_CANCEL, task.getFileInfo());
            }
          }
        })
        .catch(error => {
          this.logger?.error('core', `取消所有上传失败: ${error.message}`, { error });
        });
    }
  }

  /**
   * 获取上传状态
   * @param fileId 文件ID
   * @returns 上传状态
   */
  public getStatus(fileId: string): string {
    const task = this.tasks.get(fileId);
    return task ? task.getStatus() : UploadStatus.PENDING;
  }

  /**
   * 获取上传进度
   * @param fileId 文件ID
   * @returns 上传进度（0-100）
   */
  public getProgress(fileId: string): number {
    const task = this.tasks.get(fileId);
    return task ? task.getProgress().percent : 0;
  }

  /**
   * 获取所有上传任务
   * @returns 上传任务数组
   */
  public getTasks(): IUploadTask[] {
    return Array.from(this.tasks.values()).map(task => task.getTaskInfo());
  }

  /**
   * 获取上传任务
   * @param fileId 文件ID
   * @returns 上传任务
   */
  public getTask(fileId: string): IUploadTask | undefined {
    const task = this.tasks.get(fileId);
    return task ? task.getTaskInfo() : undefined;
  }

  /**
   * 清除已完成任务
   */
  public clearCompletedTasks(): void {
    for (const [fileId, task] of this.tasks.entries()) {
      if (
        [UploadStatus.COMPLETED, UploadStatus.CANCELED, UploadStatus.FAILED].includes(
          task.getStatus(),
        )
      ) {
        this.tasks.delete(fileId);
      }
    }
  }

  /**
   * 使用插件
   * @param plugin 插件实例
   * @returns this 实例，用于链式调用
   */
  public use(plugin: IPlugin): this {
    this.pluginManager.register(plugin);
    return this;
  }

  /**
   * 添加事件监听器
   * @param eventName 事件名称
   * @param handler 事件处理函数
   * @param options 事件选项
   * @returns this 实例，用于链式调用
   */
  public on(eventName: string, handler: (data: any) => void, options?: any): this {
    this.eventEmitter.on(eventName, handler, options);
    return this;
  }

  /**
   * 添加一次性事件监听器
   * @param eventName 事件名称
   * @param handler 事件处理函数
   * @param options 事件选项
   * @returns this 实例，用于链式调用
   */
  public once(eventName: string, handler: (data: any) => void, options?: any): this {
    this.eventEmitter.once(eventName, handler, options);
    return this;
  }

  /**
   * 移除事件监听器
   * @param eventName 事件名称
   * @param handler 事件处理函数
   * @returns this 实例，用于链式调用
   */
  public off(eventName: string, handler?: (data: any) => void): this {
    this.eventEmitter.off(eventName, handler);
    return this;
  }

  /**
   * 设置配置
   * @param config 配置选项
   * @returns this 实例，用于链式调用
   */
  public setConfig(config: Partial<IUploadConfig>): this {
    this.config = {
      ...this.config,
      ...config,
    };
    return this;
  }

  /**
   * 注册钩子
   * @param hookName 钩子名称
   * @param handler 钩子处理函数
   */
  public registerHook(hookName: string, handler: (...args: any[]) => any): void {
    // 使用插件系统注册钩子
    const hookPlugin: IPlugin = {
      name: `hook:${hookName}`,
      version: '1.0.0',
      install: () => {},
      hooks: {
        [hookName]: handler,
      },
    };

    this.pluginManager.register(hookPlugin);
  }

  /**
   * 移除钩子
   * @param hookName 钩子名称
   * @param _handler 钩子处理函数
   */
  public removeHook(hookName: string, _handler?: (...args: any[]) => any): void {
    // 在实际实现中，应该在插件管理器中提供移除特定钩子的方法
    // 此处简化处理，直接卸载相关插件
    this.pluginManager.unregister(`hook:${hookName}`);
  }

  /**
   * 执行钩子
   * @param hookName 钩子名称
   * @param args 参数列表
   * @returns 钩子执行结果
   */
  public async executeHook(hookName: string, ...args: any[]): Promise<any> {
    // 使用插件管理器调用钩子
    try {
      return await this.pluginManager.invokeHook(hookName as any, args[0], ...args.slice(1));
    } catch (error) {
      this.logger?.error('core', `执行钩子 ${hookName} 失败`, { error, args });
      throw error;
    }
  }

  /**
   * 清理资源
   */
  public async cleanup(): Promise<void> {
    // 取消所有上传
    this.cancel();

    // 触发销毁事件
    this.eventEmitter.emit(EventName.UPLOADER_DESTROYED, { timestamp: Date.now() });

    // 卸载所有插件
    for (const plugin of this.pluginManager.getPlugins()) {
      this.pluginManager.unregister(plugin.name);
    }

    // 移除所有事件监听
    this.eventEmitter.removeAllListeners();

    // 清空任务列表
    this.tasks.clear();

    // 记录日志
    this.logger?.info('core', '文件上传器已销毁');
  }
}
