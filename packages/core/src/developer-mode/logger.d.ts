/**
 * Logger类实现
 * 支持多级别日志和分类的可配置日志系统
 */
import { ILogData, ILoggerConfig, LogCategory, LogLevel, LogOutputTarget } from './types';
/**
 * Logger类 - 支持多级别日志和分类
 */
export declare class Logger {
  private config;
  private logHistory;
  private historyLimit;
  /**
   * 创建Logger实例
   */
  constructor(config?: Partial<ILoggerConfig>);
  /**
   * 配置日志记录器
   */
  configure(config: Partial<ILoggerConfig>): void;
  /**
   * 判断分类是否启用
   */
  private isCategoryEnabled;
  /**
   * 记录日志
   */
  private log;
  /**
   * 日志级别方法
   */
  debug(category: LogCategory, message: string, data?: any): void;
  info(category: LogCategory, message: string, data?: any): void;
  warn(category: LogCategory, message: string, data?: any): void;
  error(category: LogCategory, message: string, data?: any): void;
  /**
   * 获取日志历史
   */
  getHistory(): ILogData[];
  /**
   * 按条件筛选日志
   */
  filterLogs(options: {
    level?: LogLevel;
    category?: LogCategory;
    fromTime?: number;
    toTime?: number;
    search?: string;
  }): ILogData[];
  /**
   * 清除日志历史
   */
  clearHistory(): void;
  /**
   * 设置历史记录上限
   */
  setHistoryLimit(limit: number): void;
  /**
   * 添加自定义输出目标
   */
  addOutputTarget(target: LogOutputTarget): void;
  /**
   * 移除输出目标
   */
  removeOutputTarget(target: LogOutputTarget): void;
}
//# sourceMappingURL=logger.d.ts.map
