/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 防抖函数 - 用于延迟执行频繁触发的函数
 * @param fn 需要防抖的函数
 * @param wait 等待时间(ms)
 * @param immediate 是否立即执行
 * @returns 防抖处理后的函数
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  wait = 300,
  immediate = false,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let result: ReturnType<T>;

  const debounced = function (this: any, ...args: Parameters<T>): void {
    if (timer) {
      clearTimeout(timer);
    }

    if (immediate) {
      // 如果是立即执行，则判断是否已经执行过
      const callNow = !timer;

      timer = setTimeout(() => {
        timer = null;
      }, wait);

      if (callNow) {
        result = fn.apply(this, args);
      }
    } else {
      timer = setTimeout(() => {
        fn.apply(this, args);
      }, wait);
    }

    return result;
  };

  // 添加取消功能
  debounced.cancel = function (): void {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return debounced;
}
