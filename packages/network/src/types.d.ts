/**
 * 类型声明文件
 */

declare module '@file-chunk-uploader/core' {
  // 重新导出所需的类型
  export interface IEventEmitter {
    on<T>(eventName: string, handler: (data: T) => void, options?: any): this;
    once<T>(eventName: string, handler: (data: T) => void, options?: any): this;
    off(eventName: string, handler?: (data: unknown) => void): this;
    emit<T>(eventName: string, data?: T, options?: any): Promise<void>;
    emitSync<T>(eventName: string, data?: T, options?: any): void;
    hasListeners(eventName: string): boolean;
  }

  export class Logger {
    debug(category: string, message: string, data?: any): void;
    info(category: string, message: string, data?: any): void;
    warn(category: string, message: string, data?: any): void;
    error(category: string, message: string, data?: any): void;
  }
}
