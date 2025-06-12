/**
 * Logger类实现
 * 支持多级别日志和分类的可配置日志系统
 */
import {
  ILogData,
  ILoggerConfig,
  LogCategory,
  LogFormatter,
  LogLevel,
  LogOutputTarget,
} from './types';

/**
 * 默认日志格式化器
 */
const defaultFormatter: LogFormatter = (
  level: LogLevel,
  category: LogCategory,
  message: string,
  data?: any,
  timestamp: number = Date.now(),
): string => {
  const levelNames = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'SILENT'];
  const time = new Date(timestamp).toISOString();
  const dataStr = data !== undefined ? `\nData: ${JSON.stringify(data, null, 2)}` : '';

  return `[${time}] [${levelNames[level]}] [${category}]: ${message}${dataStr}`;
};

/**
 * 控制台输出目标
 */
const consoleOutput: LogOutputTarget = (formattedLog: string, rawLogData: ILogData): void => {
  const { level } = rawLogData;

  switch (level) {
    case LogLevel.DEBUG:
      console.debug(formattedLog);
      break;
    case LogLevel.INFO:
      console.info(formattedLog);
      break;
    case LogLevel.WARN:
      console.warn(formattedLog);
      break;
    case LogLevel.ERROR:
      console.error(formattedLog);
      break;
    default:
      break;
  }
};

/**
 * 彩色化控制台输出
 */
const colorizedConsoleOutput: LogOutputTarget = (
  formattedLog: string,
  rawLogData: ILogData,
): void => {
  const { level } = rawLogData;
  const styles = [
    'color: #9E9E9E', // DEBUG - 灰色
    'color: #2196F3', // INFO - 蓝色
    'color: #FFC107', // WARN - 黄色
    'color: #F44336', // ERROR - 红色
    '', // SILENT
  ];

  switch (level) {
    case LogLevel.DEBUG:
      console.debug(`%c${formattedLog}`, styles[level]);
      break;
    case LogLevel.INFO:
      console.info(`%c${formattedLog}`, styles[level]);
      break;
    case LogLevel.WARN:
      console.warn(`%c${formattedLog}`, styles[level]);
      break;
    case LogLevel.ERROR:
      console.error(`%c${formattedLog}`, styles[level]);
      break;
    default:
      break;
  }
};

/**
 * Logger类 - 支持多级别日志和分类
 */
export class Logger {
  private config: ILoggerConfig;
  private logHistory: ILogData[] = [];
  private historyLimit: number = 1000; // 默认历史记录上限

  /**
   * 创建Logger实例
   */
  constructor(config?: Partial<ILoggerConfig>) {
    // 默认配置
    const defaultConfig: ILoggerConfig = {
      level: LogLevel.INFO,
      formatter: defaultFormatter,
      outputs: [consoleOutput],
      enabledCategories: true, // 所有类别
      colorize: true,
    };

    this.config = { ...defaultConfig, ...config };

    // 如果启用了彩色显示，替换输出方法
    if (this.config.colorize && typeof window !== 'undefined') {
      this.config.outputs = [colorizedConsoleOutput];
    }
  }

  /**
   * 配置日志记录器
   */
  configure(config: Partial<ILoggerConfig>): void {
    this.config = { ...this.config, ...config };

    // 更新彩色化设置
    if (this.config.colorize !== undefined && typeof window !== 'undefined') {
      this.config.outputs = [this.config.colorize ? colorizedConsoleOutput : consoleOutput];
    }
  }

  /**
   * 判断分类是否启用
   */
  private isCategoryEnabled(category: LogCategory): boolean {
    if (this.config.enabledCategories === true) {
      return true;
    }
    return (
      Array.isArray(this.config.enabledCategories) &&
      this.config.enabledCategories.includes(category)
    );
  }

  /**
   * 记录日志
   */
  private log(level: LogLevel, category: LogCategory, message: string, data?: any): void {
    // 检查日志级别和分类是否启用
    if (level < this.config.level || !this.isCategoryEnabled(category)) {
      return;
    }

    const timestamp = Date.now();
    const logData: ILogData = {
      level,
      category,
      message,
      data,
      timestamp,
    };

    // 保存到历史记录
    this.logHistory.push(logData);
    if (this.logHistory.length > this.historyLimit) {
      this.logHistory.shift();
    }

    // 使用格式化器
    const formatter = this.config.formatter || defaultFormatter;
    const formattedLog = formatter(level, category, message, data, timestamp);

    // 发送到所有输出目标
    if (this.config.outputs && this.config.outputs.length > 0) {
      this.config.outputs.forEach(output => {
        output(formattedLog, logData);
      });
    }
  }

  /**
   * 日志级别方法
   */
  debug(category: LogCategory, message: string, data?: any): void {
    this.log(LogLevel.DEBUG, category, message, data);
  }

  info(category: LogCategory, message: string, data?: any): void {
    this.log(LogLevel.INFO, category, message, data);
  }

  warn(category: LogCategory, message: string, data?: any): void {
    this.log(LogLevel.WARN, category, message, data);
  }

  error(category: LogCategory, message: string, data?: any): void {
    this.log(LogLevel.ERROR, category, message, data);
  }

  /**
   * 获取日志历史
   */
  getHistory(): ILogData[] {
    return [...this.logHistory];
  }

  /**
   * 按条件筛选日志
   */
  filterLogs(options: {
    level?: LogLevel;
    category?: LogCategory;
    fromTime?: number;
    toTime?: number;
    search?: string;
  }): ILogData[] {
    return this.logHistory.filter(log => {
      if (options.level !== undefined && log.level < options.level) {
        return false;
      }
      if (options.category !== undefined && log.category !== options.category) {
        return false;
      }
      if (options.fromTime !== undefined && log.timestamp < options.fromTime) {
        return false;
      }
      if (options.toTime !== undefined && log.timestamp > options.toTime) {
        return false;
      }
      if (
        options.search !== undefined &&
        !log.message.includes(options.search) &&
        !(log.data && JSON.stringify(log.data).includes(options.search))
      ) {
        return false;
      }
      return true;
    });
  }

  /**
   * 清除日志历史
   */
  clearHistory(): void {
    this.logHistory = [];
  }

  /**
   * 设置历史记录上限
   */
  setHistoryLimit(limit: number): void {
    this.historyLimit = limit;
    // 如果当前历史记录超出新上限，则截断
    if (this.logHistory.length > limit) {
      this.logHistory = this.logHistory.slice(-limit);
    }
  }

  /**
   * 添加自定义输出目标
   */
  addOutputTarget(target: LogOutputTarget): void {
    if (!this.config.outputs) {
      this.config.outputs = [];
    }
    this.config.outputs.push(target);
  }

  /**
   * 移除输出目标
   */
  removeOutputTarget(target: LogOutputTarget): void {
    if (this.config.outputs) {
      this.config.outputs = this.config.outputs.filter(t => t !== target);
    }
  }
}
