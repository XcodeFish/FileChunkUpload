/**
 * StorageLogger - 存储模块的日志记录功能
 *
 * 提供了与core包的Logger集成的日志记录功能，
 * 同时支持降级处理（当core包的Logger不可用时使用控制台）
 */

// 导入类型，但不强制依赖core包实现
import type { Logger } from '@file-chunk-uploader/core/src/developer-mode/logger';

/**
 * 存储操作类型
 */
export enum StorageOperation {
  SAVE = 'save',
  GET = 'get',
  DELETE = 'delete',
  LIST = 'list',
  CLEAR = 'clear',
  INIT = 'init',
  CLEANUP = 'cleanup',
  USE = 'use',
}

/**
 * 存储日志记录器
 */
export class StorageLogger {
  private logger: Logger | null = null;
  private enabled: boolean = false;
  private debugEnabled: boolean = false;

  /**
   * 创建存储日志记录器
   */
  constructor(logger?: Logger, options: { enabled?: boolean; debug?: boolean } = {}) {
    this.logger = logger || null;
    this.enabled = options.enabled !== undefined ? options.enabled : true;
    this.debugEnabled = options.debug || false;
  }

  /**
   * 记录调试信息
   */
  debug(message: string, data?: any): void {
    if (!this.enabled || !this.debugEnabled) return;

    if (this.logger) {
      this.logger.debug('storage', message, data);
    } else {
      console.debug(`[STORAGE] ${message}`, data || '');
    }
  }

  /**
   * 记录信息
   */
  info(message: string, data?: any): void {
    if (!this.enabled) return;

    if (this.logger) {
      this.logger.info('storage', message, data);
    } else {
      console.info(`[STORAGE] ${message}`, data || '');
    }
  }

  /**
   * 记录警告
   */
  warn(message: string, data?: any): void {
    if (!this.enabled) return;

    if (this.logger) {
      this.logger.warn('storage', message, data);
    } else {
      console.warn(`[STORAGE] ${message}`, data || '');
    }
  }

  /**
   * 记录错误
   */
  error(message: string, data?: any): void {
    if (!this.enabled) return;

    if (this.logger) {
      this.logger.error('storage', message, data);
    } else {
      console.error(`[STORAGE] ${message}`, data || '');
    }
  }

  /**
   * 记录存储操作
   */
  logOperation(
    operation: StorageOperation,
    key: string,
    details?: { success: boolean; duration?: number; error?: Error; size?: number },
  ): void {
    if (!this.enabled) return;

    const baseMessage = `${this.getOperationName(operation)}: ${key}`;

    if (!details) {
      this.debug(baseMessage);
      return;
    }

    // 深度验证details参数
    if (typeof details !== 'object') {
      this.debug(`${baseMessage} - 参数错误: details不是对象`);
      return;
    }

    if (typeof details.success !== 'boolean') {
      this.debug(`${baseMessage} - 参数错误: details.success不是布尔值`);
      return;
    }

    const { success, duration, error, size } = details;

    if (success) {
      // 成功的操作
      const message = `${baseMessage} - 成功${duration ? ` (${duration.toFixed(2)}ms)` : ''}${
        size ? ` [${this.formatSize(size)}]` : ''
      }`;

      this.debug(message);
    } else {
      // 失败的操作
      const message = `${baseMessage} - 失败${duration ? ` (${duration.toFixed(2)}ms)` : ''}`;

      this.error(message, { error });
    }
  }

  /**
   * 获取操作名称
   */
  private getOperationName(operation: StorageOperation): string {
    switch (operation) {
      case StorageOperation.SAVE:
        return '保存数据';
      case StorageOperation.GET:
        return '获取数据';
      case StorageOperation.DELETE:
        return '删除数据';
      case StorageOperation.LIST:
        return '列出键';
      case StorageOperation.CLEAR:
        return '清空存储';
      case StorageOperation.INIT:
        return '初始化存储';
      case StorageOperation.CLEANUP:
        return '清理过期数据';
      case StorageOperation.USE:
        return '使用存储';
      default:
        return '未知操作';
    }
  }

  /**
   * 格式化大小
   */
  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
  }

  /**
   * 设置日志记录器
   */
  setLogger(logger: Logger): void {
    this.logger = logger;
  }

  /**
   * 启用或禁用日志记录
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * 启用或禁用调试日志
   */
  setDebug(debug: boolean): void {
    this.debugEnabled = debug;
  }
}
