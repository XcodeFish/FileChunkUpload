/**
 * URL工具函数
 * 提供URL相关的工具函数
 */

/**
 * 构建完整URL
 * 将URL和查询参数组合成完整URL
 *
 * @param url 基础URL
 * @param params 查询参数
 * @returns 完整URL
 */
export function buildUrl(url: string, params?: Record<string, string>): string {
  if (!params) {
    return url;
  }

  const queryString = Object.entries(params)
    .filter(([_, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

  return queryString ? `${url}${url.includes('?') ? '&' : '?'}${queryString}` : url;
}

/**
 * 规范化URL
 * 确保URL格式正确
 *
 * @param url URL字符串
 * @returns 规范化的URL
 */
export function normalizeUrl(url: string): string {
  if (!url) {
    return '';
  }

  // 移除URL末尾的斜杠
  return url.replace(/\/$/, '');
}

/**
 * 合并URL
 * 将基础URL和路径合并成一个完整URL
 *
 * @param baseUrl 基础URL
 * @param path 路径
 * @returns 合并后的URL
 */
export function joinUrl(baseUrl: string, path: string): string {
  if (!baseUrl) {
    return path;
  }

  if (!path) {
    return baseUrl;
  }

  const normalizedBase = baseUrl.replace(/\/$/, '');
  const normalizedPath = path.replace(/^\//, '');

  return `${normalizedBase}/${normalizedPath}`;
}

/**
 * 解析URL参数
 * 从URL字符串中提取查询参数
 *
 * @param url URL字符串
 * @returns 查询参数对象
 */
export function parseUrlParams(url: string): Record<string, string> {
  const params: Record<string, string> = {};

  if (!url || !url.includes('?')) {
    return params;
  }

  const queryString = url.split('?')[1];
  if (!queryString) {
    return params;
  }

  const paramPairs = queryString.split('&');
  for (const pair of paramPairs) {
    const [key, value] = pair.split('=');
    if (key) {
      params[decodeURIComponent(key)] = value ? decodeURIComponent(value) : '';
    }
  }

  return params;
}
