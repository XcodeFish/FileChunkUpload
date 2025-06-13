/**
 * 事件辅助工具
 * 提供事件发送和处理功能
 * @module utils/event
 */
import { IEventEmitter, IFileInfo, IUploadConfig, IUploadResult } from '@file-chunk-uploader/types';

/**
 * 事件辅助类
 * 提供统一的事件处理接口，简化事件发送和处理
 */
export class EventHelper {
  /**
   * 构造函数
   * @param eventEmitter 事件发射器
   * @param prefix 事件前缀
   */
  constructor(
    private readonly eventEmitter?: IEventEmitter,
    private readonly prefix: string = '',
  ) {}

  /**
   * 发送事件
   * @param eventName 事件名称
   * @param data 事件数据
   * @returns 是否成功发送或Promise
   */
  public emit<T>(eventName: string, data?: T): boolean | Promise<void> {
    if (!this.eventEmitter) {
      return false;
    }

    const prefixedEventName = this.prefix ? `${this.prefix}:${eventName}` : eventName;
    return this.eventEmitter.emit(prefixedEventName, data);
  }

  /**
   * 监听事件
   * @param eventName 事件名称
   * @param handler 事件处理函数
   * @returns 事件发射器实例，用于链式调用
   */
  public on<T>(eventName: string, handler: (data: T) => void): this {
    if (!this.eventEmitter) {
      return this;
    }

    const prefixedEventName = this.prefix ? `${this.prefix}:${eventName}` : eventName;
    this.eventEmitter.on(prefixedEventName, handler);
    return this;
  }

  /**
   * 监听一次性事件
   * @param eventName 事件名称
   * @param handler 事件处理函数
   * @returns 事件发射器实例，用于链式调用
   */
  public once<T>(eventName: string, handler: (data: T) => void): this {
    if (!this.eventEmitter) {
      return this;
    }

    const prefixedEventName = this.prefix ? `${this.prefix}:${eventName}` : eventName;
    this.eventEmitter.once(prefixedEventName, handler);
    return this;
  }

  /**
   * 取消事件监听
   * @param eventName 事件名称
   * @param handler 事件处理函数
   * @returns 事件发射器实例，用于链式调用
   */
  public off(eventName: string, handler?: any): this {
    if (!this.eventEmitter || !this.eventEmitter.off) {
      return this;
    }

    const prefixedEventName = this.prefix ? `${this.prefix}:${eventName}` : eventName;
    this.eventEmitter.off(prefixedEventName, handler);
    return this;
  }

  /**
   * 创建带有新前缀的事件辅助器实例
   * @param prefix 新的事件前缀
   * @returns 新的事件辅助器实例
   */
  public withPrefix(prefix: string): EventHelper {
    const newPrefix = this.prefix ? `${this.prefix}:${prefix}` : prefix;
    return new EventHelper(this.eventEmitter, newPrefix);
  }

  /**
   * 发送上传开始事件
   * @param file 文件对象
   * @param fileId 文件ID
   * @param config 上传配置
   */
  public emitUploadStartEvent(file: File, fileId: string, config: IUploadConfig): void {
    if (!this.eventEmitter) return;

    const fileInfo: IFileInfo = this.createFileInfo(file, fileId);

    this.emit('upload:start', {
      file: fileInfo,
      config,
    });
  }

  /**
   * 发送上传完成事件
   * @param file 文件对象
   * @param fileId 文件ID
   * @param result 上传结果
   * @param totalDuration 总耗时
   */
  public emitUploadCompleteEvent(
    file: File,
    fileId: string,
    result: IUploadResult,
    totalDuration: number,
  ): void {
    if (!this.eventEmitter) return;

    const fileInfo: IFileInfo = this.createFileInfo(file, fileId);

    this.emit('upload:complete', {
      file: fileInfo,
      result,
      totalTime: totalDuration,
    });
  }

  /**
   * 发送上传错误事件
   * @param file 文件对象
   * @param fileId 文件ID
   * @param error 错误对象
   */
  public emitUploadErrorEvent(file: File, fileId: string, error: any): void {
    if (!this.eventEmitter) return;

    const fileInfo: IFileInfo = this.createFileInfo(file, fileId);

    this.emit('upload:error', {
      file: fileInfo,
      error,
    });
  }

  /**
   * 发送上传暂停事件
   * @param file 文件对象
   * @param fileId 文件ID
   */
  public emitUploadPauseEvent(file: File, fileId: string): void {
    if (!this.eventEmitter) return;

    const fileInfo: IFileInfo = this.createFileInfo(file, fileId);

    this.emit('upload:pause', {
      file: fileInfo,
    });
  }

  /**
   * 发送上传恢复事件
   * @param file 文件对象
   * @param fileId 文件ID
   */
  public emitUploadResumeEvent(file: File, fileId: string): void {
    if (!this.eventEmitter) return;

    const fileInfo: IFileInfo = this.createFileInfo(file, fileId);

    this.emit('upload:resume', {
      file: fileInfo,
    });
  }

  /**
   * 发送上传取消事件
   * @param file 文件对象
   * @param fileId 文件ID
   */
  public emitUploadCancelEvent(file: File, fileId: string): void {
    if (!this.eventEmitter) return;

    const fileInfo: IFileInfo = this.createFileInfo(file, fileId);

    this.emit('upload:cancel', {
      file: fileInfo,
    });
  }

  /**
   * 创建文件信息对象
   * @param file 文件对象
   * @param fileId 文件ID
   * @returns 文件信息对象
   */
  private createFileInfo(file: File, fileId: string): IFileInfo {
    return {
      id: fileId,
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
    };
  }
}
