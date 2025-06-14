/**
 * 倒计时管理器
 * 用于管理重试任务的倒计时功能
 * @packageDocumentation
 */

import { RetryCountdownInfo } from './retry-types';

/**
 * 倒计时任务信息
 */
interface CountdownTask {
  /** 任务ID */
  taskId: string;
  /** 开始时间戳 */
  startTimestamp: number;
  /** 总延迟时间 */
  totalDelay: number;
  /** 预期执行时间戳 */
  expectedExecutionTimestamp: number;
  /** 是否已暂停 */
  isPaused: boolean;
  /** 是否已完成 */
  isCompleted: boolean;
  /** 更新回调 */
  onUpdate?: (info: RetryCountdownInfo) => void;
}

/**
 * 倒计时管理器类
 * 管理所有重试任务的倒计时，提供倒计时信息
 */
export class CountdownManager {
  /** 倒计时任务映射 */
  private countdowns = new Map<string, CountdownTask>();

  /** 更新间隔（毫秒） */
  private updateInterval: number;

  /** 更新计时器ID */
  private updateTimerId: number | null = null;

  /** 是否已启动 */
  private isRunning = false;

  /**
   * 构造函数
   * @param options 配置选项
   * @param options.updateInterval 更新间隔（毫秒），默认200ms
   */
  constructor(options: { updateInterval?: number } = {}) {
    this.updateInterval = options.updateInterval || 200;
    this.start();
  }

  /**
   * 创建倒计时
   * 创建并启动一个倒计时任务
   *
   * @param taskId 任务ID
   * @param totalDelay 总延迟时间（毫秒）
   * @param onUpdate 倒计时更新回调
   * @returns 倒计时信息
   */
  createCountdown(
    taskId: string,
    totalDelay: number,
    onUpdate?: (info: RetryCountdownInfo) => void,
  ): RetryCountdownInfo {
    const now = Date.now();
    const task: CountdownTask = {
      taskId,
      startTimestamp: now,
      totalDelay,
      expectedExecutionTimestamp: now + totalDelay,
      isPaused: false,
      isCompleted: false,
      onUpdate,
    };

    this.countdowns.set(taskId, task);

    if (!this.isRunning) {
      this.start();
    }

    // 立即返回初始状态
    return this.getCountdownInfo(task);
  }

  /**
   * 暂停倒计时
   * 暂停指定任务的倒计时
   *
   * @param taskId 任务ID
   * @returns 是否成功暂停
   */
  pauseCountdown(taskId: string): boolean {
    const task = this.countdowns.get(taskId);
    if (!task || task.isCompleted) {
      return false;
    }

    task.isPaused = true;
    return true;
  }

  /**
   * 恢复倒计时
   * 恢复指定任务的倒计时
   *
   * @param taskId 任务ID
   * @returns 是否成功恢复
   */
  resumeCountdown(taskId: string): boolean {
    const task = this.countdowns.get(taskId);
    if (!task || task.isCompleted) {
      return false;
    }

    task.isPaused = false;
    return true;
  }

  /**
   * 完成倒计时
   * 标记指定任务的倒计时为已完成
   *
   * @param taskId 任务ID
   * @returns 是否成功完成
   */
  completeCountdown(taskId: string): boolean {
    const task = this.countdowns.get(taskId);
    if (!task) {
      return false;
    }

    task.isCompleted = true;

    // 触发一次最终更新
    if (task.onUpdate) {
      const info = this.getCountdownInfo(task);
      task.onUpdate(info);
    }

    // 一段时间后清理任务
    setTimeout(() => {
      this.countdowns.delete(taskId);

      // 如果没有更多任务，停止更新循环
      if (this.countdowns.size === 0) {
        this.stop();
      }
    }, 1000);

    return true;
  }

  /**
   * 获取倒计时信息
   * 获取指定任务的倒计时信息
   *
   * @param taskId 任务ID
   * @returns 倒计时信息
   */
  getCountdown(taskId: string): RetryCountdownInfo | null {
    const task = this.countdowns.get(taskId);
    if (!task) {
      return null;
    }

    return this.getCountdownInfo(task);
  }

  /**
   * 启动倒计时更新循环
   * 开始定期更新所有倒计时任务
   */
  private start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.update();
  }

  /**
   * 停止倒计时更新循环
   * 停止定期更新所有倒计时任务
   */
  private stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.updateTimerId !== null) {
      clearTimeout(this.updateTimerId);
      this.updateTimerId = null;
    }
  }

  /**
   * 更新所有倒计时任务
   * 定期计算和通知所有倒计时任务的状态
   */
  private update(): void {
    const now = Date.now();

    // 更新所有倒计时
    for (const task of this.countdowns.values()) {
      if (task.isCompleted || task.isPaused) {
        continue;
      }

      // 检查是否已到期
      if (now >= task.expectedExecutionTimestamp) {
        task.isCompleted = true;
      }

      // 通知更新
      if (task.onUpdate) {
        const info = this.getCountdownInfo(task);
        task.onUpdate(info);
      }
    }

    // 安排下一次更新
    this.updateTimerId = window.setTimeout(() => {
      this.update();
    }, this.updateInterval);
  }

  /**
   * 计算任务的倒计时信息
   *
   * @param task 倒计时任务
   * @returns 倒计时信息
   */
  private getCountdownInfo(task: CountdownTask): RetryCountdownInfo {
    const now = Date.now();
    const elapsed = now - task.startTimestamp;
    const remainingTime = Math.max(0, task.totalDelay - elapsed);
    const progressPercentage = Math.min(100, (elapsed / task.totalDelay) * 100);

    return {
      taskId: task.taskId,
      remainingTime,
      totalDelay: task.totalDelay,
      progressPercentage,
      isPaused: task.isPaused,
      isCompleted: task.isCompleted,
      expectedExecutionTime: task.expectedExecutionTimestamp,
    };
  }

  /**
   * 清理资源
   * 取消所有倒计时任务，释放资源
   */
  cleanup(): void {
    this.stop();
    this.countdowns.clear();
  }
}

/**
 * 创建倒计时管理器
 * 工厂函数，创建并返回一个新的倒计时管理器
 *
 * @param options 配置选项
 * @param options.updateInterval 更新间隔（毫秒），默认200ms
 * @returns 倒计时管理器实例
 */
export function createCountdownManager(options?: { updateInterval?: number }): CountdownManager {
  return new CountdownManager(options);
}
