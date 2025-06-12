/**
 * 文件相关工具函数
 */

/**
 * 生成文件唯一标识
 * @param file 文件对象
 * @returns 文件唯一标识
 */
export function generateFileId(file: File | Blob): string {
  const name = 'name' in file ? file.name : `blob-${Date.now()}`;
  const size = file.size;
  const type = file.type;
  const lastModified = 'lastModified' in file ? file.lastModified : Date.now();

  return `${name}-${size}-${type}-${lastModified}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * 计算上传速度（字节/秒）
 * @param points 速度样本点数组
 * @returns 上传速度
 */
export function calculateSpeed(points: Array<{ time: number; bytes: number }>): number {
  if (points.length < 2) {
    return 0;
  }

  // 使用最近的两个点计算速度
  const recent = points.slice(-2);
  const timeDelta = recent[1].time - recent[0].time; // 毫秒
  const bytesDelta = recent[1].bytes - recent[0].bytes;

  if (timeDelta <= 0) {
    return 0;
  }

  // 字节/秒
  const speed = (bytesDelta / timeDelta) * 1000;
  return Math.max(0, speed);
}
