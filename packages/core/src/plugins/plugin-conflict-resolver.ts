/**
 * 插件冲突解决器
 * 负责检测和解决插件冲突问题
 */
import { IPlugin } from '@file-chunk-uploader/types';

import { Logger } from '../developer-mode/logger';

import { compareSemVer, detectPluginConflict } from './plugin-utils';

/**
 * 冲突解决策略
 */
export enum ConflictResolutionStrategy {
  /** 使用最新版本 */
  USE_LATEST = 'use_latest',
  /** 使用已安装版本 */
  USE_INSTALLED = 'use_installed',
  /** 使用最高优先级版本 */
  USE_HIGHEST_PRIORITY = 'use_highest_priority',
  /** 合并两个插件 */
  MERGE = 'merge',
  /** 并存（适用于功能不同但名称相似的插件） */
  COEXIST = 'coexist',
  /** 禁止安装 */
  FORBID = 'forbid',
}

/**
 * 插件冲突描述
 */
export interface PluginConflict {
  /** 冲突类型 */
  type: 'version' | 'functionality' | 'api_compatibility' | 'other';
  /** 冲突描述 */
  details: string;
  /** 冲突严重性 */
  severity: 'high' | 'medium' | 'low';
  /** 推荐解决策略 */
  recommendedStrategy: ConflictResolutionStrategy;
  /** 涉及的插件 */
  plugins: IPlugin[];
}

/**
 * 插件冲突解决器
 */
export class PluginConflictResolver {
  /** 全局解决策略 */
  private globalStrategy: ConflictResolutionStrategy = ConflictResolutionStrategy.USE_LATEST;

  /** 插件特定解决策略 */
  private pluginSpecificStrategies: Map<string, ConflictResolutionStrategy> = new Map();

  /** 日志记录器 */
  private logger: Logger;

  /**
   * 创建插件冲突解决器实例
   * @param logger 日志记录器
   * @param globalStrategy 全局解决策略
   */
  constructor(logger: Logger, globalStrategy?: ConflictResolutionStrategy) {
    this.logger = logger;
    if (globalStrategy) {
      this.globalStrategy = globalStrategy;
    }
  }

  /**
   * 设置全局解决策略
   * @param strategy 解决策略
   */
  public setGlobalStrategy(strategy: ConflictResolutionStrategy): void {
    this.globalStrategy = strategy;
  }

  /**
   * 设置特定插件的解决策略
   * @param pluginName 插件名称
   * @param strategy 解决策略
   */
  public setPluginStrategy(pluginName: string, strategy: ConflictResolutionStrategy): void {
    this.pluginSpecificStrategies.set(pluginName, strategy);
  }

