/**
 * 对象操作工具函数集
 */

/**
 * 深度克隆对象
 * @param obj 要克隆的对象
 * @returns 克隆后的对象
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // 处理日期对象
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T;
  }

  // 处理数组
  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item)) as unknown as T;
  }

  // 处理普通对象
  const cloned = {} as Record<string, any>;
  Object.keys(obj as Record<string, any>).forEach(key => {
    cloned[key] = deepClone((obj as Record<string, any>)[key]);
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
 * @returns 合并后的对象
 */
export function deepMerge<T extends Record<string, any>, U extends Record<string, any>>(
  target: T,
  source: U,
): T & U {
  const result = { ...target } as Record<string, any>;

  if (isObject(source)) {
    Object.keys(source).forEach(key => {
      const sourceValue = source[key];
      const targetValue = target[key];

      if (Array.isArray(sourceValue) && Array.isArray(targetValue)) {
        // 合并数组，不去重
        result[key] = [...targetValue, ...sourceValue];
      } else if (isObject(sourceValue) && isObject(targetValue)) {
        // 递归合并对象
        result[key] = deepMerge(targetValue, sourceValue);
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
  let result = { ...target };

  sources.forEach(source => {
    result = deepMerge(result, source);
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
