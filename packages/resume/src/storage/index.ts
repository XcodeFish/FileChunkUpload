/**
 * 存储模块导出文件
 */

export { IndexedDBAdapter } from './indexed-db-adapter';
export { StorageManager } from './storage-manager';
export { StorageLogger, StorageOperation } from './storage-logger';
export { MigrationHelper, MigrationStatus, type MigrationResult } from './migration-helper';
export { PriorityManager } from './priority-manager';
export { SpaceManager, SpaceCleanupEvent } from './space-manager';
export { compressData, decompressData, isCompressionSupported } from './compression-utils';
export * from './storage-options';
