import { IStorageUsage } from '@file-chunk-uploader/types';

import { PriorityManager } from './priority-manager';
import { StorageLogger } from './storage-logger';
import { IExtendedStorageOptions, IStorageItemMetadata } from './storage-options';

/**
 * 清理策略函数类型
 */
type CleanupStrategy = (items: IStorageItemMetadata[]) => IStorageItemMetadata[];

/**
 * 存储空间清理事件
 */
export enum SpaceCleanupEvent {
  WARNING = 'warning',
  CLEANUP_STARTED = 'cleanup_started',
  CLEANUP_COMPLETE = 'cleanup_complete',
  CLEANUP_FAILED = 'cleanup_failed',
}

/**
 * 存储空间管理类
 * 负责监控存储空间使用情况和清理策略
 */
export class SpaceManager {
  private options: IExtendedStorageOptions;
  private logger: StorageLogger;
  private priorityManager: PriorityManager;
  private eventListeners: Map<SpaceCleanupEvent, Array<(data: any) => void>> = new Map();
  private cleanupStrategies: Map<string, CleanupStrategy> = new Map();

  /**
   * 创建空间管理器实例
   */
  constructor(
    options: IExtendedStorageOptions = {},
    logger?: StorageLogger,
    priorityManager?: PriorityManager,
  ) {
    this.options = options;
    this.logger = logger || new StorageLogger();
    this.priorityManager = priorityManager || new PriorityManager(this.logger);

    // 注册默认清理策略
    this.registerCleanupStrategies();
  }

  /**
   * 检查存储空间状态
   * @param usage 当前存储使用情况
   * @returns 如果空间使用超过警告阈值，返回true
   */
  checkStorageWarning(usage: IStorageUsage): boolean {
    if (!this.options.spaceManagement) {
      return false;
    }

    const { maxStorageSize, usageWarningThreshold = 0.8 } = this.options.spaceManagement;

    // 如果没有设置最大存储大小限制，则检查实际使用率（如果可用）
    if (!maxStorageSize && usage.usageRatio !== undefined) {
      if (usage.usageRatio >= usageWarningThreshold) {
        this.triggerEvent(SpaceCleanupEvent.WARNING, {
          usageRatio: usage.usageRatio,
          threshold: usageWarningThreshold,
        });
        this.logger.warn(`存储空间使用率警告：${Math.round(usage.usageRatio * 100)}%`);
        return true;
      }
      return false;
    }

    // 如果设置了最大存储大小限制，检查是否接近限制
    if (maxStorageSize && usage.totalSize >= maxStorageSize * usageWarningThreshold) {
      this.triggerEvent(SpaceCleanupEvent.WARNING, {
        totalSize: usage.totalSize,
        maxSize: maxStorageSize,
        threshold: usageWarningThreshold,
      });
      this.logger.warn(
        `存储空间使用警告：${this.formatSize(usage.totalSize)}/${this.formatSize(maxStorageSize)}`,
      );
      return true;
    }

    return false;
  }

  /**
   * 执行存储空间清理
   * @param items 所有存储项的元数据
   * @param percentageToFree 目标释放空间百分比 (0-1)
   * @returns 建议清理的项目列表
   */
  async cleanupStorage(
    items: IStorageItemMetadata[],
    percentageToFree: number = 0.3,
  ): Promise<IStorageItemMetadata[]> {
    this.triggerEvent(SpaceCleanupEvent.CLEANUP_STARTED, {
      itemCount: items.length,
      percentageToFree,
    });

    try {
      const strategy = this.options.spaceManagement?.cleanupStrategy || 'lowest-priority';
      let strategyFn = this.cleanupStrategies.get(strategy);

      if (!strategyFn) {
        this.logger.warn(`未知清理策略: ${strategy}，使用默认策略`);
        strategyFn = this.cleanupStrategies.get('lowest-priority');
      }

      if (!strategyFn) {
        throw new Error('无法获取清理策略');
      }

      // 获取当前总大小
      const currentTotalSize = items.reduce((sum, item) => sum + item.size, 0);

      // 目标释放大小
      const targetReleaseSize = currentTotalSize * percentageToFree;

      // 选择要清理的项目
      const itemsToRemove = strategyFn(items);

      // 按顺序移除，直到达到目标释放大小
      let releasedSize = 0;
      const selectedItems: IStorageItemMetadata[] = [];

      for (const item of itemsToRemove) {
        selectedItems.push(item);
        releasedSize += item.size;

        if (releasedSize >= targetReleaseSize) {
          break;
        }
      }

      this.logger.info(
        `空间清理完成：选择了 ${selectedItems.length} 个项目，预计释放 ${this.formatSize(
          releasedSize,
        )}`,
      );

      this.triggerEvent(SpaceCleanupEvent.CLEANUP_COMPLETE, {
        itemsRemoved: selectedItems.length,
        releasedSize,
        targetReleaseSize,
      });

      return selectedItems;
    } catch (error) {
      this.logger.error(`空间清理失败: ${(error as Error).message}`, error);

      this.triggerEvent(SpaceCleanupEvent.CLEANUP_FAILED, {
        error,
      });

      return [];
    }
  }

  /**
   * 注册事件监听器
   * @param event 事件类型
   * @param listener 监听器函数
   */
  on(event: SpaceCleanupEvent, listener: (data: any) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)?.push(listener);
  }

  /**
   * 移除事件监听器
   * @param event 事件类型
   * @param listener 监听器函数
   */
  off(event: SpaceCleanupEvent, listener: (data: any) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * 触发事件
   * @param event 事件类型
   * @param data 事件数据
   */
  private triggerEvent(event: SpaceCleanupEvent, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          this.logger.error(`事件监听器执行错误: ${(error as Error).message}`, error);
        }
      });
    }
  }

  /**
   * 注册默认清理策略
   */
  private registerCleanupStrategies(): void {
    // 最低优先级优先清理
    this.cleanupStrategies.set('lowest-priority', (items: IStorageItemMetadata[]) => {
      return [...items].sort((a, b) => {
        const priorityA = this.priorityManager.calculateItemPriority(a);
        const priorityB = this.priorityManager.calculateItemPriority(b);
        return priorityA - priorityB; // 升序，低优先级在前
      });
    });

    // 最旧优先清理
    this.cleanupStrategies.set('oldest', (items: IStorageItemMetadata[]) => {
      return [...items].sort((a, b) => a.createdAt - b.createdAt);
    });

    // 最大优先清理
    this.cleanupStrategies.set('largest', (items: IStorageItemMetadata[]) => {
      return [...items].sort((a, b) => b.size - a.size);
    });
  }

  /**
   * 注册自定义清理策略
   * @param name 策略名称
   * @param strategy 策略函数
   */
  registerCleanupStrategy(name: string, strategy: CleanupStrategy): void {
    this.cleanupStrategies.set(name, strategy);
  }

  /**
   * 格式化大小
   */
  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}GB`;
  }
}
