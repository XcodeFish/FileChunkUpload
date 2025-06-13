import { StorageLogger } from './storage-logger';
import { IFilePriorityInfo, IStorageItemMetadata } from './storage-options';

/**
 * 存储优先级管理器
 * 管理文件和存储项的优先级
 */
export class PriorityManager {
  private static readonly DEFAULT_PRIORITY = 5;
  private priorityMap: Map<string, IFilePriorityInfo> = new Map();
  private logger: StorageLogger;

  /**
   * 创建优先级管理器实例
   * @param logger 日志记录器
   */
  constructor(logger?: StorageLogger) {
    this.logger = logger || new StorageLogger();
  }

  /**
   * 设置文件优先级
   * @param fileId 文件ID
   * @param priority 优先级 (1-10, 10为最高)
   */
  setFilePriority(fileId: string, priority: number): void {
    // 确保优先级在有效范围内
    const validPriority = Math.min(Math.max(Math.round(priority), 1), 10);

    this.priorityMap.set(fileId, {
      fileId,
      priority: validPriority,
      updatedAt: Date.now(),
    });

    // 使用info方法记录优先级设置
    this.logger.info(`设置文件优先级: ${fileId}`, { priority: validPriority });
  }

  /**
   * 获取文件优先级
   * @param fileId 文件ID
   * @returns 文件优先级
   */
  getFilePriority(fileId: string): number {
    return this.priorityMap.get(fileId)?.priority || PriorityManager.DEFAULT_PRIORITY;
  }

  /**
   * 计算存储项优先级
   * 基于文件优先级、访问时间和访问频率
   * @param metadata 存储项元数据
   * @returns 计算后的优先级得分
   */
  calculateItemPriority(metadata: IStorageItemMetadata): number {
    // 基础优先级
    let score = metadata.priority;

    // 如果是分片数据，使用对应文件的优先级
    if (metadata.fileId) {
      const filePriority = this.getFilePriority(metadata.fileId);
      score = filePriority;
    }

    // 考虑访问因素增加权重
    const now = Date.now();
    const daysSinceLastAccess = (now - metadata.lastAccessed) / (1000 * 60 * 60 * 24);

    // 近期访问增加权重，久未访问减少权重
    if (daysSinceLastAccess < 1) {
      // 24小时内访问过，增加权重
      score += 1;
    } else if (daysSinceLastAccess > 7) {
      // 一周未访问，降低权重
      score -= Math.min(3, Math.floor(daysSinceLastAccess / 7));
    }

    // 频繁访问的项目增加权重
    if (metadata.accessCount > 10) {
      score += 1;
    }

    // 限制范围
    return Math.min(Math.max(score, 1), 10);
  }

  /**
   * 排序存储项根据优先级
   * @param items 存储项元数据列表
   * @returns 排序后的列表
   */
  sortItemsByPriority(items: IStorageItemMetadata[]): IStorageItemMetadata[] {
    return [...items].sort((a, b) => {
      const priorityA = this.calculateItemPriority(a);
      const priorityB = this.calculateItemPriority(b);
      return priorityB - priorityA; // 降序，高优先级在前
    });
  }

  /**
   * 获取低优先级项目列表
   * @param items 存储项元数据列表
   * @param threshold 优先级阈值，低于此值视为低优先级
   * @returns 低优先级项目列表
   */
  getLowPriorityItems(items: IStorageItemMetadata[], threshold = 3): IStorageItemMetadata[] {
    return items.filter(item => this.calculateItemPriority(item) <= threshold);
  }

  /**
   * 更新存储项访问记录
   * @param metadata 存储项元数据
   * @returns 更新后的元数据
   */
  updateItemAccess(metadata: IStorageItemMetadata): IStorageItemMetadata {
    return {
      ...metadata,
      accessCount: metadata.accessCount + 1,
      lastAccessed: Date.now(),
    };
  }

  /**
   * 自动降级长时间未访问的项目优先级
   * @param items 存储项元数据列表
   * @param threshold 未访问时间阈值（毫秒）
   * @returns 需要降级的项目列表
   */
  getItemsForDemotion(
    items: IStorageItemMetadata[],
    threshold = 14 * 24 * 60 * 60 * 1000, // 默认两周
  ): IStorageItemMetadata[] {
    const now = Date.now();
    return items.filter(item => {
      // 只处理高优先级项目
      const currentPriority = this.calculateItemPriority(item);
      return currentPriority > 5 && now - item.lastAccessed > threshold;
    });
  }

  /**
   * 导出优先级数据
   * 可用于持久化存储
   */
  exportPriorityData(): IFilePriorityInfo[] {
    return Array.from(this.priorityMap.values());
  }

  /**
   * 导入优先级数据
   * @param data 之前导出的优先级数据
   */
  importPriorityData(data: IFilePriorityInfo[]): void {
    data.forEach(item => {
      this.priorityMap.set(item.fileId, item);
    });
  }
}
