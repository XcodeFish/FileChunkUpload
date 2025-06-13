/**
 * 格式化工具模块
 * @module utils/format
 */
export * from './formatter';

/**
 * 格式化和转换工具函数集
 */

/**
 * 格式化文件大小
 * @param bytes 字节数
 * @param decimals 小数位数
 * @returns 格式化后的文件大小字符串
 */
export function formatFileSize(bytes: number, decimals = 2): string {
  if (bytes === 0) {
    return '0 Bytes';
  }

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

/**
 * 格式化日期
 * @param date 日期对象或时间戳
 * @param format 格式字符串
 * @returns 格式化后的日期字符串
 */
export function formatDate(date: Date | number | string, format = 'YYYY-MM-DD HH:mm:ss'): string {
  const d = new Date(date);

  if (isNaN(d.getTime())) {
    return 'Invalid Date';
  }

  const replacements: Record<string, () => string> = {
    YYYY: () => d.getFullYear().toString(),
    MM: () => padZero(d.getMonth() + 1),
    DD: () => padZero(d.getDate()),
    HH: () => padZero(d.getHours()),
    mm: () => padZero(d.getMinutes()),
    ss: () => padZero(d.getSeconds()),
    SSS: () => padZero(d.getMilliseconds(), 3),
  };

  let result = format;

  Object.keys(replacements).forEach(key => {
    result = result.replace(new RegExp(key, 'g'), replacements[key]());
  });

  return result;
}

/**
 * 格式化持续时间（毫秒转为人类可读形式）
 * @param ms 毫秒数
 * @param compact 是否使用简短格式
 * @returns 格式化后的持续时间
 */
export function formatDuration(ms: number, compact = false): string {
  if (ms <= 0) {
    return '0s';
  }

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  const remainingSeconds = seconds % 60;
  const remainingMinutes = minutes % 60;

  if (compact) {
    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  } else {
    const parts = [];
    const hasHours = hours > 0;
    const hasMinutes = remainingMinutes > 0;
    const hasSeconds = remainingSeconds > 0;
    const isEmpty = !hasHours && !hasMinutes && !hasSeconds;

    if (hasHours) {
      parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
    }

    if (hasMinutes || (hasHours && !hasSeconds)) {
      parts.push(`${remainingMinutes} ${remainingMinutes === 1 ? 'minute' : 'minutes'}`);
    }

    if (hasSeconds || isEmpty) {
      parts.push(`${remainingSeconds} ${remainingSeconds === 1 ? 'second' : 'seconds'}`);
    }

    return parts.join(' ');
  }
}

/**
 * 格式化百分比
 * @param value 值
 * @param total 总数
 * @param decimals 小数位数
 * @returns 格式化后的百分比字符串
 */
export function formatPercent(value: number, total: number, decimals = 0): string {
  if (total === 0) {
    return '0%';
  }

  const percent = (value / total) * 100;
  return percent.toFixed(decimals) + '%';
}

/**
 * 转换URL参数为对象
 * @param url URL字符串
 * @returns 解析后的参数对象
 */
export function parseUrlParams(url: string): Record<string, string> {
  const params: Record<string, string> = {};

  try {
    const urlObj = new URL(url);
    urlObj.searchParams.forEach((value, key) => {
      params[key] = value;
    });
  } catch (e) {
    // 如果不是有效URL，尝试直接解析查询字符串
    const queryString = url.split('?')[1] || '';
    if (queryString) {
      const pairs = queryString.split('&');

      pairs.forEach(pair => {
        const [key, value] = pair.split('=');
        if (key) {
          params[decodeURIComponent(key)] = decodeURIComponent(value || '');
        }
      });
    }
  }

  return params;
}

/**
 * 转换对象为URL参数字符串
 * @param params 参数对象
 * @returns URL查询字符串
 */
export function stringifyUrlParams(params: Record<string, string | number | boolean>): string {
  return Object.keys(params)
    .map(key => {
      const value = params[key];
      return `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`;
    })
    .join('&');
}

/**
 * 将数组转换为CSV格式字符串
 * @param data 数据数组
 * @param columns 列名数组
 * @returns CSV字符串
 */
export function arrayToCSV(
  data: Record<string, any>[],
  columns: Array<{ key: string; title: string }>,
): string {
  const header = columns.map(column => column.title).join(',');

  const rows = data.map(item => {
    return columns
      .map(column => {
        const value = item[column.key];
        // 处理包含逗号的值
        const cellValue = value !== null && value !== undefined ? String(value) : '';
        return cellValue.includes(',') ? `"${cellValue}"` : cellValue;
      })
      .join(',');
  });

  return [header, ...rows].join('\n');
}

/**
 * 数字补零
 * @param num 数字
 * @param length 补零后的长度
 * @returns 补零后的字符串
 */
function padZero(num: number, length = 2): string {
  return num.toString().padStart(length, '0');
}

/**
 * 将蛇形命名转换为驼峰命名
 * @param str 蛇形命名字符串
 * @returns 驼峰命名字符串
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * 将驼峰命名转换为蛇形命名
 * @param str 驼峰命名字符串
 * @returns 蛇形命名字符串
 */
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * 转换对象的键命名风格（递归）
 * @param obj 对象
 * @param keyTransformer 键转换函数
 * @returns 转换后的对象
 */
export function transformObjectKeys<T extends Record<string, any>>(
  obj: T,
  keyTransformer: (key: string) => string,
): Record<string, any> {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => transformObjectKeys(item, keyTransformer));
  }

  return Object.keys(obj).reduce(
    (result, key) => {
      const transformedKey = keyTransformer(key);
      const value = obj[key];

      result[transformedKey] =
        typeof value === 'object' && value !== null
          ? transformObjectKeys(value, keyTransformer)
          : value;

      return result;
    },
    {} as Record<string, any>,
  );
}
