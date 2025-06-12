/**
 * 通用工具函数集
 */

/**
 * 生成唯一ID
 * @param prefix ID前缀
 * @returns 唯一ID
 */
export function generateUniqueId(prefix = ''): string {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 8);

  return `${prefix}${timestamp}${randomStr}`;
}

/**
 * 延迟指定时间
 * @param ms 延迟时间（毫秒）
 * @returns Promise
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

/**
 * 安全解析JSON
 * @param str JSON字符串
 * @param fallback 解析失败时的返回值
 * @returns 解析结果
 */
export function safeJsonParse<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str) as T;
  } catch (e) {
    return fallback;
  }
}

/**
 * 安全转换为JSON字符串
 * @param value 要转换的值
 * @param fallback 转换失败时的返回值
 * @returns JSON字符串
 */
export function safeJsonStringify(value: unknown, fallback = ''): string {
  try {
    return JSON.stringify(value);
  } catch (e) {
    return fallback;
  }
}

/**
 * 重试函数
 * @param fn 要重试的函数
 * @param options 重试选项
 * @returns 函数执行结果
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    delay?: number;
    backoff?: boolean;
    backoffFactor?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {},
): Promise<T> {
  const {
    maxRetries = 3,
    delay: initialDelay = 300,
    backoff = true,
    backoffFactor = 2,
    onRetry,
  } = options;

  let lastError: Error;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (error) {
      attempt += 1;
      lastError = error as Error;

      if (attempt >= maxRetries) {
        break;
      }

      if (onRetry) {
        onRetry(attempt, lastError);
      }

      const delayTime = backoff
        ? initialDelay * Math.pow(backoffFactor, attempt - 1)
        : initialDelay;
      await delay(delayTime);
    }
  }

  throw lastError!;
}

/**
 * 函数缓存装饰器
 * @param fn 要缓存的函数
 * @param resolver 缓存键解析函数
 * @returns 缓存包装后的函数
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  resolver?: (...args: Parameters<T>) => string,
): {
  (...args: Parameters<T>): ReturnType<T>;
  cache: Map<string, ReturnType<T>>;
  clear: () => void;
} {
  const cache = new Map<string, ReturnType<T>>();

  const memoized = function (this: any, ...args: Parameters<T>): ReturnType<T> {
    const key = resolver ? resolver(...args) : JSON.stringify(args);

    if (cache.has(key)) {
      return cache.get(key)!;
    }

    const result = fn.apply(this, args);
    cache.set(key, result);

    return result;
  };

  memoized.cache = cache;
  memoized.clear = () => cache.clear();

  return memoized as {
    (...args: Parameters<T>): ReturnType<T>;
    cache: Map<string, ReturnType<T>>;
    clear: () => void;
  };
}

/**
 * 批量处理函数
 * @param items 要处理的项
 * @param fn 处理函数
 * @param options 批量处理选项
 * @returns 处理结果
 */
export async function batchProcess<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  options: {
    batchSize?: number;
    concurrency?: number;
    delay?: number;
    onBatchComplete?: (results: R[], batchIndex: number) => void;
  } = {},
): Promise<R[]> {
  const { batchSize = 10, concurrency = 5, delay: batchDelay = 0, onBatchComplete } = options;

  const results: R[] = [];
  const chunks: T[][] = [];

  // 将items分成多个批次
  for (let i = 0; i < items.length; i += batchSize) {
    chunks.push(items.slice(i, i + batchSize));
  }

  // 处理每个批次
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkResults = await Promise.all(
      chunk.map((item, index) => {
        const actualIndex = i * batchSize + index;
        // 并发控制
        if (index % concurrency === 0 && index > 0) {
          return delay(10).then(() => fn(item, actualIndex));
        }
        return fn(item, actualIndex);
      }),
    );

    results.push(...chunkResults);

    if (onBatchComplete) {
      onBatchComplete(chunkResults, i);
    }

    // 批次之间的延迟
    if (batchDelay > 0 && i < chunks.length - 1) {
      await delay(batchDelay);
    }
  }

  return results;
}

/**
 * 范围限制函数
 * @param value 要限制的值
 * @param min 最小值
 * @param max 最大值
 * @returns 限制后的值
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * 创建带有取消功能的Promise
 * @param executor Promise执行器
 * @returns 可取消的Promise对象
 */