  /**
   * 检测新插件与已安装插件之间的冲突
   * @param newPlugin 新插件
   * @param installedPlugins 已安装的插件
   * @returns 冲突列表
   */
  public detectConflicts(
    newPlugin: IPlugin,
    installedPlugins: Map<string, IPlugin>,
  ): PluginConflict[] {
    const conflicts: PluginConflict[] = [];

    // 检查版本冲突（同名不同版本）
    const installedPlugin = installedPlugins.get(newPlugin.name);
    if (installedPlugin) {
      conflicts.push({
        type: 'version',
        details: `插件 "${newPlugin.name}" 已安装版本 ${installedPlugin.version}，尝试安装版本 ${newPlugin.version}`,
        severity: 'high',
        recommendedStrategy: this.determineVersionConflictStrategy(newPlugin, installedPlugin),
        plugins: [newPlugin, installedPlugin],
      });
    }

    // 检查功能重叠冲突
    for (const plugin of installedPlugins.values()) {
      if (plugin.name !== newPlugin.name) {
        const conflictResult = detectPluginConflict(newPlugin, plugin);
        if (conflictResult.hasConflict && conflictResult.type === 'functionality') {
          conflicts.push({
            type: 'functionality',
            details:
              conflictResult.details || `插件 "${newPlugin.name}" 和 "${plugin.name}" 存在功能重叠`,
            severity: 'medium',
            recommendedStrategy: ConflictResolutionStrategy.COEXIST,
            plugins: [newPlugin, plugin],
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * 解决冲突
   * @param conflict 冲突信息
   * @returns 要保留的插件和解决策略
   */
  public resolveConflict(conflict: PluginConflict): {
    keepPlugin: IPlugin;
    resolution: ConflictResolutionStrategy;
    action: string;
  } {
    // 获取适用的解决策略
    const strategy = this.getResolutionStrategy(conflict);
    let keepPlugin: IPlugin;
    let action = '';

    switch (strategy) {
      case ConflictResolutionStrategy.USE_LATEST:
        // 比较版本选择最新的
        if (conflict.type === 'version' && conflict.plugins.length === 2) {
          const [newPlugin, installedPlugin] = conflict.plugins;
          const versionComparison = compareSemVer(newPlugin.version, installedPlugin.version);
          keepPlugin = versionComparison > 0 ? newPlugin : installedPlugin;
          action = `保留版本 ${keepPlugin.version}`;
        } else {
          keepPlugin = conflict.plugins[0]; // 默认保留第一个
          action = '默认保留第一个插件';
        }
        break;

      case ConflictResolutionStrategy.USE_INSTALLED:
        // 保留已安装的版本
        keepPlugin = conflict.plugins[1]; // 已安装的插件通常是第二个
        action = `保留已安装版本 ${keepPlugin.version}`;
        break;

      case ConflictResolutionStrategy.FORBID:
        // 禁止安装，抛出错误
        throw new Error(`禁止安装存在冲突的插件: ${conflict.details}`);

      case ConflictResolutionStrategy.COEXIST:
        // 允许共存（仅适用于功能冲突）
        keepPlugin = conflict.plugins[0];
        action = '允许插件共存';
        break;

      default:
        // 默认使用第一个插件
        keepPlugin = conflict.plugins[0];
        action = '使用默认冲突解决策略';
    }

    this.logger.info(
      'plugin-conflict',
      `解决冲突: ${conflict.details}, 策略: ${strategy}, 动作: ${action}`,
    );

    return { keepPlugin, resolution: strategy, action };
  }

  /**
   * 获取适用的解决策略
   * @param conflict 冲突信息
   * @returns 解决策略
   */
  private getResolutionStrategy(conflict: PluginConflict): ConflictResolutionStrategy {
    // 首先检查是否有针对该插件的特定策略
    if (conflict.plugins.length > 0 && conflict.plugins[0].name) {
      const specificStrategy = this.pluginSpecificStrategies.get(conflict.plugins[0].name);
      if (specificStrategy) {
        return specificStrategy;
      }
    }

    // 如果冲突有推荐策略且不是禁止，则使用推荐策略
    if (
      conflict.recommendedStrategy &&
      conflict.recommendedStrategy !== ConflictResolutionStrategy.FORBID
    ) {
      return conflict.recommendedStrategy;
    }

    // 否则使用全局策略
    return this.globalStrategy;
  }

  /**
   * 确定版本冲突的最佳解决策略
   * @param newPlugin 新插件
   * @param installedPlugin 已安装的插件
   * @returns 推荐的解决策略
   */
  private determineVersionConflictStrategy(
    newPlugin: IPlugin,
    installedPlugin: IPlugin,
  ): ConflictResolutionStrategy {
    // 比较版本
    const versionComparison = compareSemVer(newPlugin.version, installedPlugin.version);

    // 如果新版本更高，建议使用新版本
    if (versionComparison > 0) {
      return ConflictResolutionStrategy.USE_LATEST;
    }

    // 如果版本相同，建议使用已安装版本
    if (versionComparison === 0) {
      return ConflictResolutionStrategy.USE_INSTALLED;
    }

    // 如果新版本更低，建议使用已安装版本
    return ConflictResolutionStrategy.USE_INSTALLED;
  }
}
