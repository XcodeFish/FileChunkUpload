/**
 * 插件系统工具函数
 * 包括版本比较、冲突检测等通用功能
 */
import { IPlugin } from '@file-chunk-uploader/types';

/**
 * 语义化版本组件
 */
interface SemVerComponents {
  major: number;
  minor: number;
  patch: number;
  preRelease?: string;
}

/**
 * 解析语义化版本字符串为组件
 * @param version 版本字符串，如 "1.2.3" 或 "1.2.3-beta.1"
 * @returns 版本组件对象
 */
export function parseSemVer(version: string): SemVerComponents {
  // 匹配版本号和预发布标识
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9.-]+))?$/);

  if (!match) {
    throw new Error(`无效的语义化版本: ${version}`);
  }

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    preRelease: match[4],
  };
}

/**
 * 比较两个语义化版本
 * @param version1 第一个版本
 * @param version2 第二个版本
 * @returns 比较结果: -1表示version1小于version2, 0表示相等, 1表示version1大于version2
 */
export function compareSemVer(version1: string, version2: string): number {
  const v1 = parseSemVer(version1);
  const v2 = parseSemVer(version2);

  // 比较主版本号
  if (v1.major !== v2.major) {
    return v1.major > v2.major ? 1 : -1;
  }

  // 比较次版本号
  if (v1.minor !== v2.minor) {
    return v1.minor > v2.minor ? 1 : -1;
  }

  // 比较修订版本号
  if (v1.patch !== v2.patch) {
    return v1.patch > v2.patch ? 1 : -1;
  }

  // 比较预发布标识（有预发布标识的版本小于没有预发布标识的版本）
  if (v1.preRelease && !v2.preRelease) {
    return -1;
  }

  if (!v1.preRelease && v2.preRelease) {
    return 1;
  }

  if (v1.preRelease && v2.preRelease) {
    return v1.preRelease.localeCompare(v2.preRelease);
  }

  // 版本相等
  return 0;
}

/**
 * 检查版本兼容性
 * 判断当前版本是否与目标版本兼容
 *
 * @param currentVersion 当前版本
 * @param targetVersion 目标版本
 * @param compatMode 兼容模式，默认为"minor"（次版本兼容）
 * @returns 是否兼容
 */
export function isVersionCompatible(
  currentVersion: string,
  targetVersion: string,
  compatMode: 'exact' | 'major' | 'minor' | 'patch' = 'minor',
): boolean {
  const current = parseSemVer(currentVersion);
  const target = parseSemVer(targetVersion);

  // 精确匹配所有版本号
  if (compatMode === 'exact') {
    return (
      current.major === target.major &&
      current.minor === target.minor &&
      current.patch === target.patch
    );
  }

  // 主版本号必须匹配
  if (compatMode === 'major') {
    return current.major === target.major;
  }

  // 主版本号必须匹配，且当前次版本号必须大于等于目标次版本号
  if (compatMode === 'minor') {
    return (
      current.major === target.major &&
      (current.minor > target.minor ||
        (current.minor === target.minor && current.patch >= target.patch))
    );
  }

  // 主版本号和次版本号必须匹配，且当前修订版本号必须大于等于目标修订版本号
  if (compatMode === 'patch') {
    return (
      current.major === target.major &&
      current.minor === target.minor &&
      current.patch >= target.patch
    );
  }

  return false;
}

/**
 * 检测潜在的插件冲突
 * @param plugin1 插件1
 * @param plugin2 插件2
 * @returns 冲突类型和详情
 */
