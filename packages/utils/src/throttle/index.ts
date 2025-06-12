/**
 * 节流函数 - 用于限制函数执行频率
 * @param fn 需要节流的函数
 * @param wait 等待时间(ms)
 * @param options 配置选项
 * @returns 节流处理后的函数
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  wait = 300,
  options: {
    leading?: boolean; // 是否在延迟开始前调用
    trailing?: boolean; // 是否在延迟结束后调用
  } = {},
): (...args: Parameters<T>) => ReturnType<T> | undefined {
  const { leading = true, trailing = true } = options;
  let lastArgs: Parameters<T> | null = null;
  let result: ReturnType<T>;
  let lastCallTime: number | null = null;
  let timerId: ReturnType<typeof setTimeout> | null = null;
  let lastContext: any = null;

  // 计算剩余等待时间
  function getRemainingWait(time: number): number {
    const now = Date.now();
    const timeSinceLastCall = now - time;
    return wait - timeSinceLastCall;
  }

  // 实际执行函数
  function invokeFunc(time: number): ReturnType<T> {
    const args = lastArgs!;
    const context = lastContext;

    lastArgs = null;
    lastContext = null;
    lastCallTime = time;

    return (result = fn.apply(context, args));
  }

  // 执行延迟调用
  function startTimer(pendingFunc: () => void, wait: number): ReturnType<typeof setTimeout> {
    return setTimeout(pendingFunc, wait);
  }

  // 延迟执行的函数
  function timerExpired(): void {
    const time = Date.now();

    // 检查是否需要在延迟结束后调用
    if (trailing && lastArgs) {
      invokeFunc(time);
    } else {
      lastArgs = null;
      lastContext = null;
    }

    timerId = null;
  }

  // 取消节流
  function cancel(): void {
    if (timerId !== null) {
      clearTimeout(timerId);
    }
    lastArgs = null;
    lastContext = null;
    lastCallTime = null;
    timerId = null;
  }

  // 立即执行
  function flush(): ReturnType<T> | undefined {
    return timerId === null ? undefined : trailingEdge(Date.now());
  }

  // 执行尾部调用
  function trailingEdge(time: number): ReturnType<T> | undefined {
    timerId = null;

    // 只有在有lastArgs的情况下才执行尾部调用
    if (trailing && lastArgs) {
      return invokeFunc(time);
    }

    lastArgs = null;
    lastContext = null;
    return undefined;
  }

  // 主函数
  function throttled(this: any, ...args: Parameters<T>): ReturnType<T> | undefined {
    const now = Date.now();
    const isInvoking = lastCallTime === null;

    // 保存当前上下文和参数
    lastArgs = args;
    lastContext = this;

    // 如果是第一次调用
    if (isInvoking) {
      if (leading) {
        return invokeFunc(now);
      }
      lastCallTime = now;
    }

    // 计算等待时间
    if (lastCallTime) {
      const remainingWait = getRemainingWait(lastCallTime);

      // 如果没有定时器，设置定时器
      if (!timerId) {
        timerId = startTimer(timerExpired, remainingWait);
      }
    }

    return result;
  }

  // 添加取消和立即执行方法
  throttled.cancel = cancel;
  throttled.flush = flush;

  return throttled;
}
