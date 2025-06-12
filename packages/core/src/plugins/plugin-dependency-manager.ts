/**
 * 插件依赖关系管理
 * 负责处理插件间的依赖关系、检测循环依赖等
 */
import { IPlugin } from '@file-chunk-uploader/types';

import { Logger } from '../developer-mode/logger';

/**
 * 插件依赖管理器类
 * 处理插件依赖关系的注册、验证和分析
 */
export class PluginDependencyManager {
  /** 插件依赖关系图 */
  private dependencyGraph: Map<string, Set<string>> = new Map();

  /** 日志记录器 */
  private logger: Logger;

  /**
   * 创建插件依赖管理器实例
   * @param logger 日志记录器实例
   */
  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * 处理插件依赖关系
   * @param plugin 插件实例
   * @param installedPlugins 已安装的插件映射
   * @throws 如果依赖的插件未安装或存在循环依赖，将抛出错误
   */
  public processPluginDependencies(plugin: IPlugin, installedPlugins: Map<string, IPlugin>): void {
    // 获取插件的依赖
    const dependencies = (plugin as unknown as { dependencies?: string[] }).dependencies || [];

    // 检查依赖是否已安装
    for (const dep of dependencies) {
      if (!installedPlugins.has(dep)) {
        throw new Error(`插件 "${plugin.name}" 依赖于未安装的插件 "${dep}"`);
      }
    }

    // 更新依赖关系图
    if (dependencies.length > 0) {
      const deps = this.dependencyGraph.get(plugin.name) || new Set<string>();
      dependencies.forEach(dep => deps.add(dep));
      this.dependencyGraph.set(plugin.name, deps);
    }

    // 检测循环依赖
    this.detectCircularDependencies();
  }

  /**
   * 检查是否有其他插件依赖于指定插件
   * @param pluginName 插件名称
   * @returns 是否有其他插件依赖于该插件
   */
  public hasDependents(pluginName: string): boolean {
    for (const dependencies of this.dependencyGraph.values()) {
      if (dependencies.has(pluginName)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 获取依赖于指定插件的所有插件名称
   * @param pluginName 插件名称
   * @returns 依赖于该插件的插件名称数组
   */
  public getDependents(pluginName: string): string[] {
    const dependents: string[] = [];
    for (const [name, dependencies] of this.dependencyGraph.entries()) {
      if (dependencies.has(pluginName)) {
        dependents.push(name);
      }
    }
    return dependents;
  }

  /**
   * 获取插件的所有依赖
   * @param pluginName 插件名称
   * @returns 该插件依赖的所有插件名称数组
   */
  public getDependencies(pluginName: string): string[] {
    const deps = this.dependencyGraph.get(pluginName);
    return deps ? Array.from(deps) : [];
  }

  /**
   * 获取插件依赖关系图
   * @returns 依赖关系图的副本
   */
  public getDependencyGraph(): Map<string, Set<string>> {
    return new Map(this.dependencyGraph);
  }

  /**
   * 移除插件依赖关系
   * @param pluginName 插件名称
   */
  public removePlugin(pluginName: string): void {
    this.dependencyGraph.delete(pluginName);

    // 同时从其他插件的依赖中移除
    for (const dependencies of this.dependencyGraph.values()) {
      if (dependencies.has(pluginName)) {
        dependencies.delete(pluginName);
      }
    }
  }

  /**
   * 检测循环依赖
   * @throws 如果存在循环依赖则抛出错误
   * @private
   */
  private detectCircularDependencies(): void {
    // 实现深度优先搜索检测循环依赖
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    // 对每个插件进行DFS
    for (const pluginName of this.dependencyGraph.keys()) {
      if (this.detectCycleDFS(pluginName, visited, recursionStack)) {
        throw new Error(`检测到插件循环依赖，涉及插件: ${Array.from(recursionStack).join(' -> ')}`);
      }
    }
  }

  /**
   * 深度优先搜索检测循环依赖
   * @param current 当前插件名
   * @param visited 已访问的插件集合
   * @param recursionStack 递归栈
   * @returns 是否存在循环依赖
   * @private
   */
  private detectCycleDFS(
    current: string,
    visited: Set<string>,
    recursionStack: Set<string>,
  ): boolean {
    // 如果节点已经在递归栈中，说明有环
    if (recursionStack.has(current)) {
      return true;
    }

    // 如果已经访问过且没有环，则跳过
    if (visited.has(current)) {
      return false;
    }

    // 标记当前节点为已访问，并加入递归栈
    visited.add(current);
    recursionStack.add(current);

    // 访问所有依赖
    const dependencies = this.dependencyGraph.get(current);
    if (dependencies) {
      for (const dep of dependencies) {
        if (this.detectCycleDFS(dep, visited, recursionStack)) {
          return true;
        }
      }
    }

    // 从递归栈中移除当前节点
    recursionStack.delete(current);
    return false;
  }
}
