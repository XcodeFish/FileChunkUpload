/**
 * 开发者模式类型定义
 */
/**
 * 日志级别枚举
 */
export declare enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}
/**
 * 日志类别
 */
export type LogCategory =
  | 'core'
  | 'event'
  | 'plugin'
  | 'network'
  | 'storage'
  | 'upload'
  | 'chunk'
  | 'resume'
  | 'performance'
  | string;
/**
 * 日志格式化器
 */
export type LogFormatter = (
  level: LogLevel,
  category: LogCategory,
  message: string,
  data?: any,
  timestamp?: number,
) => string;
/**
 * 日志输出目标
 */
export type LogOutputTarget = (formattedLog: string, rawLogData: ILogData) => void;
/**
 * 日志数据接口
 */
export interface ILogData {
  level: LogLevel;
  category: LogCategory;
  message: string;
  data?: any;
  timestamp: number;
}
/**
 * 日志配置接口
 */
export interface ILoggerConfig {
  level: LogLevel;
  formatter?: LogFormatter;
  outputs?: LogOutputTarget[];
  enabledCategories?: LogCategory[] | true;
  timestampFormat?: string;
  colorize?: boolean;
}
/**
 * 插件轨迹事件
 */
export interface IPluginTraceEvent {
  pluginId: string;
  hookName: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  error?: Error;
  data?: any;
}
/**
 * 插件跟踪器配置
 */
export interface IPluginTracerConfig {
  enabled: boolean;
  traceLimit?: number;
  logHookEvents?: boolean;
  performanceThreshold?: number;
}
/**
 * 开发者模式配置接口
 */
export interface IDeveloperModeConfig {
  enabled: boolean;
  logger?: ILoggerConfig;
  pluginTracer?: IPluginTracerConfig;
  consoleApiEnabled?: boolean;
  performanceTracking?: {
    enabled: boolean;
    sampleRate: number;
    trackMemory: boolean;
  };
  breakOnError?: boolean;
}
//# sourceMappingURL=types.d.ts.map