export function createCancelablePromise<T>(
  executor: (
    resolve: (value: T | PromiseLike<T>) => void,
    reject: (reason?: any) => void,
    onCancel: (cancelHandler: () => void) => void,
  ) => void,
): {
  promise: Promise<T>;
  cancel: () => void;
} {
  let cancelHandler: (() => void) | null = null;
  let isCanceled = false;

  const wrappedExecutor = (
    resolve: (value: T | PromiseLike<T>) => void,
    reject: (reason?: any) => void,
  ) => {
    const wrappedResolve = (value: T | PromiseLike<T>) => {
      if (!isCanceled) {
        resolve(value);
      }
    };

    const wrappedReject = (error: any) => {
      if (!isCanceled) {
        reject(error);
      }
    };

    const onCancel = (handler: () => void) => {
      cancelHandler = handler;
    };

    executor(wrappedResolve, wrappedReject, onCancel);
  };

  const promise = new Promise<T>(wrappedExecutor);

  const cancel = () => {
    if (cancelHandler) {
      cancelHandler();
    }
    isCanceled = true;
  };

  return {
    promise,
    cancel,
  };
}

/**
 * 检查两个对象是否相等
 * @param obj1 第一个对象
 * @param obj2 第二个对象
 * @returns 是否相等
 */
export function isEqual(obj1: unknown, obj2: unknown): boolean {
  // 处理基本类型和引用相等
  if (obj1 === obj2) {
    return true;
  }

  // 如果有一个不是对象，它们就不相等
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object' || obj1 === null || obj2 === null) {
    return false;
  }

  // 处理日期对象
  if (obj1 instanceof Date && obj2 instanceof Date) {
    return obj1.getTime() === obj2.getTime();
  }

  // 处理正则表达式
  if (obj1 instanceof RegExp && obj2 instanceof RegExp) {
    return obj1.toString() === obj2.toString();
  }

  // 处理Map对象
  if (obj1 instanceof Map && obj2 instanceof Map) {
    if (obj1.size !== obj2.size) {
      return false;
    }

    for (const [key, val] of obj1) {
      // 检查键是否存在
      if (!obj2.has(key)) {
        return false;
      }

      // 递归比较值
      if (!isEqual(val, obj2.get(key))) {
        return false;
      }
    }

    return true;
  }

  // 处理Set对象
  if (obj1 instanceof Set && obj2 instanceof Set) {
    if (obj1.size !== obj2.size) {
      return false;
    }

    // 将Set转换为数组进行比较
    const arr1 = Array.from(obj1);
    const arr2 = Array.from(obj2);

    // 简单比较（如果元素是基本类型）
    if (arr1.every(item => typeof item !== 'object' || item === null)) {
      return arr1.every(item => obj2.has(item));
    }

    // 复杂比较（如果元素是对象）
    return arr1.every(item1 => arr2.some(item2 => isEqual(item1, item2)));
  }

  // 处理数组
  if (Array.isArray(obj1) && Array.isArray(obj2)) {
    if (obj1.length !== obj2.length) {
      return false;
    }

    for (let i = 0; i < obj1.length; i++) {
      if (!isEqual(obj1[i], obj2[i])) {
        return false;
      }
    }

    return true;
  }

  // 确保两个都是对象且不是数组
  if (Array.isArray(obj1) || Array.isArray(obj2)) {
    return false;
  }

  // 处理Error对象
  if (obj1 instanceof Error && obj2 instanceof Error) {
    return obj1.name === obj2.name && obj1.message === obj2.message;
  }

  // 处理普通对象
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  // 键数量不同
  if (keys1.length !== keys2.length) {
    return false;
  }

  // 检查所有键值对
  for (const key of keys1) {
    if (!Object.prototype.hasOwnProperty.call(obj2, key)) {
      return false;
    }

    if (!isEqual((obj1 as Record<string, unknown>)[key], (obj2 as Record<string, unknown>)[key])) {
      return false;
    }
  }

  return true;
}

/**
 * 将异步函数包装为带有超时的函数
 * @param fn 异步函数
 * @param timeout 超时时间（毫秒）
 * @returns 带有超时的异步函数
 */
export function withTimeout<T, Args extends any[]>(
  fn: (...args: Args) => Promise<T>,
  timeout: number,
): (...args: Args) => Promise<T> {
  return async (...args: Args): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeout}ms`));
      }, timeout);

      fn(...args)
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  };
}
