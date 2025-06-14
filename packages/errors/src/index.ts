/**
 * @file-chunk-uploader/errors 入口文件
 * 导出错误处理模块的公共API
 * @packageDocumentation
 */

import { createErrorHandler, ErrorHandlerConfig } from './error-handler';

// 导出错误类型
export * from './error-types';

// 导出错误处理器
export * from './error-handler';

// 导出错误恢复机制
export * from './recovery';

// 导出插件
export { ErrorPlugin } from './plugin';

// 导出函数
export { createErrorHandler };

// 导出类型
export type { ErrorHandlerConfig };
