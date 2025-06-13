/**
 * 网络模块日志分类
 * 提供网络模块的所有日志分类常量
 */

/**
 * 网络适配器日志分类
 */
export const NETWORK_ADAPTER_LOG_CATEGORY = 'network:adapter';

/**
 * 拦截器日志分类
 */
export const NETWORK_INTERCEPTOR_LOG_CATEGORY = 'network:interceptor';

/**
 * HTTP请求日志分类
 */
export const NETWORK_HTTP_REQUEST_LOG_CATEGORY = 'network:http:request';

/**
 * HTTP响应日志分类
 */
export const NETWORK_HTTP_RESPONSE_LOG_CATEGORY = 'network:http:response';

/**
 * 错误处理日志分类
 */
export const NETWORK_ERROR_LOG_CATEGORY = 'network:error';

/**
 * 重试机制日志分类
 */
export const NETWORK_RETRY_LOG_CATEGORY = 'network:retry';

/**
 * 网络检测日志分类
 */
export const NETWORK_DETECTOR_LOG_CATEGORY = 'network:detector';

/**
 * 自适应网络日志分类
 */
export const NETWORK_ADAPTIVE_LOG_CATEGORY = 'network:adaptive';

/**
 * 获取指定请求标识的日志分类
 * @param requestId 请求标识
 * @returns 带请求标识的日志分类
 */
export function getRequestLogCategory(requestId: string): string {
  return `${NETWORK_HTTP_REQUEST_LOG_CATEGORY}:${requestId}`;
}
