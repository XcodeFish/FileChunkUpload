/**
 * 事件发射器接口
 * 定义事件处理功能
 */

export interface IEventEmitter {
  on(event: string, callback: (...args: any[]) => void): () => void;
  once(event: string, callback: (...args: any[]) => void): () => void;
  off(event: string, callback: (...args: any[]) => void): void;
  removeAllListeners(event?: string): void;
  emit(event: string, ...args: any[]): boolean;
  listenerCount(event: string): number;
  listeners(event: string): ((...args: any[]) => void)[];
}

/**
 * 事件发射器实现
 */
export class EventEmitter implements IEventEmitter {
  private events: Record<string, Array<{ callback: (...args: any[]) => void; once: boolean }>> = {};

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
}
