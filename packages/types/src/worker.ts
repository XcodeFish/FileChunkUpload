/**
 * Worker相关类型定义
 * 包含Worker池和任务类型
 */

/**
 * Worker任务类型枚举
 */
export enum WorkerTaskType {
  /** 哈希计算 */
  HASH = 'hash',
  /** 分片创建 */
  CHUNK = 'chunk',
  /** 内容扫描 */
  SCAN = 'scan',
  /** 加密 */
  ENCRYPT = 'encrypt',
  /** 解密 */
  DECRYPT = 'decrypt',
  /** 压缩 */
  COMPRESS = 'compress',
  /** 解压 */
  DECOMPRESS = 'decompress',
  /** 图像处理 */
  IMAGE = 'image',
}

/**
 * Worker任务接口
 */
export interface IWorkerTask {
  /** 任务ID */
  id: string;
  /** 任务类型 */
  type: WorkerTaskType | string;
  /** 任务负载 */
  payload: any;
  /** 任务创建时间 */
  createdAt: number;
  /** 任务开始时间 */
  startedAt?: number;
  /** 任务完成时间 */
  completedAt?: number;
  /** 任务优先级 */
  priority?: number;
  /** 结果回调 */
  resolve?: (result: any) => void;
  /** 错误回调 */
  reject?: (error: Error) => void;
  /** 任务状态 */
  status: 'pending' | 'processing' | 'completed' | 'failed';
  /** 任务错误 */
  error?: Error;
  /** 任务结果 */
  result?: any;
  /** 是否转移所有权 */
  transferOwnership?: boolean;
  /** 可转移对象列表 */
  transferList?: Transferable[];
  /** 任务超时（毫秒） */
  timeout?: number;
  /** 是否已超时 */
  timedOut?: boolean;
  /** 超时处理器ID */
  timeoutId?: any;
}

/**
 * Worker池接口
 */
export interface IWorkerPool {
  /** 创建并初始化Worker池 */
  initialize(poolSize: number): void;
  /** 提交哈希计算任务 */
  calculateHash(file: File, algorithm?: string): Promise<string>;
  /** 提交分片创建任务 */
  createChunks(file: File, chunkSize: number): Promise<Blob[]>;
  /** 提交任务 */
  scheduleTask<T = any>(task: Partial<IWorkerTask>): Promise<T>;
  /** 终止任务 */
  terminateTask(taskId: string): void;
  /** 终止所有任务 */
  terminateAllTasks(): void;
  /** 终止并销毁Worker池 */
  terminate(): void;
  /** 获取Worker池状态 */
  getStatus(): IWorkerPoolStatus;
  /** 是否支持Web Worker */
  isSupported(): boolean;
  /** 重置Worker池 */
  reset(): void;
  /** 调整Worker池大小 */
  resize(newSize: number): void;
}

/**
 * Worker池状态接口
 */
export interface IWorkerPoolStatus {
  /** Worker总数 */
  totalWorkers: number;
  /** 活跃Worker数 */
  activeWorkers: number;
  /** 待处理任务数 */
  pendingTasks: number;
  /** 已完成任务数 */
  completedTasks: number;
  /** 失败任务数 */
  failedTasks: number;
  /** 是否已初始化 */
  initialized: boolean;
  /** 是否支持Web Worker */
  supported: boolean;
  /** 当前CPU使用率 */
  cpuUsage?: number;
  /** 当前内存使用 */
  memoryUsage?: number;
}

/**
 * Worker消息接口
 */
export interface IWorkerMessage {
  /** 消息类型 */
  type: 'task' | 'result' | 'error' | 'init' | 'ready' | 'status';
  /** 任务ID */
  taskId?: string;
  /** 任务类型 */
  taskType?: WorkerTaskType | string;
  /** 数据载荷 */
  payload?: any;
  /** 错误信息 */
  error?: {
    /** 错误消息 */
    message: string;
    /** 错误名称 */
    name: string;
    /** 错误堆栈 */
    stack?: string;
    /** 错误代码 */
    code?: string;
  };
  /** 可转移对象列表索引 */
  transferListIndices?: number[];
  /** 消息时间戳 */
  timestamp: number;
}

/**
 * Worker配置接口
 */
export interface IWorkerConfig {
  /** Worker池大小 */
  poolSize?: number;
  /** 是否懒加载 */
  lazyInit?: boolean;
  /** 任务超时（毫秒） */
  taskTimeout?: number;
  /** 是否使用共享Worker */
  useSharedWorker?: boolean;
  /** Worker脚本URL */
  workerUrl?: string;
  /** Worker类型（module或classic） */
  workerType?: 'module' | 'classic';
  /** 自动终止时间（毫秒），0表示不自动终止 */
  autoTerminateTime?: number;
  /** 是否启用降级处理 */
  enableFallback?: boolean;
  /** Worker初始化超时（毫秒） */
  initTimeout?: number;
  /** Worker心跳间隔（毫秒） */
  heartbeatInterval?: number;
  /** 是否在错误时重启Worker */
  restartOnError?: boolean;
}

/**
 * 哈希任务负载接口
 */
export interface IHashTaskPayload {
  /** 文件对象或ArrayBuffer */
  file: File | ArrayBuffer;
  /** 哈希算法 */
  algorithm: string;
  /** 是否使用流式处理 */
  streaming?: boolean;
  /** 流式处理块大小 */
  chunkSize?: number;
}

/**
 * 分片任务负载接口
 */
export interface IChunkTaskPayload {
  /** 文件对象或ArrayBuffer */
  file: File | ArrayBuffer;
  /** 分片大小 */
  chunkSize: number;
  /** 分片索引基数（0或1） */
  indexBase?: 0 | 1;
  /** 是否包含最后一个可能较小的分片 */
  includeLastChunk?: boolean;
}
