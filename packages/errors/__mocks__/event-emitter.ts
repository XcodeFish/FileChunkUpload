/**
 * 简单的事件发射器模拟实现
 */
export class EventEmitter {
  private events: Record<string, Array<{ callback: (...args: any[]) => void; once: boolean }>> = {};
  private eventLog: Record<string, any[]> = {};

  /**
   * 监听事件
   */
  on(event: string, callback: (...args: any[]) => void): () => void {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push({ callback, once: false });
    return () => this.off(event, callback);
  }

  /**
   * 监听一次性事件
   */
  once(event: string, callback: (...args: any[]) => void): () => void {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push({ callback, once: true });
    return () => this.off(event, callback);
  }

  /**
   * 移除事件监听器
   */
  off(event: string, callback: (...args: any[]) => void): void {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter(listener => listener.callback !== callback);
  }

  /**
   * 移除所有事件监听器
   */
  removeAllListeners(event?: string): void {
    if (event) {
      delete this.events[event];
    } else {
      this.events = {};
    }
  }

  /**
   * 触发事件
   */
  emit(event: string, ...args: any[]): boolean {
    // 记录事件以便测试验证
    if (!this.eventLog[event]) {
      this.eventLog[event] = [];
    }
    this.eventLog[event].push(...args);

    if (!this.events[event]) return false;

    const listeners = [...this.events[event]];
    for (const listener of listeners) {
      try {
        listener.callback(...args);
      } catch (e) {
        console.error(`Error in event listener for ${event}:`, e);
      }

      if (listener.once) {
        this.off(event, listener.callback);
      }
    }
    return true;
  }

  /**
   * 获取事件监听器数量
   */
  listenerCount(event: string): number {
    return this.events[event]?.length || 0;
  }

  /**
   * 获取所有监听特定事件的监听器
   */
  listeners(event: string): ((...args: any[]) => void)[] {
    return this.events[event]?.map(listener => listener.callback) || [];
  }

  /**
   * 获取已记录的事件（用于测试验证）
   */
  getEvents(event: string): any[] {
    return this.eventLog[event] || [];
  }

  /**
   * 清除事件日志（用于测试重置）
   */
  clearEventLog(): void {
    this.eventLog = {};
  }
}
