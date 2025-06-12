// 导出核心模块
export * from './core';

// 导出策略模块
export * from './strategies';

// 导出适配器
export * from './adapters';

// 导出开发者模式
import devMode, { DeveloperMode, Logger, PluginTracer } from './developer-mode';
export { DeveloperMode, Logger, PluginTracer, devMode as developerMode };

// 导出插件系统，只导出我们确实需要的内容，避免与types包中的类型冲突
export {
  PluginManager,
  PluginPriority,
  PluginStateEnum,
  PluginDependencyManager,
  PluginLifecycleManager,
  PluginHealthMonitor,
  PluginHealthStatus,
  parseSemVer,
  compareSemVer,
  isVersionCompatible,
  detectPluginConflict,
  getPluginApiRequirement,
  analyzePluginRelationships,
  createLoggerPlugin,
  createAnalyticsPlugin,
} from './plugins';

// 导出插件系统类型（使用别名）
export type {
  HookExecutionModeType,
  HookResultMergeStrategy,
  IPluginPerformanceData,
  IPluginHealth,
} from './plugins';

// 重新导出类型定义（从types包）
export * from '@file-chunk-uploader/types';

// 重新导出常用工具函数（从utils包）
export { generateFileId, calculateSpeed } from '@file-chunk-uploader/utils';

// 版本信息
export const VERSION = '1.0.0';
