/**
 * 插件调用链可视化工具
 * 负责记录和可视化插件钩子调用链
 */
import { IPlugin } from '@file-chunk-uploader/types';

import { Logger } from '../developer-mode/logger';

/**
 * 钩子调用记录
 */
export interface HookCallRecord {
  /** 钩子名称 */
  hookName: string;
  /** 插件名称 */
  pluginName: string;
  /** 调用时间戳 */
  timestamp: number;
  /** 执行耗时（毫秒） */
  duration: number;
  /** 执行状态 */
  status: 'success' | 'error' | 'timeout';
  /** 错误信息（如果有） */
  error?: string;
  /** 调用参数类型 */
  paramTypes: string[];
  /** 返回值类型 */
  returnType?: string;
}

/**
 * 插件调用链记录
 */
export interface PluginTraceSession {
  /** 会话ID */
  sessionId: string;
  /** 会话开始时间 */
  startTime: number;
  /** 会话结束时间 */
  endTime?: number;
  /** 调用记录列表 */
  calls: HookCallRecord[];
  /** 总调用次数 */
  totalCalls: number;
  /** 错误调用次数 */
  errorCalls: number;
  /** 超时调用次数 */
  timeoutCalls: number;
  /** 关联文件ID（如果有） */
  fileId?: string;
}

/**
 * 调用链查询选项
 */
export interface TraceQueryOptions {
  /** 开始时间 */
  startTime?: number;
  /** 结束时间 */
  endTime?: number;
  /** 插件名过滤 */
  pluginNames?: string[];
  /** 钩子名过滤 */
  hookNames?: string[];
  /** 仅显示错误 */
  errorsOnly?: boolean;
  /** 仅显示超时 */
  timeoutsOnly?: boolean;
  /** 最大记录数 */
  limit?: number;
}

/**
 * 插件调用链可视化器
 */
export class PluginTraceVisualizer {
  /** 是否启用调用链追踪 */
  private enabled: boolean = true;

  /** 当前会话ID */
  private currentSessionId: string = '';

  /** 当前会话开始时间 */
  private currentSessionStartTime: number = 0;

  /** 调用记录列表 */
  private callRecords: HookCallRecord[] = [];

  /** 会话历史记录 */
  private sessions: Map<string, PluginTraceSession> = new Map();

  /** 最大记录历史数 */
  private maxSessionHistory: number = 10;

  /** 最大调用记录数 */
  private maxCallsPerSession: number = 1000;

  /** 日志记录器 */
  private logger: Logger;

  /**
   * 创建插件调用链可视化器
   * @param logger 日志记录器
   */
  constructor(logger: Logger) {
    this.logger = logger;
    this.startNewSession();
  }

  /**
   * 设置是否启用调用链追踪
   * @param enabled 是否启用
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * 设置最大会话历史数
   * @param max 最大会话历史数
   */
  public setMaxSessionHistory(max: number): void {
    this.maxSessionHistory = max;
    this.cleanupOldSessions();
  }

  /**
   * 设置每个会话的最大调用记录数
   * @param max 最大调用记录数
   */
  public setMaxCallsPerSession(max: number): void {
    this.maxCallsPerSession = max;
  }

