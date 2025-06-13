/**
 * 存储迁移助手
 * 提供数据库版本迁移和升级支持
 */
import { StorageLogger } from './storage-logger';

/**
 * 迁移函数类型
 * 接受数据库连接，执行迁移操作
 */
export type MigratorFunction = (db: IDBDatabase) => Promise<void>;

/**
 * 迁移结果状态
 */
export enum MigrationStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

/**
 * 迁移结果
 */
export interface MigrationResult {
  status: MigrationStatus;
  fromVersion: number;
  toVersion: number;
  error?: Error;
  message?: string;
}

/**
 * 存储迁移助手
 */
export class MigrationHelper {
  private migrators: Map<number, MigratorFunction> = new Map();
  private logger: StorageLogger;

  /**
   * 创建迁移助手实例
   */
  constructor(logger?: StorageLogger) {
    this.logger = logger || new StorageLogger();
  }

  /**
   * 注册版本迁移器
   * @param version 目标版本号
   * @param migrator 迁移函数
   */
  registerMigrator(version: number, migrator: MigratorFunction): void {
    if (this.migrators.has(version)) {
      this.logger.warn(`已存在版本 ${version} 的迁移器，将被覆盖`);
    }

    this.migrators.set(version, migrator);
    this.logger.debug(`已注册版本 ${version} 的迁移器`);
  }

  /**
   * 批量注册迁移器
   * @param migrators 迁移器映射
   */
  registerMigrators(migrators: Record<number, MigratorFunction>): void {
    Object.entries(migrators).forEach(([versionStr, migrator]) => {
      const version = Number(versionStr);
      if (!isNaN(version)) {
        this.registerMigrator(version, migrator);
      } else {
        this.logger.error(`无效的版本号：${versionStr}`);
      }
    });
  }

  /**
   * 获取所有已注册的迁移版本
   * 按版本号升序排序
   */
  getMigrationVersions(): number[] {
    return Array.from(this.migrators.keys()).sort((a, b) => a - b);
  }

  /**
   * 获取特定版本的迁移器
   */
  getMigrator(version: number): MigratorFunction | undefined {
    return this.migrators.get(version);
  }

  /**
   * 执行迁移
   * 注意：此方法需要在数据库版本变更处理器内调用
   *
   * @param db 数据库对象
   * @param oldVersion 旧版本号
   * @param newVersion 新版本号
   */
  async migrate(db: IDBDatabase, oldVersion: number, newVersion: number): Promise<MigrationResult> {
    this.logger.info(`开始数据库迁移 v${oldVersion} -> v${newVersion}`);

    if (oldVersion >= newVersion) {
      this.logger.info('无需迁移（当前版本已是最新）');
      return {
        status: MigrationStatus.SKIPPED,
        fromVersion: oldVersion,
        toVersion: newVersion,
        message: '当前版本已是最新',
      };
    }

    try {
      // 获取需要执行的迁移
      const migrationsToRun = this.getMigrationVersions().filter(
        version => version > oldVersion && version <= newVersion,
      );

      if (migrationsToRun.length === 0) {
        this.logger.info('未找到适用的迁移器');
        return {
          status: MigrationStatus.SKIPPED,
          fromVersion: oldVersion,
          toVersion: newVersion,
          message: '未找到适用的迁移器',
        };
      }

      // 按版本顺序执行迁移
      for (const version of migrationsToRun) {
        const migrator = this.migrators.get(version);
        if (migrator) {
          this.logger.info(`执行版本 ${version} 的迁移`);
          await migrator(db);
        }
      }

      this.logger.info(`迁移完成：v${oldVersion} -> v${newVersion}`);
      return {
        status: MigrationStatus.SUCCESS,
        fromVersion: oldVersion,
        toVersion: newVersion,
        message: '迁移成功',
      };
    } catch (error) {
      this.logger.error(`迁移失败：${(error as Error).message}`, error);
      return {
        status: MigrationStatus.FAILED,
        fromVersion: oldVersion,
        toVersion: newVersion,
        error: error as Error,
        message: `迁移失败：${(error as Error).message}`,
      };
    }
  }

  /**
   * 创建对象存储
   * 辅助方法，方便在迁移脚本中创建对象存储
   */
  createObjectStore(
    db: IDBDatabase,
    storeName: string,
    options: IDBObjectStoreParameters = { keyPath: 'id' },
  ): IDBObjectStore {
    this.logger.debug(`创建对象存储：${storeName}`);
    return db.createObjectStore(storeName, options);
  }

  /**
   * 创建索引
   * 辅助方法，方便在迁移脚本中创建索引
   */
  createIndex(
    store: IDBObjectStore,
    indexName: string,
    keyPath: string | string[],
    options: IDBIndexParameters = { unique: false },
  ): IDBIndex {
    this.logger.debug(`创建索引：${indexName}`);
    return store.createIndex(indexName, keyPath, options);
  }
}
