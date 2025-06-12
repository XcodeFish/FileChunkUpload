/**
 * 插件系统类型定义
 * 包含插件接口和生命周期钩子
 * @packageDocumentation
 */
import { IUploadResult } from './base';
import { IUploadConfig } from './config';
import { IFileUploaderCore } from './uploader';

/**
 * 插件生命周期钩子接口
 * 定义插件可以实现的所有生命周期钩子
 */
export interface IPluginLifecycle {
  /** 初始化钩子，在插件注册时调用 */
  init?: (uploader: IFileUploaderCore) => void | Promise<void>;
  /** 上传前钩子，可以修改文件或取消上传 */
  beforeUpload?: (file: File, config: IUploadConfig) => File | Promise<File>;
  /** 分片上传前钩子，可以修改分片内容 */
  beforeChunkUpload?: (chunk: Blob, index: number, total: number) => Blob | Promise<Blob>;
  /** 分片上传后钩子，处理分片上传完成后的逻辑 */
  afterChunkUpload?: (
    response: Record<string, unknown>,
    chunk: Blob,
    index: number,
  ) => void | Promise<void>;
  /** 上传后钩子，处理整个文件上传完成后的逻辑 */
  afterUpload?: (result: IUploadResult) => void | Promise<void>;
  /** 错误处理钩子，返回true表示错误已处理 */
  onError?: (error: Error) => boolean | Promise<boolean>;
  /** 暂停钩子，在上传暂停时调用 */
  onPause?: () => void | Promise<void>;
  /** 恢复钩子，在上传恢复时调用 */
  onResume?: () => void | Promise<void>;
  /** 取消钩子，在上传取消时调用 */
  onCancel?: () => void | Promise<void>;
  /** 进度钩子，在上传进度更新时调用 */
  onProgress?: (progress: number) => void | Promise<void>;
  /** 重试开始钩子，在开始重试上传时调用 */
  onRetryStart?: (retryInfo: IRetryStartInfo) => void | Promise<void>;
  /** 重试成功钩子，在重试上传成功时调用 */
  onRetrySuccess?: (retryInfo: IRetrySuccessInfo) => void | Promise<void>;
  /** 重试失败钩子，在重试上传失败时调用 */
  onRetryFailed?: (retryInfo: IRetryFailedInfo) => void | Promise<void>;
  /** 清理钩子，在插件卸载时调用 */
  cleanup?: () => void | Promise<void>;
}

/**
 * 插件钩子函数类型
 * 表示任意插件钩子函数的类型
 */
export type PluginHookFunction = (...args: unknown[]) => unknown;

/**
 * 插件接口
 * 定义插件的基本结构
 */
export interface IPlugin {
  /** 插件名称 */
  name: string;
  /** 插件版本 */
  version: string;
  /** API版本要求 */
  apiVersion?: string;
  /** 安装方法 */
  install: (uploader: IFileUploaderCore, options?: Record<string, unknown>) => void;
  /** 生命周期钩子 */
  lifecycle?: IPluginLifecycle;
  /** 钩子对象，与lifecycle等效 */
  hooks?: Record<string, PluginHookFunction>;
  /** 清理方法 */
  cleanup?: () => void;
}

/**
 * 插件选项接口
 * 表示插件初始化时的配置选项
 */
export interface IPluginOptions {
  /** 自定义选项 */
  [key: string]: unknown;
}

/**
 * 插件管理器接口
 * 负责管理插件的注册、卸载和调用
 */
export interface IPluginManager {
  /** 注册插件 */
  register(plugin: IPlugin): void;
  /** 注销插件 */
  unregister(pluginName: string): boolean;
  /** 调用钩子 */
  invokeHook<T>(hookName: keyof IPluginLifecycle, initialValue: T, ...args: unknown[]): Promise<T>;
  /** 检查插件兼容性 */
  checkCompatibility(plugin: IPlugin): boolean;
  /** 获取已注册插件 */
  getPlugins(): Map<string, IPlugin>;
  /** 获取插件 */
  getPlugin(name: string): IPlugin | undefined;
  /** 是否已注册插件 */
  hasPlugin(name: string): boolean;
}

/**
 * 重试开始信息接口
 * 包含重试开始时的相关信息
 */
export interface IRetryStartInfo {
  /** 文件ID */
  fileId: string;
  /** 分片索引 */
  chunkIndex?: number;
  /** 重试次数 */
  retryCount: number;
  /** 延迟时间（毫秒） */
  delay: number;
  /** 错误对象 */
  error: Error;
}

/**
 * 重试成功信息接口
 * 包含重试成功时的相关信息
 */
export interface IRetrySuccessInfo {
  /** 文件ID */
  fileId: string;
  /** 分片索引 */
  chunkIndex?: number;
  /** 成功次数 */
  successCount: number;
}

/**
 * 重试失败信息接口
 * 包含重试失败时的相关信息
 */
export interface IRetryFailedInfo {
  /** 文件ID */
  fileId: string;
  /** 错误对象 */
  error: Error;
  /** 是否可恢复 */
  recoverable: boolean;
}
