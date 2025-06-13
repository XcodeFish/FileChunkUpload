import { IStorageOptions } from '@file-chunk-uploader/types';

/**
 * 扩展的存储选项接口
 */
export interface IExtendedStorageOptions extends IStorageOptions {
  /** 是否启用压缩 */
  enableCompression?: boolean;

  /** 压缩方法 'gzip' | 'deflate' | 'custom' */
  compressionMethod?: 'gzip' | 'deflate' | 'custom';

  /** 自定义压缩函数 */
  compress?: (data: Blob) => Promise<Blob>;

  /** 自定义解压函数 */
  decompress?: (data: Blob) => Promise<Blob>;

  /** 空间管理策略 */
  spaceManagement?: {
    /** 最大存储空间限制（字节）*/
    maxStorageSize?: number;

    /** 存储使用率警告阈值 (0-1) */
    usageWarningThreshold?: number;

    /** 存储满时的清理策略 'oldest' | 'largest' | 'lowest-priority' */
    cleanupStrategy?: 'oldest' | 'largest' | 'lowest-priority';

    /** 是否在到达警告阈值时主动清理 */
    autoCleanOnWarning?: boolean;
  };

  /** 存储优先级选项 */
  priorityOptions?: {
    /** 默认优先级 (1-10, 10为最高) */
    defaultPriority?: number;

    /** 是否自动降级低优先级文件 */
    enableAutoDemotion?: boolean;

    /** 多长时间未访问后降级优先级 (毫秒) */
    demotionThreshold?: number;
  };

  /** 版本迁移选项 */
  migration?: {
    /** 迁移处理器 */
    migrators?: Record<number, (db: IDBDatabase) => Promise<void>>;

    /** 是否启用自动迁移 */
    autoMigrate?: boolean;
  };
}

/**
 * 存储项元数据接口
 */
export interface IStorageItemMetadata {
  /** 键 */
  key: string;
  /** 创建时间 */
  createdAt: number;
  /** 过期时间 */
  expiresAt?: number;
  /** 大小（字节） */
  size: number;
  /** 优先级 (1-10) */
  priority: number;
  /** 最后访问时间 */
  lastAccessed: number;
  /** 访问次数 */
  accessCount: number;
  /** 是否已压缩 */
  compressed: boolean;
  /** 压缩方法 */
  compressionMethod?: string;
  /** 原始大小（如果已压缩） */
  originalSize?: number;
  /** 文件ID (如果适用) */
  fileId?: string;
  /** 分片索引 (如果适用) */
  chunkIndex?: number;
}

/**
 * 文件优先级信息接口
 */
export interface IFilePriorityInfo {
  /** 文件ID */
  fileId: string;
  /** 优先级 (1-10) */
  priority: number;
  /** 更新时间 */
  updatedAt: number;
}
