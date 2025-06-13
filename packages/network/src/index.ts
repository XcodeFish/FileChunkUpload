/**
 * @file-chunk-uploader/network
 * 提供网络请求适配器和网络状态监测功能
 *
 * 包括网络适配器、状态检测、自适应策略等
 * @packageDocumentation
 */

/**
 * 网络模块
 * 提供网络请求适配器、拦截器和重试功能
 */

// 导出网络检测器
export * from './detector';

// 导出网络适配器
export * from './adapters';

// 导出拦截器
export * from './interceptor';

// 导出重试功能
export * from './retry';

// 导出工具函数
export * from './utils';

// 导出网络插件
export * from './plugin';

// 导出自适应网络功能
// 使用命名空间导出避免与detector模块中的NetworkDetector命名冲突
import * as adaptive from './adaptive';
export { adaptive };
