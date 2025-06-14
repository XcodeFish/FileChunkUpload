/**
 * 重试进度追踪器
 * 用于跟踪和管理重试任务的进度
 * @packageDocumentation
 */

import { RetryProgressInfo } from './retry-types';

/**
 * 重试任务进度信息
 * @internal
 */
interface TaskProgress {
  /** 任务ID */
  taskId: string;
  /** 当前重试次数 */
  currentRetry: number;
  /** 最大重试次数 */
  maxRetries: number;
  /** 成功次数 */
  successCount: number;
  /** 失败次数 */
  failCount: number;
  /** 任务是否已完成 */
  isCompleted: boolean;
  /** 分片索引（可选） */
  chunkIndex?: number;
}

/**
 * 重试统计信息
 */
export interface RetryStats {
  /** 总重试次数 */
  totalRetries: number;
  /** 总成功次数 */
  totalSuccesses: number;
  /** 总失败次数 */
  totalFailures: number;
  /** 成功率 (0-1) */
  successRate: number;
}

/**
 * 重试进度追踪器
 * 管理多个重试任务的进度信息
 */
export class ProgressTracker {
  /** 重试任务进度映射 */
  private taskProgresses = new Map<string, TaskProgress>();

  /** 全局重试统计 */
  private globalStats = {
    totalRetries: 0,
    totalSuccesses: 0,
    totalFailures: 0,
  };

  /**
   * 创建重试进度
   * 创建并跟踪新的重试任务进度
   *
   * @param taskId 任务ID
   * @param currentRetry 当前重试次数
   * @param maxRetries 最大重试次数
   * @param chunkIndex 分片索引（可选）
   * @returns 重试进度信息
   */
  createProgress(
    taskId: string,
    currentRetry: number,
    maxRetries: number,
    chunkIndex?: number,
  ): RetryProgressInfo {
    // 创建任务进度
    const taskProgress: TaskProgress = {
      taskId,
      currentRetry,
      maxRetries,
      successCount: 0,
      failCount: 0,
      isCompleted: false,
      chunkIndex,
    };

    // 保存任务进度
    this.taskProgresses.set(taskId, taskProgress);

    // 更新全局统计
    this.globalStats.totalRetries++;

    // 返回进度信息
    return this.createProgressInfo(taskProgress);
  }

  /**
   * 更新重试进度
   * 更新现有重试任务的进度信息
   *
   * @param taskId 任务ID
   * @param currentRetry 当前重试次数
   * @returns 更新后的进度信息或null（如果任务不存在）
   */
  updateProgress(taskId: string, currentRetry: number): RetryProgressInfo | null {
    const taskProgress = this.taskProgresses.get(taskId);
    if (!taskProgress) {
      return null;
    }

    // 更新当前重试次数
    taskProgress.currentRetry = currentRetry;

    // 返回更新后的进度信息
    return this.createProgressInfo(taskProgress);
  }

  /**
   * 获取重试进度
   * 获取指定任务的进度信息
   *
   * @param taskId 任务ID
   * @returns 进度信息或null（如果任务不存在）
   */
  getProgress(taskId: string): RetryProgressInfo | null {
    const taskProgress = this.taskProgresses.get(taskId);
    if (!taskProgress) {
      return null;
    }
    return this.createProgressInfo(taskProgress);
  }

  /**
   * 完成重试任务
   * 标记任务为已完成并更新统计
   *
   * @param taskId 任务ID
   * @param success 是否成功
   * @returns 最终的进度信息或null（如果任务不存在）
   */
  completeTask(taskId: string, success: boolean): RetryProgressInfo | null {
    const taskProgress = this.taskProgresses.get(taskId);
    if (!taskProgress) {
      return null;
    }

    // 更新任务状态
    taskProgress.isCompleted = true;
    if (success) {
      taskProgress.successCount++;
      this.globalStats.totalSuccesses++;
    } else {
      taskProgress.failCount++;
      this.globalStats.totalFailures++;
    }

    // 返回最终进度信息
    return this.createProgressInfo(taskProgress);
  }

  /**
   * 标记任务失败
   * 增加任务的失败计数
   *
   * @param taskId 任务ID
   * @returns 更新后的进度信息或null（如果任务不存在）
   */
  markFailed(taskId: string): RetryProgressInfo | null {
    const taskProgress = this.taskProgresses.get(taskId);
    if (!taskProgress) {
      return null;
    }

    // 增加失败计数
    taskProgress.failCount++;

    // 返回更新后的进度信息
    return this.createProgressInfo(taskProgress);
  }

  /**
   * 获取全局重试统计
   *
   * @returns 重试统计信息
   */
  getStats(): RetryStats {
    const { totalRetries, totalSuccesses, totalFailures } = this.globalStats;
    return {
      totalRetries,
      totalSuccesses,
      totalFailures,
      successRate: totalRetries > 0 ? totalSuccesses / totalRetries : 0,
    };
  }

  /**
   * 清除所有进度信息
   * 重置追踪器状态
   */
  clear(): void {
    this.taskProgresses.clear();
    this.globalStats = {
      totalRetries: 0,
      totalSuccesses: 0,
      totalFailures: 0,
    };
  }

  /**
   * 根据任务进度创建进度信息对象
   *
   * @param taskProgress 任务进度
   * @returns 进度信息
   * @private
   */
  private createProgressInfo(taskProgress: TaskProgress): RetryProgressInfo {
    const { currentRetry, maxRetries, successCount, failCount, isCompleted, chunkIndex } =
      taskProgress;
    const totalAttempts = successCount + failCount + (isCompleted ? 0 : 1);
    const percentage = Math.min(100, Math.round((currentRetry / maxRetries) * 100));
    const isLastAttempt = currentRetry >= maxRetries;

    return {
      currentRetry,
      maxRetries,
      percentage,
      isLastAttempt,
      isCompleted,
      chunkIndex,
      stats: {
        successCount,
        failCount,
        totalAttempts,
      },
    };
  }
}

/**
 * 创建进度追踪器
 * 工厂函数，创建并返回一个新的进度追踪器
 *
 * @returns 进度追踪器实例
 */
export function createProgressTracker(): ProgressTracker {
  return new ProgressTracker();
}
