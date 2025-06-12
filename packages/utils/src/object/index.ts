/**
 * 对象操作工具函数集
 */

/**
 * 深度克隆对象
 * @param obj 要克隆的对象
 * @param visited 已访问的对象Map，用于检测循环引用
 * @returns 克隆后的对象
 */
export function deepClone<T>(obj: T, visited = new Map<any, any>()): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // 检查是否已经克隆过该对象（处理循环引用）
  if (visited.has(obj)) {
    return visited.get(obj);
  }

  // 处理日期对象
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T;
  }

  // 处理正则表达式
  if (obj instanceof RegExp) {
    return new RegExp(obj.source, obj.flags) as unknown as T;
  }

  // 处理Map对象
  if (obj instanceof Map) {
    const clonedMap = new Map();
    visited.set(obj, clonedMap);

    obj.forEach((value, key) => {
      // 递归克隆键和值
      clonedMap.set(deepClone(key, visited), deepClone(value, visited));
    });

    return clonedMap as unknown as T;
  }

  // 处理Set对象
  if (obj instanceof Set) {
    const clonedSet = new Set();
    visited.set(obj, clonedSet);

    obj.forEach(value => {
      // 递归克隆值
      clonedSet.add(deepClone(value, visited));
    });

    return clonedSet as unknown as T;
  }

  // 处理数组
  if (Array.isArray(obj)) {
    const clonedArray: any[] = [];
    // 将新数组添加到已访问的Map中，以处理循环引用
    visited.set(obj, clonedArray);

    obj.forEach((item, index) => {
      clonedArray[index] = deepClone(item, visited);
    });

    return clonedArray as unknown as T;
  }

  // 处理普通对象
  const cloned = {} as Record<string, any>;
  // 将新对象添加到已访问的Map中，以处理循环引用
  visited.set(obj, cloned);

  Object.keys(obj as Record<string, any>).forEach(key => {
    cloned[key] = deepClone((obj as Record<string, any>)[key], visited);
  });

  return cloned as T;
}

/**
 * 检查是否为普通对象
 * @param obj 要检查的值
 * @returns 是否为普通对象
 */
export function isObject(obj: unknown): obj is Record<string, any> {
  return obj !== null && typeof obj === 'object' && !Array.isArray(obj);
}

/**
 * 深度合并对象
 * @param target 目标对象，会被修改
 * @param source 源对象
 * @param seen 已处理的对象引用Map，用于检测循环引用
 * @returns 合并后的对象
 */
export function deepMerge<T extends Record<string, any>, U extends Record<string, any>>(
  target: T,
  source: U,
  seen?: Map<any, any>,
): T & U {
  // 初始化引用追踪Map
  const refs = seen || new Map();

  // 检查循环引用
  if (refs.has(source)) {
    return refs.get(source);
  }

  const result = { ...target } as Record<string, any>;

  // 将结果添加到引用Map中
  refs.set(source, result);

  if (isObject(source)) {
    Object.keys(source).forEach(key => {
      const sourceValue = source[key];
      const targetValue = target[key];

      if (Array.isArray(sourceValue) && Array.isArray(targetValue)) {
        // 合并数组，不去重
        result[key] = [...targetValue, ...sourceValue];
      } else if (isObject(sourceValue) && isObject(targetValue)) {
        // 检查targetValue是否已经在引用链中
        if (refs.has(targetValue)) {
          result[key] = refs.get(targetValue);
        } else {
          // 递归合并对象，传递引用Map
          result[key] = deepMerge(targetValue, sourceValue, refs);
        }
      } else {
        // 基本类型或不匹配类型，直接覆盖
        result[key] = sourceValue;
      }
    });
  }

  return result as T & U;
}

/**
 * 多个对象的深度合并
 * @param target 目标对象
 * @param sources 源对象列表
 * @returns 合并后的对象
 */
export function deepMergeAll<T extends Record<string, any>>(
  target: T,
  ...sources: Record<string, any>[]
): T {
  // 创建引用追踪Map
  const refs = new Map();
  let result = { ...target };

  sources.forEach(source => {
    result = deepMerge(result, source, refs);
  });

  return result as T;
}

/**
 * 安全获取对象的嵌套属性值
 * @param obj 目标对象
 * @param path 属性路径，如 'a.b.c'
 * @param defaultValue 默认值，当属性不存在时返回
 * @returns 属性值或默认值
 */
export function get<T = any>(
  obj: Record<string, any>,
  path: string,
  defaultValue?: T,
): T | undefined {
  const keys = path.split('.');
  let result = obj;

  for (const key of keys) {
    if (result === undefined || result === null) {
      return defaultValue;
    }
    result = result[key];
  }

  return (result === undefined ? defaultValue : result) as T;
}

/**
 * 安全设置对象的嵌套属性值
 * @param obj 目标对象
 * @param path 属性路径，如 'a.b.c'
 * @param value 要设置的值
 * @returns 修改后的对象
 */
export function set<T extends Record<string, any>>(obj: T, path: string, value: any): T {
  const keys = path.split('.');
  const result = { ...obj } as Record<string, any>;
  let current = result;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];

    // 如果是最后一个键，直接设置值
    if (i === keys.length - 1) {
      current[key] = value;
    } else {
      // 如果当前键不存在或不是对象，创建一个新对象
      if (!isObject(current[key])) {
        current[key] = {};
      }
      current = current[key];
    }
  }

  return result as T;
}

/**
 * 从对象中移除指定键
 * @param obj 目标对象
 * @param keys 要移除的键数组
 * @returns 处理后的新对象
 */
export function omit<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[],
): Omit<T, K> {
  const result = { ...obj };

  keys.forEach(key => {
    delete result[key];
  });

  return result;
}

/**
 * 从对象中选取指定键
 * @param obj 目标对象
 * @param keys 要选取的键数组
 * @returns 只包含指定键的新对象
 */
export function pick<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[],
): Pick<T, K> {
  const result = {} as Pick<T, K>;

  keys.forEach(key => {
    if (key in obj) {
      result[key] = obj[key];
    }
  });

  return result;
}
