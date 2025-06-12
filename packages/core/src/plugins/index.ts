/**
 * 插件系统
 * 提供插件管理和生命周期钩子调用功能
 * @packageDocumentation
 */

// 导出插件管理器，显式重命名导出以避免与types包中的类型冲突
export { PluginManager, PluginPriority } from './plugin-manager';
// 显式重命名PluginState以避免与types包冲突
export { PluginState as PluginStateEnum } from './plugin-manager';

// 导出插件依赖管理器
export { PluginDependencyManager } from './plugin-dependency-manager';

// 导出插件生命周期管理器
export { PluginLifecycleManager } from './plugin-lifecycle';
// 显式重命名HookExecutionMode类型以避免与types包冲突
export type { HookResultMergeStrategy } from './plugin-lifecycle';
export type { HookExecutionMode as HookExecutionModeType } from './plugin-lifecycle';
// 导出超时配置类型
export type { HookTimeoutConfig } from './plugin-lifecycle';

// 导出插件健康监控
export { PluginHealthMonitor, PluginHealthStatus } from './plugin-health';
export type { IPluginPerformanceData, IPluginHealth } from './plugin-health';

// 导出插件工具函数
export {
  parseSemVer,
  compareSemVer,
  isVersionCompatible,
  detectPluginConflict,
  getPluginApiRequirement,
  analyzePluginRelationships,
} from './plugin-utils';

// 导出插件冲突解决器
export { PluginConflictResolver, ConflictResolutionStrategy } from './plugin-conflict-resolver';
export type { PluginConflict } from './plugin-conflict-resolver';

// 导出插件调用链可视化
export { PluginTraceVisualizer } from './plugin-trace-visualizer';
export type {
  HookCallRecord,
  PluginTraceSession,
  TraceQueryOptions,
} from './plugin-trace-visualizer';

// 导出示例插件
export { createLoggerPlugin, createAnalyticsPlugin } from './example-plugin';
