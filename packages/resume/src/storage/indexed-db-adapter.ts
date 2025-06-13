import { IStorageAdapter, IStorageOptions, IStorageUsage } from '@file-chunk-uploader/types';

/**
 * IndexedDB存储适配器
 * 提供基于IndexedDB的数据存储实现
 */
export class IndexedDBAdapter implements IStorageAdapter {
  private dbName: string;
  private storeName: string;
  private version: number;
  private keyPrefix: string;
  private db: IDBDatabase | null = null;
  private ready: Promise<void>;

  /**
   * 创建IndexedDB存储适配器
   * @param options 存储选项
   */
  constructor(options: IStorageOptions = {}) {
    this.dbName = options.dbName || 'file-chunk-uploader';
    this.storeName = options.storeName || 'uploads';
    this.version = options.version || 1;
    this.keyPrefix = options.keyPrefix || '';
    this.ready = this.initDB();
  }

  /**
   * 初始化IndexedDB数据库
   * @returns 初始化完成的Promise
   */
  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      // 检查浏览器是否支持IndexedDB
      if (!this.isSupported()) {
        reject(new Error('IndexedDB不受支持'));
        return;
      }

      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        console.error('无法打开IndexedDB');
        reject(new Error('IndexedDB访问被拒绝'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = () => {
        const db = request.result;

        // 创建对象存储
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          // 创建索引便于查询
          store.createIndex('fileId', 'fileId', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('type', 'type', { unique: false });
        }
      };
    });
  }

  /**
   * 保存数据到IndexedDB
   * @param key 键名
   * @param value 要保存的数据
   * @param expiration 过期时间(毫秒)
   */
  async save<T>(key: string, value: T, expiration?: number): Promise<void> {
    await this.ready;

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未初始化'));
        return;
      }

      try {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);

        // 准备数据
        const prefixedKey = this.getKeyWithPrefix(key);
        const now = Date.now();
        const data = {
          id: prefixedKey,
          key: prefixedKey,
          value,
          createdAt: now,
          updatedAt: now,
          expireAt: expiration ? now + expiration : undefined,
          fileId: prefixedKey.split('_')[1], // 如果key的格式是 "type_fileId_extra"
          type: prefixedKey.split('_')[0], // 提取类型，如 "state"、"chunk" 等
        };

        // 保存
        const request = store.put(data);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(new Error('保存数据失败'));
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * 从IndexedDB获取数据
   * @param key 键名
   * @returns 数据或null(如果不存在或已过期)
   */
  async get<T>(key: string): Promise<T | null> {
    await this.ready;

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未初始化'));
        return;
      }

      try {
        const transaction = this.db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const prefixedKey = this.getKeyWithPrefix(key);
        const request = store.get(prefixedKey);

        request.onsuccess = () => {
          const result = request.result;

          // 检查是否存在
          if (!result) {
            resolve(null);
            return;
          }

          // 检查是否过期
          if (result.expireAt && result.expireAt < Date.now()) {
            // 数据已过期，异步删除
            this.remove(key).catch(() => {
              // 忽略删除错误
            });
            resolve(null);
            return;
          }

          resolve(result.value);
        };

        request.onerror = () => reject(new Error('获取数据失败'));
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * 从IndexedDB删除数据
   * @param key 键名
   */
  async remove(key: string): Promise<void> {
    await this.ready;

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未初始化'));
        return;
      }

      try {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const prefixedKey = this.getKeyWithPrefix(key);
        const request = store.delete(prefixedKey);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(new Error('删除数据失败'));
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * 检查键是否存在于IndexedDB
   * @param key 键名
   * @returns 是否存在
   */
  async has(key: string): Promise<boolean> {
    try {
      const value = await this.get(key);
      return value !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * 清空IndexedDB存储
   */
  async clear(): Promise<void> {
    await this.ready;

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未初始化'));
        return;
      }

      try {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(new Error('清空数据失败'));
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * 获取所有键
   * @returns 键列表
   */
  async keys(): Promise<string[]> {
    await this.ready;

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未初始化'));
        return;
      }

      try {
        const transaction = this.db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.getAllKeys();

        request.onsuccess = () => {
          const results = Array.from(request.result as IDBValidKey[])
            .map(key => key.toString())
            .filter(key => key.startsWith(this.keyPrefix))
            .map(key => this.removePrefix(key));

          resolve(results);
        };

        request.onerror = () => reject(new Error('获取键列表失败'));
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * 获取存储使用情况
   * @returns 存储使用情况
   */
  async getUsage(): Promise<IStorageUsage> {
    await this.ready;

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未初始化'));
        return;
      }

      try {
        const transaction = this.db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.getAll();

        request.onsuccess = () => {
          const results = request.result;
          let totalSize = 0;
          let chunkCount = 0;
          const fileIds = new Set<string>();

          results.forEach(item => {
            // 计算总大小（粗略估计，实际大小需考虑序列化后的大小）
            const itemSize = this.estimateSize(item);
            totalSize += itemSize;

            // 统计分片数量
            if (item.type === 'chunk') {
              chunkCount++;
            }

            // 收集文件ID
            if (item.fileId) {
              fileIds.add(item.fileId);
            }
          });

          resolve({
            totalSize,
            chunkCount,
            fileCount: fileIds.size,
          });
        };

        request.onerror = () => reject(new Error('获取存储使用情况失败'));
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * 清理过期数据
   */
  async clearExpired(): Promise<void> {
    await this.ready;

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('数据库未初始化'));
        return;
      }

      try {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.openCursor();

        const now = Date.now();

        request.onsuccess = event => {
          const cursor = (event.target as IDBRequest).result;

          if (cursor) {
            const data = cursor.value;

            // 检查是否过期
            if (data.expireAt && data.expireAt < now) {
              cursor.delete();
            }

            cursor.continue();
          } else {
            // 所有条目都已处理
            resolve();
          }
        };

        request.onerror = () => reject(new Error('清理过期数据失败'));
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * 检查是否支持IndexedDB
   * @returns 是否支持
   */
  isSupported(): boolean {
    return typeof indexedDB !== 'undefined';
  }

  /**
   * 为键添加前缀
   * @param key 原始键
   * @returns 带前缀的键
   */
  private getKeyWithPrefix(key: string): string {
    if (this.keyPrefix && !key.startsWith(this.keyPrefix)) {
      return `${this.keyPrefix}${key}`;
    }
    return key;
  }

  /**
   * 移除键的前缀
   * @param key 带前缀的键
   * @returns 原始键
   */
  private removePrefix(key: string): string {
    if (this.keyPrefix && key.startsWith(this.keyPrefix)) {
      return key.substring(this.keyPrefix.length);
    }
    return key;
  }

  /**
   * 估算对象大小（字节）
   * @param obj 要估算大小的对象
   * @returns 估算的字节大小
   */
  private estimateSize(obj: any): number {
    if (obj === null || obj === undefined) return 0;

    // Blob或File对象直接获取大小
    if (obj instanceof Blob || obj instanceof File) {
      return obj.size;
    }

    // 特殊处理ArrayBuffer和类型化数组
    if (obj instanceof ArrayBuffer) {
      return obj.byteLength;
    }

    if (
      obj instanceof Int8Array ||
      obj instanceof Uint8Array ||
      obj instanceof Uint8ClampedArray ||
      obj instanceof Int16Array ||
      obj instanceof Uint16Array ||
      obj instanceof Int32Array ||
      obj instanceof Uint32Array ||
      obj instanceof Float32Array ||
      obj instanceof Float64Array
    ) {
      return obj.byteLength;
    }

    // 字符串计算字节大小（考虑UTF-8编码）
    if (typeof obj === 'string') {
      // 使用TextEncoder来精确计算UTF-8编码字节长度
      if (typeof TextEncoder !== 'undefined') {
        return new TextEncoder().encode(obj).length;
      }
      // 降级处理：估算UTF-8编码大小
      // ASCII字符占1字节，其他字符可能占2-4字节
      let size = 0;
      for (let i = 0; i < obj.length; i++) {
        const code = obj.charCodeAt(i);
        if (code <= 0x7f) {
          size += 1; // ASCII字符
        } else if (code <= 0x7ff) {
          size += 2; // 两字节字符
        } else if (code >= 0xd800 && code <= 0xdfff) {
          // 处理UTF-16代理对
          size += 4;
          i++; // 跳过下一个代码单元
        } else {
          size += 3; // 三字节字符
        }
      }
      return size;
    }

    // 数字和布尔值固定大小
    if (typeof obj === 'number') return 8;
    if (typeof obj === 'boolean') return 4;

    // 日期对象
    if (obj instanceof Date) return 8;

    // 递归计算对象和数组
    if (typeof obj === 'object') {
      let size = 0;

      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          // 键的大小
          size += key.length * 2;
          // 值的大小
          size += this.estimateSize(obj[key]);
        }
      }

      return size;
    }

    return 0;
  }
}
