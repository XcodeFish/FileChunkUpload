/**
 * 配置验证工具
 * 提供配置参数验证功能
 * @module utils/config-validator
 */
import { IChunkConfig, IUploadConfig } from '@file-chunk-uploader/types';

/**
 * 配置验证类
 * 提供统一的配置验证功能
 */
export class ConfigValidator {
  /**
   * 验证分片配置
   * @param config 分片配置
   * @returns 验证后的配置
   * @throws 如果配置无效则抛出错误
   */
  public validateChunkConfig(config?: Partial<IChunkConfig>): IChunkConfig {
    return validateChunkConfig(config);
  }

  /**
   * 验证上传配置
   * @param config 上传配置
   * @returns 验证后的配置
   * @throws 如果配置无效则抛出错误
   */
  public validateUploadConfig(config: IUploadConfig): IUploadConfig {
    return validateUploadConfig(config);
  }

  /**
   * 合并上传配置
   * @param baseConfig 基础配置
   * @param overrideConfig 覆盖配置
   * @returns 合并后的配置
   */
  public mergeUploadConfig(
    baseConfig: IUploadConfig,
    overrideConfig: IUploadConfig,
  ): IUploadConfig {
    return mergeUploadConfig(baseConfig, overrideConfig);
  }
}

/**
 * 验证分片配置
 * @param config 分片配置
 * @returns 验证后的配置
 * @throws 如果配置无效则抛出错误
 */
export function validateChunkConfig(config?: Partial<IChunkConfig>): IChunkConfig {
  const defaultConfig: IChunkConfig = {
    chunkSize: 5 * 1024 * 1024, // 5MB
    concurrency: 3,
    sequential: false,
    indexBase: 0,
    chunkSizeStrategy: 'adaptive',
  };

  if (!config) {
    return defaultConfig;
  }

  const mergedConfig = { ...defaultConfig, ...config };

  // 验证分片大小
  if (mergedConfig.chunkSize && mergedConfig.chunkSize <= 0) {
    throw new Error('分片大小必须大于0');
  }

  // 验证并发数
  if (mergedConfig.concurrency && mergedConfig.concurrency <= 0) {
    throw new Error('并发数必须大于0');
  }

  // 验证索引基数
  if (mergedConfig.indexBase && mergedConfig.indexBase < 0) {
    throw new Error('索引基数必须大于等于0');
  }

  // 验证分片大小策略
  if (
    mergedConfig.chunkSizeStrategy &&
    !['fixed', 'adaptive'].includes(mergedConfig.chunkSizeStrategy)
  ) {
    throw new Error('分片大小策略必须是 "fixed" 或 "adaptive"');
  }

  return mergedConfig;
}

/**
 * 验证上传配置
 * @param config 上传配置
 * @returns 验证后的配置
 * @throws 如果配置无效则抛出错误
 */
export function validateUploadConfig(config: IUploadConfig): IUploadConfig {
  if (!config.target) {
    throw new Error('上传目标URL不能为空');
  }

  // 验证分片配置
  if (config.chunk) {
    config.chunk = validateChunkConfig(config.chunk);
  }

  return config;
}

/**
 * 合并上传配置
 * @param baseConfig 基础配置
 * @param overrideConfig 覆盖配置
 * @returns 合并后的配置
 */
export function mergeUploadConfig(
  baseConfig: IUploadConfig,
  overrideConfig: IUploadConfig,
): IUploadConfig {
  const result = { ...baseConfig };

  // 合并顶级属性
  Object.keys(overrideConfig).forEach(key => {
    const typedKey = key as keyof IUploadConfig;
    if (typedKey !== 'chunk') {
      (result as any)[typedKey] = overrideConfig[typedKey];
    }
  });

  // 合并分片配置
  if (overrideConfig.chunk) {
    result.chunk = {
      ...(result.chunk || {}),
      ...overrideConfig.chunk,
    };
  }

  return validateUploadConfig(result);
}