  /**
   * 开始新的跟踪会话
   * @param fileId 关联文件ID
   */
  public startNewSession(fileId?: string): string {
    // 结束当前会话
    if (this.currentSessionId) {
      this.endCurrentSession();
    }

    // 创建新会话
    this.currentSessionId = `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.currentSessionStartTime = Date.now();
    this.callRecords = [];

    // 创建会话记录
    const session: PluginTraceSession = {
      sessionId: this.currentSessionId,
      startTime: this.currentSessionStartTime,
      calls: this.callRecords,
      totalCalls: 0,
      errorCalls: 0,
      timeoutCalls: 0,
      fileId,
    };

    // 保存会话
    this.sessions.set(this.currentSessionId, session);

    // 清理旧会话
    this.cleanupOldSessions();

    this.logger.debug('plugin-trace', `开始新的调用链追踪会话: ${this.currentSessionId}`);

    return this.currentSessionId;
  }

  /**
   * 结束当前会话
   */
  public endCurrentSession(): void {
    if (!this.currentSessionId) {
      return;
    }

    const session = this.sessions.get(this.currentSessionId);
    if (session) {
      session.endTime = Date.now();
      this.logger.debug(
        'plugin-trace',
        `结束调用链追踪会话: ${this.currentSessionId}, 总调用: ${session.totalCalls}, 错误: ${session.errorCalls}, 超时: ${session.timeoutCalls}`,
      );
    }
  }

  /**
   * 记录钩子调用
   * @param hookName 钩子名称
   * @param plugin 插件实例
   * @param duration 执行耗时
   * @param status 执行状态
   * @param error 错误信息
   * @param params 调用参数
   * @param returnValue 返回值
   */
  public recordHookCall(
    hookName: string,
    plugin: IPlugin,
    duration: number,
    status: 'success' | 'error' | 'timeout',
    error?: Error,
    params?: unknown[],
    returnValue?: unknown,
  ): void {
    if (!this.enabled || !this.currentSessionId) {
      return;
    }

    const session = this.sessions.get(this.currentSessionId);
    if (!session) {
      return;
    }

    // 检查是否超过最大记录数
    if (session.calls.length >= this.maxCallsPerSession) {
      // 如果超过，则自动创建新会话
      this.startNewSession(session.fileId);
      return this.recordHookCall(hookName, plugin, duration, status, error, params, returnValue);
    }

    // 参数类型
    const paramTypes = params ? params.map(p => this.getTypeDescription(p)) : ['unknown'];

    // 创建调用记录
    const record: HookCallRecord = {
      hookName,
      pluginName: plugin.name,
      timestamp: Date.now(),
      duration,
      status,
      paramTypes,
      returnType: returnValue ? this.getTypeDescription(returnValue) : undefined,
    };

    if (error) {
      record.error = error.message;
    }

    // 更新会话统计信息
    session.totalCalls++;
    if (status === 'error') {
      session.errorCalls++;
    } else if (status === 'timeout') {
      session.timeoutCalls++;
    }

    // 添加到记录列表
    session.calls.push(record);
  }

  /**
   * 获取最近的会话
   * @returns 最近的会话
   */
  public getCurrentSession(): PluginTraceSession | undefined {
    if (!this.currentSessionId) {
      return undefined;
    }
    return this.sessions.get(this.currentSessionId);
  }

  /**
   * 查询调用记录
   * @param options 查询选项
   * @returns 调用记录列表
   */
  public queryCalls(options: TraceQueryOptions = {}): HookCallRecord[] {
    if (!this.currentSessionId) {
      return [];
    }

    const session = this.sessions.get(this.currentSessionId);
    if (!session) {
      return [];
    }

    // 克隆调用记录
    let records = [...session.calls];

    // 应用过滤条件
    if (options.startTime) {
      records = records.filter(r => r.timestamp >= options.startTime!);
    }

    if (options.endTime) {
      records = records.filter(r => r.timestamp <= options.endTime!);
    }

    if (options.pluginNames && options.pluginNames.length > 0) {
      records = records.filter(r => options.pluginNames!.includes(r.pluginName));
    }

    if (options.hookNames && options.hookNames.length > 0) {
      records = records.filter(r => options.hookNames!.includes(r.hookName));
    }

    if (options.errorsOnly) {
      records = records.filter(r => r.status === 'error');
    }

    if (options.timeoutsOnly) {
      records = records.filter(r => r.status === 'timeout');
    }

    // 应用限制
    if (options.limit && options.limit > 0 && records.length > options.limit) {
      records = records.slice(0, options.limit);
    }

    return records;
  }

  /**
   * 获取会话列表
   * @returns 会话列表
   */
  public getSessions(): PluginTraceSession[] {
    return Array.from(this.sessions.values()).sort((a, b) => b.startTime - a.startTime);
  }

  /**
   * 获取指定会话
   * @param sessionId 会话ID
   * @returns 会话信息
   */
  public getSession(sessionId: string): PluginTraceSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * 清理旧会话
   * @private
   */
  private cleanupOldSessions(): void {
    if (this.sessions.size <= this.maxSessionHistory) {
      return;
    }

    // 获取所有会话并按开始时间排序
    const sortedSessions = Array.from(this.sessions.entries()).sort(
      (a, b) => b[1].startTime - a[1].startTime,
    );

    // 保留最新的N个会话
    const keepSessions = sortedSessions.slice(0, this.maxSessionHistory);

    // 重建会话映射
    this.sessions.clear();
    for (const [sessionId, session] of keepSessions) {
      this.sessions.set(sessionId, session);
    }
  }

  /**
   * 获取值的类型描述
   * @param value 值
   * @returns 类型描述
   * @private
   */
  private getTypeDescription(value: unknown): string {
    if (value === null) {
      return 'null';
    }
    if (value === undefined) {
      return 'undefined';
    }
    if (Array.isArray(value)) {
      return `Array(${value.length})`;
    }
    if (value instanceof Error) {
      return `Error: ${value.name}`;
    }
    if (typeof value === 'object') {
      if (
        value &&
        'constructor' in value &&
        value.constructor &&
        value.constructor.name !== 'Object'
      ) {
        return value.constructor.name;
      }
      return 'Object';
    }
    return typeof value;
  }

  /**
   * 生成调用链可视化HTML
   * @param sessionId 会话ID，不提供则使用当前会话
   * @returns HTML字符串
   */
  public generateVisualizationHtml(sessionId?: string): string {
    const targetSessionId = sessionId || this.currentSessionId;
    if (!targetSessionId) {
      return '<p>No active trace session</p>';
    }

    const session = this.sessions.get(targetSessionId);
    if (!session) {
      return `<p>Session not found: ${targetSessionId}</p>`;
    }

    // 生成基本统计信息
    const stats = `
      <div class="trace-stats">
        <div class="stat-item">
          <span class="stat-label">总调用:</span>
          <span class="stat-value">${session.totalCalls}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">错误:</span>
          <span class="stat-value" style="color: ${session.errorCalls > 0 ? 'red' : 'green'}">${
            session.errorCalls
          }</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">超时:</span>
          <span class="stat-value" style="color: ${
            session.timeoutCalls > 0 ? 'orange' : 'green'
          }">${session.timeoutCalls}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">总耗时:</span>
          <span class="stat-value">${
            session.endTime
              ? ((session.endTime - session.startTime) / 1000).toFixed(2) + 's'
              : '进行中...'
          }</span>
        </div>
      </div>
    `;

    // 生成调用链表格
    const tableRows = session.calls
      .map((call, index) => {
        const statusColor =
          call.status === 'error' ? 'red' : call.status === 'timeout' ? 'orange' : 'green';

        return `
        <tr>
          <td>${index + 1}</td>
          <td>${call.pluginName}</td>
          <td>${call.hookName}</td>
          <td>${call.duration.toFixed(2)}ms</td>
          <td style="color: ${statusColor}">${call.status}</td>
          <td>${call.error || ''}</td>
          <td>${call.paramTypes.join(', ')}</td>
          <td>${call.returnType || ''}</td>
        </tr>
      `;
      })
      .join('');

    // 生成完整HTML
    return `
      <div class="plugin-trace-visualization">
        <h3>插件调用链追踪 - 会话: ${targetSessionId}</h3>
        <p>开始时间: ${new Date(session.startTime).toLocaleString()}</p>
        ${stats}
        <table class="trace-table">
          <thead>
            <tr>
              <th>#</th>
              <th>插件</th>
              <th>钩子</th>
              <th>耗时(ms)</th>
              <th>状态</th>
              <th>错误</th>
              <th>参数类型</th>
              <th>返回类型</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>
      <style>
        .plugin-trace-visualization {
          font-family: Arial, sans-serif;
          padding: 15px;
          background-color: #f9f9f9;
          border-radius: 5px;
          max-width: 100%;
          overflow-x: auto;
        }
        .trace-stats {
          display: flex;
          gap: 20px;
          margin: 15px 0;
          background-color: #f0f0f0;
          padding: 10px;
          border-radius: 4px;
        }
        .stat-item {
          display: flex;
          flex-direction: column;
        }
        .stat-label {
          font-weight: bold;
          font-size: 12px;
        }
        .stat-value {
          font-size: 18px;
          font-weight: bold;
        }
        .trace-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 15px;
        }
        .trace-table th, .trace-table td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
        }
        .trace-table th {
          background-color: #f2f2f2;
          position: sticky;
          top: 0;
        }
        .trace-table tr:nth-child(even) {
          background-color: #f9f9f9;
        }
        .trace-table tr:hover {
          background-color: #f0f0f0;
        }
      </style>
    `;
  }

  /**
   * 生成调用链可视化图表数据
   * @param sessionId 会话ID，不提供则使用当前会话
   * @returns 图表数据
   */
  public generateVisualizationChartData(sessionId?: string): Record<string, unknown> {
    const targetSessionId = sessionId || this.currentSessionId;
    if (!targetSessionId) {
      return { error: 'No active trace session' };
    }

    const session = this.sessions.get(targetSessionId);
    if (!session) {
      return { error: `Session not found: ${targetSessionId}` };
    }

    // 按插件分组的钩子调用耗时
    const pluginDurations: Record<string, number> = {};
    const hookDurations: Record<string, number> = {};
    const hookCounts: Record<string, number> = {};

    // 计算各项统计数据
    for (const call of session.calls) {
      // 累加插件总耗时
      pluginDurations[call.pluginName] = (pluginDurations[call.pluginName] || 0) + call.duration;

      // 累加钩子总耗时
      hookDurations[call.hookName] = (hookDurations[call.hookName] || 0) + call.duration;

      // 累加钩子调用次数
      hookCounts[call.hookName] = (hookCounts[call.hookName] || 0) + 1;
    }

    // 直接创建和返回符合Record<string, unknown>的对象
    return {
      sessionId: targetSessionId,
      startTime: session.startTime,
      endTime: session.endTime,
      totalCalls: session.totalCalls,
      errorCalls: session.errorCalls,
      timeoutCalls: session.timeoutCalls,
      pluginDurations,
      hookDurations,
      hookCounts,
      // 用于时间轴的调用记录
      timeline: session.calls.map(call => ({
        timestamp: call.timestamp,
        pluginName: call.pluginName,
        hookName: call.hookName,
        duration: call.duration,
        status: call.status,
      })),
    };
  }
}
