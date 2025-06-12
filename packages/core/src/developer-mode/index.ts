/**
 * 开发者模式模块
 * 提供日志记录、插件调用链跟踪和开发工具API
 */

// 导出类型定义
export * from './types';

// 导出核心类
export { Logger } from './logger';
export { PluginTracer } from './plugin-tracer';
export { DeveloperMode } from './developer-mode';

// 创建并导出单例实例
import { DeveloperMode } from './developer-mode';

// 导出单例实例
const devMode = DeveloperMode.getInstance();

export default devMode;