export function detectPluginConflict(
  plugin1: IPlugin,
  plugin2: IPlugin,
): { hasConflict: boolean; type?: string; details?: string } {
  // 检查是否是同一个插件的不同版本
  if (plugin1.name === plugin2.name && plugin1.version !== plugin2.version) {
    return {
      hasConflict: true,
      type: 'version',
      details: `插件 "${plugin1.name}" 存在版本冲突: ${plugin1.version} 和 ${plugin2.version}`,
    };
  }

  // 检查插件功能重叠（简单实现 - 基于钩子检测）
  const hooks1 = new Set(
    Object.keys(plugin1.lifecycle || {}).concat(Object.keys(plugin1.hooks || {})),
  );

  const hooks2 = new Set(
    Object.keys(plugin2.lifecycle || {}).concat(Object.keys(plugin2.hooks || {})),
  );

  // 计算钩子交集
  const intersection = new Set([...hooks1].filter(hook => hooks2.has(hook)));

  // 如果有大量重叠的钩子，可能存在功能冲突
  if (intersection.size > 0) {
    const overlap = Math.min(intersection.size / hooks1.size, intersection.size / hooks2.size);

    // 如果重叠率超过70%，可能存在功能冲突
    if (overlap > 0.7) {
      return {
        hasConflict: true,
        type: 'functionality',
        details: `插件 "${plugin1.name}" 和 "${plugin2.name}" 可能存在功能重叠，共有 ${intersection.size} 个相同钩子`,
      };
    }
  }

  return { hasConflict: false };
}

/**
 * 插件API版本需求
 */
interface PluginApiRequirement {
  /** API版本 */
  version: string;
  /** 兼容模式 */
  mode: 'exact' | 'major' | 'minor' | 'patch';
}

/**
 * 需要API版本兼容性的插件接口
 */
interface IPluginWithApiInfo extends IPlugin {
  apiVersion?: string;
  apiRequirement?: string;
  compatibleWith?: string;
  apiCompatMode?: 'exact' | 'major' | 'minor' | 'patch';
  dependencies?: Array<{ name: string; version?: string }>;
}

/**
 * 获取插件API版本需求
 * @param plugin 插件实例
 * @returns API版本需求对象
 */
export function getPluginApiRequirement(plugin: IPlugin): PluginApiRequirement {
  const pluginWithApi = plugin as IPluginWithApiInfo;

  // 获取API版本需求
  const apiVersion =
    pluginWithApi.apiVersion ||
    pluginWithApi.apiRequirement ||
    pluginWithApi.compatibleWith ||
    '1.0.0';

  // 获取兼容模式
  const apiCompat = pluginWithApi.apiCompatMode || 'minor';

  return {
    version: apiVersion,
    mode: apiCompat as 'exact' | 'major' | 'minor' | 'patch',
  };
}

/**
 * 生成插件的唯一标识符
 * @param plugin 插件实例
 * @returns 唯一标识符
 */
export function getPluginUniqueId(plugin: IPlugin): string {
  return `${plugin.name}@${plugin.version}`;
}

/**
 * 分析插件之间的关系（依赖、冲突等）
 * @param plugins 插件列表
 * @returns 分析结果
 */
export function analyzePluginRelationships(plugins: IPlugin[]): {
  conflicts: Array<{ plugins: [IPlugin, IPlugin]; type: string; details: string }>;
  dependencies: Map<string, Set<string>>;
} {
  const conflicts: Array<{ plugins: [IPlugin, IPlugin]; type: string; details: string }> = [];
  const dependencies = new Map<string, Set<string>>();

  // 检查冲突
  for (let i = 0; i < plugins.length; i++) {
    for (let j = i + 1; j < plugins.length; j++) {
      const conflict = detectPluginConflict(plugins[i], plugins[j]);
      if (conflict.hasConflict) {
        conflicts.push({
          plugins: [plugins[i], plugins[j]],
          type: conflict.type!,
          details: conflict.details!,
        });
      }
    }

    // 收集依赖关系
    const pluginWithApi = plugins[i] as IPluginWithApiInfo;
    const pluginDeps = pluginWithApi.dependencies || [];
    if (pluginDeps.length > 0) {
      dependencies.set(plugins[i].name, new Set(pluginDeps.map(dep => dep.name)));
    }
  }

  return { conflicts, dependencies };
}
