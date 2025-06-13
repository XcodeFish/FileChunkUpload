/**
 * 格式化工具
 * 提供文件大小和时间格式化功能
 * @module utils/format
 */

/**
 * 格式化文件大小
 * @param bytes 字节数
 * @param decimals 小数位数
 * @returns 格式化后的文件大小字符串
 */
export function formatFileSize(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * 格式化时间
 * @param seconds 秒数
 * @returns 格式化后的时间字符串
 */
export function formatTime(seconds: number): string {
  if (seconds < 0) return '--:--:--';

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
}

/**
 * 格式化工具类
 * 提供各种格式化功能
 */
export class Formatter {
  /**
   * 格式化文件大小
   * @param bytes 字节数
   * @param decimals 小数位数
   * @returns 格式化后的文件大小字符串
   */
  public formatFileSize(bytes: number, decimals: number = 2): string {
    return formatFileSize(bytes, decimals);
  }

  /**
   * 格式化时间
   * @param seconds 秒数
   * @returns 格式化后的时间字符串
   */
  public formatTime(seconds: number): string {
    return formatTime(seconds);
  }
}
