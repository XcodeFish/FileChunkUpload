/**
 * 重试任务管理器
 * 负责管理重试任务队列和任务执行
 * @packageDocumentation
 */

import { CountdownManager } from './countdown-manager';
import { ProgressTracker } from './progress-tracker';
import { RetryDecisionMaker, createRetryDecisionMaker } from './retry-decision';
import { RetryTask, RetryProgressInfo } from './retry-types';

/**
 * 重试任务管理器选项
 */
export interface RetryTaskManagerOptions {
  /**
   * 倒计时管理器
   */
  countdownManager: CountdownManager;

  /**
   * 进度追踪器
   */
  progressTracker: ProgressTracker;

  /**
   * 决策器
   */
  decisionMaker: RetryDecisionMaker;
}

/**
 * 重试任务管理器类
 * 管理重试任务的创建、调度和执行
 */
export class RetryTaskManager {
  /**
   * 重试任务队列
   * 存储所有待执行的重试任务
   */
  private retryTasks: Map<string, RetryTask> = new Map();

  /**
   * 重试定时器ID
   * 用于取消计划中的重试任务
   */
  private retryTimers: Map<string, number> = new Map();

  /**
   * 倒计时管理器
   * 用于管理重试任务的倒计时
   */
  private countdownManager: CountdownManager;

  /**
   * 进度追踪器
   * 用于跟踪重试任务进度
   */
  private progressTracker: ProgressTracker;

  /**
   * 重试决策器
   * 用于决定是否重试和计算延迟
   */
  private decisionMaker: RetryDecisionMaker;

  /**
   * 事件回调函数
   * 用于通知任务状态变化
   */
  private callbacks: {
    onTaskComplete?: (task: RetryTask, success: boolean) => void;
    onTaskScheduled?: (task: RetryTask) => void;
  } = {};

  /**
   * 构造函数
   * @param options 重试任务管理器选项
   */
  constructor(options: RetryTaskManagerOptions) {
    this.countdownManager = options.countdownManager;
    this.progressTracker = options.progressTracker;
    this.decisionMaker = options.decisionMaker;
  }

  /**
   * 设置事件回调
   * @param callbacks 回调函数对象
   */
  setCallbacks(callbacks: {
    onTaskComplete?: (task: RetryTask, success: boolean) => void;
    onTaskScheduled?: (task: RetryTask) => void;
  }): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * 添加重试任务
   * @param task 重试任务
   * @param executeHandler 任务执行处理函数
   */
  addTask(task: RetryTask, executeHandler: (task: RetryTask) => Promise<void>): void {
    // 保存任务
    this.retryTasks.set(task.id, task);

    // 设置延迟执行定时器
    const timerId = window.setTimeout(() => {
      this.executeTask(task, executeHandler);
      this.retryTimers.delete(task.id);
    }, task.delay);

    // 保存定时器ID，以便在需要时可以取消
    this.retryTimers.set(task.id, timerId);
  }

  /**
   * 执行任务
   * @param task 重试任务
   * @param executeHandler 任务执行处理函数
   */
  private async executeTask(
    task: RetryTask,
    executeHandler: (task: RetryTask) => Promise<void>,
  ): Promise<void> {
    // 检查任务是否已处理
    if (task.handled) {
      return;
    }

    // 标记任务为已处理
    task.handled = true;

    try {
      // 执行任务处理函数
      await executeHandler(task);
    } finally {
      // 清理任务资源
      this.cleanupTask(task.id);
    }
  }

  /**
   * 清理任务资源
   * @param taskId 任务ID
   */
  private cleanupTask(taskId: string): void {
    // 从任务队列中移除
    this.retryTasks.delete(taskId);

    // 清除定时器
    if (this.retryTimers.has(taskId)) {
      clearTimeout(this.retryTimers.get(taskId));
      this.retryTimers.delete(taskId);
    }
  }

  /**
   * 处理等待中的重试任务
   * 检查所有任务，执行已到执行时间的任务
   */
  processWaitingTasks(): void {
    const now = Date.now();
    const tasksToExecute: RetryTask[] = [];

    // 找出所有可以执行的任务
    this.retryTasks.forEach(task => {
      if (!task.handled && task.scheduledTime <= now) {
        tasksToExecute.push(task);
      }
    });

    // 执行任务
    tasksToExecute.forEach(task => {
      this.cleanupTask(task.id);
      task.handled = true;
      // 这里不能直接执行，因为没有executeHandler
      // 只能触发一个事件，让外部处理
      const event = new CustomEvent('task:execute', { detail: task });
      window.dispatchEvent(event);
    });
  }

  /**
   * 根据文件ID和分片索引查找任务ID
   * @param fileId 文件ID
   * @param chunkIndex 分片索引
   * @returns 任务ID，如果未找到则返回undefined
   */
  findTaskIdByFileId(fileId: string, chunkIndex?: number): string | undefined {
    for (const [id, task] of this.retryTasks.entries()) {
      if (task.fileId === fileId && (chunkIndex === undefined || task.chunkIndex === chunkIndex)) {
        return id;
      }
    }
    return undefined;
  }

  /**
   * 获取任务进度信息
   * @param taskId 任务ID
   * @returns 进度信息
   */
  getTaskProgress(taskId: string): RetryProgressInfo | undefined {
    const progress = this.progressTracker.getProgress(taskId);
    return progress || undefined;
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    // 清除所有定时器
    this.retryTimers.forEach(timerId => {
      clearTimeout(timerId);
    });

    // 清空任务队列和定时器
    this.retryTasks.clear();
    this.retryTimers.clear();
  }

  /**
   * 获取所有活动的重试任务
   * @returns 活动的重试任务数组
   */
  getActiveTasks(): RetryTask[] {
    return Array.from(this.retryTasks.values());
  }
}

/**
 * 创建重试任务管理器
 * @param options 重试任务管理器选项
 * @returns 重试任务管理器实例
 */
export function createRetryTaskManager(
  options?: Partial<RetryTaskManagerOptions>,
  decisionMaker?: RetryDecisionMaker,
): RetryTaskManager {
  const countdownManager = options?.countdownManager || new CountdownManager();
  const progressTracker = options?.progressTracker || new ProgressTracker();
  const retryDecisionMaker =
    options?.decisionMaker || decisionMaker || createRetryDecisionMaker({});

  return new RetryTaskManager({
    countdownManager,
    progressTracker,
    decisionMaker: retryDecisionMaker,
  });
}
