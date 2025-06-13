/**
 * 日志工具类
 * 提供统一的日志记录功能
 * @module utils/logger
 */
import { ILogger } from '@file-chunk-uploader/types';

/**
 * 日志工具类
 * 提供统一的日志记录接口，避免重复代码
 */
export class LoggerUtil {
  /**
   * 构造函数
   * @param logger 日志记录器
   * @param prefix 日志前缀
   */
  constructor(
    private readonly logger?: ILogger,
    private readonly prefix: string = '',
  ) {}

  /**
   * 记录调试级别日志
   * @param message 日志消息
   * @param data 附加数据
   */
  public debug(message: string, data?: any): void {
    if (this.logger?.debug) {
      const prefixedMessage = this.prefix ? `[${this.prefix}] ${message}` : message;
      this.logger.debug('debug', prefixedMessage, data);
    }
  }

  /**
   * 记录信息级别日志
   * @param message 日志消息
   * @param data 附加数据
   */
  public info(message: string, data?: any): void {
    if (this.logger?.info) {
      const prefixedMessage = this.prefix ? `[${this.prefix}] ${message}` : message;
      this.logger.info('info', prefixedMessage, data);
    }
  }

  /**
   * 记录警告级别日志
   * @param message 日志消息
   * @param data 附加数据
   */
  public warn(message: string, data?: any): void {
    if (this.logger?.warn) {
      const prefixedMessage = this.prefix ? `[${this.prefix}] ${message}` : message;
      this.logger.warn('warn', prefixedMessage, data);
    }
  }

  /**
   * 记录错误级别日志
   * @param message 日志消息
   * @param error 错误对象
   */
  public error(message: string, error: any): void {
    if (this.logger?.error) {
      const prefixedMessage = this.prefix ? `[${this.prefix}] ${message}` : message;
      this.logger.error('error', prefixedMessage, error);
    }
  }

  /**
   * 创建带有新前缀的日志工具实例
   * @param prefix 新的日志前缀
   * @returns 新的日志工具实例
   */
  public withPrefix(prefix: string): LoggerUtil {
    const newPrefix = this.prefix ? `${this.prefix}:${prefix}` : prefix;
    return new LoggerUtil(this.logger, newPrefix);
  }
}
