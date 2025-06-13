/**
 * 分片上传日志分类常量
 * 用于扩展开发者模式下的日志分类
 */

/**
 * 日志分类枚举
 */
export enum ChunkLogCategory {
  /** 文件处理相关日志 */
  FILE_HANDLER = 'file-handler',
  /** 分片策略相关日志 */
  CHUNK_STRATEGY = 'chunk-strategy',
  /** 分片上传相关日志 */
  CHUNK_UPLOAD = 'chunk-upload',
  /** 分片合并相关日志 */
  CHUNK_MERGE = 'chunk-merge',
  /** 分片进度追踪日志 */
  CHUNK_PROGRESS = 'chunk-progress',
  /** 分片任务管理日志 */
  CHUNK_TASK = 'chunk-task',
  /** 分片性能追踪日志 */
  CHUNK_PERFORMANCE = 'chunk-performance',
  /** 分片插件日志 */
  CHUNK_PLUGIN = 'chunk-plugin',
}

/**
 * 日志分类描述
 */
export const CHUNK_LOG_CATEGORY_DESCRIPTIONS = {
  [ChunkLogCategory.FILE_HANDLER]: '文件处理器日志 - 记录文件分片和处理过程',
  [ChunkLogCategory.CHUNK_STRATEGY]: '分片策略日志 - 记录分片策略执行过程',
  [ChunkLogCategory.CHUNK_UPLOAD]: '分片上传日志 - 记录分片上传过程和结果',
  [ChunkLogCategory.CHUNK_MERGE]: '分片合并日志 - 记录分片合并过程和结果',
  [ChunkLogCategory.CHUNK_PROGRESS]: '分片进度日志 - 记录分片上传进度信息',
  [ChunkLogCategory.CHUNK_TASK]: '任务管理日志 - 记录分片任务创建和管理过程',
  [ChunkLogCategory.CHUNK_PERFORMANCE]: '性能追踪日志 - 记录分片上传性能指标',
  [ChunkLogCategory.CHUNK_PLUGIN]: '分片插件日志 - 记录插件生命周期和交互',
};

/**
 * 获取所有分片日志分类
 * @returns 所有分片日志分类数组
 */
export const getAllChunkLogCategories = (): string[] => {
  return Object.values(ChunkLogCategory);
};

/**
 * 获取日志分类描述
 * @param category 日志分类
 * @returns 分类描述
 */
export const getChunkLogCategoryDescription = (category: ChunkLogCategory): string => {
  return CHUNK_LOG_CATEGORY_DESCRIPTIONS[category] || '未知分片日志分类';
};

/**
 * 注册日志分类到开发者模式
 * @param registerFunction 注册函数
 */
export const registerChunkLogCategories = (
  registerFunction: (category: string, description: string) => void,
): void => {
  Object.entries(CHUNK_LOG_CATEGORY_DESCRIPTIONS).forEach(([category, description]) => {
    registerFunction(category, description);
  });
};
