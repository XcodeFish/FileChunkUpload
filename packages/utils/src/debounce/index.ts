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
): (...args: Parameters<T>) => ReturnType<T> | undefined {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let result: ReturnType<T> | undefined;

  const debounced = function (this: any, ...args: Parameters<T>): ReturnType<T> | undefined {
    // 保存上下文
    const context = this;

    // 清除之前的定时器
    if (timer) {
      clearTimeout(timer);
    }

    if (immediate) {
      // 如果是立即执行，则判断是否已经执行过
      const callNow = !timer;

      // 设置定时器，在wait毫秒后将timer设为null
      timer = setTimeout(() => {
        timer = null;
      }, wait);

      // 如果需要立即执行，则执行函数
      if (callNow) {
        result = fn.apply(context, args);
      }
    } else {
      // 延迟执行
      timer = setTimeout(() => {
        fn.apply(context, args);
        // 非立即执行模式下，不返回结果
        result = undefined;
      }, wait);
    }

    // 始终返回相同类型的值（可能是undefined）
    return result;
  };

  // 添加取消功能
  debounced.cancel = function (): void {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    // 重置结果
    result = undefined;
  };

  return debounced;
}
