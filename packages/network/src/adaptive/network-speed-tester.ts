/**
 * 网络测速器实现
 */
import { IEventEmitter, Logger } from '@file-chunk-uploader/core';

import { NETWORK_ADAPTIVE_LOG_CATEGORY } from '../utils/logger-categories';

/**
 * 测速结果接口
 */
export interface ISpeedTestResult {
  /** 下载速度(Kbps) */
  downloadSpeed: number;
  /** 上传速度(Kbps) */
  uploadSpeed: number;
  /** 延迟(毫秒) */
  latency: number;
  /** 测试时间戳 */
  timestamp: number;
}

/**
 * 测速事件
 */
export enum SpeedTestEvent {
  /** 测速开始 */
  START = 'speed-test:start',
  /** 测速结束 */
  COMPLETE = 'speed-test:complete',
  /** 测速错误 */
  ERROR = 'speed-test:error',
}

/**
 * 测速配置接口
 */
export interface ISpeedTestConfig {
  /** 测速URL */
  testUrl: string;
  /** 测速样本大小(字节) */
  sampleSize: number;
  /** 最大历史记录数 */
  maxHistorySize: number;
  /** 最小样本大小(字节) */
  minSampleSize: number;
  /** 最大样本大小(字节) */
  maxSampleSize: number;
  /** 网络质量阈值(Kbps) */
  qualityThresholds: {
    /** 极好网络带宽阈值 */
    excellent: number;
    /** 良好网络带宽阈值 */
    good: number;
    /** 一般网络带宽阈值 */
    fair: number;
    /** 较差网络带宽阈值 */
    poor: number;
  };
}

/**
 * 默认测速配置
 */
export const DEFAULT_SPEED_TEST_CONFIG: ISpeedTestConfig = {
  testUrl: '/speed-test',
  sampleSize: 200 * 1024, // 200KB
  maxHistorySize: 10,
  minSampleSize: 50 * 1024, // 50KB
  maxSampleSize: 1024 * 1024, // 1MB
  qualityThresholds: {
    excellent: 10000, // 10Mbps
    good: 5000, // 5Mbps
    fair: 2000, // 2Mbps
    poor: 500, // 500Kbps
  },
};

/**
 * 网络测速器
 * 用于测量当前网络的上传和下载速度
 */
export class NetworkSpeedTester {
  /** 事件发射器 */
  private eventEmitter: IEventEmitter;
  /** 日志记录器 */
  private logger?: Logger;
  /** 测试中标志 */
  private isTesting = false;
  /** 测速样本大小(字节) */
  private sampleSize: number;
  /** 测试URL */
  private testUrl: string;
  /** 历史测速结果 */
  private speedHistory: ISpeedTestResult[] = [];
  /** 最大历史记录数 */
  private maxHistorySize = 10;
  /** 测速配置 */
  private config: ISpeedTestConfig;

  /**
   * 构造函数
   * @param eventEmitter 事件发射器
   * @param config 测速配置或测试URL
   * @param sampleSize 测试样本大小(字节)，如果提供了config则忽略
   * @param logger 日志记录器
   */
  constructor(
    eventEmitter: IEventEmitter,
    config: Partial<ISpeedTestConfig> | string = DEFAULT_SPEED_TEST_CONFIG,
    sampleSize?: number,
    logger?: Logger,
  ) {
    this.eventEmitter = eventEmitter;
    this.logger = logger;

    // 处理配置
    if (typeof config === 'string') {
      this.config = { ...DEFAULT_SPEED_TEST_CONFIG };
      this.testUrl = config;
      this.sampleSize = sampleSize || this.config.sampleSize;
    } else {
      this.config = { ...DEFAULT_SPEED_TEST_CONFIG, ...config };
      this.testUrl = this.config.testUrl;
      this.sampleSize = this.config.sampleSize;
    }

    this.maxHistorySize = this.config.maxHistorySize;
  }

  /**
   * 测量网络延迟
   * @returns 延迟时间(毫秒)
   */
  private async measureLatency(): Promise<number> {
    try {
      const startTime = Date.now();

      // 发送HEAD请求测量延迟
      const response = await fetch(this.testUrl, {
        method: 'HEAD',
        cache: 'no-cache',
      });

      if (!response.ok) {
        throw new Error(`延迟测试失败: ${response.status} ${response.statusText}`);
      }

      const endTime = Date.now();
      const latency = endTime - startTime;

      this.logger?.debug(NETWORK_ADAPTIVE_LOG_CATEGORY, `网络延迟: ${latency}ms`);

      return latency;
    } catch (error) {
      this.logger?.error(
        NETWORK_ADAPTIVE_LOG_CATEGORY,
        `测量延迟出错: ${(error as Error).message}`,
      );
      return 0;
    }
  }

  /**
   * 测量下载速度
   * @returns 下载速度(Kbps)
   */
  private async measureDownloadSpeed(): Promise<number> {
    try {
      const startTime = Date.now();

      // 添加随机参数避免缓存
      const url = `${this.testUrl}?size=${this.sampleSize}&t=${Date.now()}`;

      // 发送GET请求测量下载速度
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-cache',
      });

      if (!response.ok) {
        throw new Error(`下载测速失败: ${response.status} ${response.statusText}`);
      }

      // 读取响应数据
      const data = await response.arrayBuffer();
      const endTime = Date.now();

      // 计算下载速度(Kbps)
      const duration = (endTime - startTime) / 1000; // 转换为秒
      const fileSizeInBits = data.byteLength * 8;
      const speedKbps = Math.round(fileSizeInBits / 1000 / duration);

      this.logger?.debug(
        NETWORK_ADAPTIVE_LOG_CATEGORY,
        `下载速度: ${speedKbps}Kbps (${Math.round(speedKbps / 1000)}Mbps)`,
      );

      return speedKbps;
    } catch (error) {
      this.logger?.error(
        NETWORK_ADAPTIVE_LOG_CATEGORY,
        `测量下载速度出错: ${(error as Error).message}`,
      );
      return 0;
    }
  }

  /**
   * 测量上传速度
   * @returns 上传速度(Kbps)
   */
  private async measureUploadSpeed(): Promise<number> {
    try {
      // 创建随机数据
      const data = new Uint8Array(this.sampleSize);
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.floor(Math.random() * 256);
      }

      const blob = new Blob([data]);
      const startTime = Date.now();

      // 发送POST请求测量上传速度
      const response = await fetch(this.testUrl, {
        method: 'POST',
        body: blob,
        cache: 'no-cache',
      });

      if (!response.ok) {
        throw new Error(`上传测速失败: ${response.status} ${response.statusText}`);
      }

      const endTime = Date.now();

      // 计算上传速度(Kbps)
      const duration = (endTime - startTime) / 1000; // 转换为秒
      const fileSizeInBits = data.length * 8;
      const speedKbps = Math.round(fileSizeInBits / 1000 / duration);

      this.logger?.debug(
        NETWORK_ADAPTIVE_LOG_CATEGORY,
        `上传速度: ${speedKbps}Kbps (${Math.round(speedKbps / 1000)}Mbps)`,
      );

      return speedKbps;
    } catch (error) {
      this.logger?.error(
        NETWORK_ADAPTIVE_LOG_CATEGORY,
        `测量上传速度出错: ${(error as Error).message}`,
      );
      return 0;
    }
  }

  /**
   * 动态调整测速样本大小
   * 根据网络速度调整样本大小，以优化测速过程
   * @param lastResult 上次测速结果
   */
  private adjustSampleSize(lastResult?: ISpeedTestResult): void {
    if (!lastResult) {
      // 没有历史结果，使用默认值
      return;
    }

    const { uploadSpeed } = lastResult;
    const { minSampleSize, maxSampleSize } = this.config;

    // 根据上传速度调整样本大小
    if (uploadSpeed >= this.config.qualityThresholds.excellent) {
      // 极好网络，使用较大样本
      this.sampleSize = Math.min(maxSampleSize, this.sampleSize * 1.5);
    } else if (uploadSpeed >= this.config.qualityThresholds.good) {
      // 良好网络，适当增加样本
      this.sampleSize = Math.min(maxSampleSize, this.sampleSize * 1.2);
    } else if (uploadSpeed <= this.config.qualityThresholds.poor) {
      // 较差网络，减小样本
      this.sampleSize = Math.max(minSampleSize, this.sampleSize * 0.5);
    } else if (uploadSpeed <= this.config.qualityThresholds.fair) {
      // 一般网络，略微减小样本
      this.sampleSize = Math.max(minSampleSize, this.sampleSize * 0.8);
    }

    // 确保样本大小在合理范围内
    this.sampleSize = Math.max(minSampleSize, Math.min(maxSampleSize, this.sampleSize));

    this.logger?.debug(
      NETWORK_ADAPTIVE_LOG_CATEGORY,
      `调整测速样本大小: ${Math.round(
        this.sampleSize / 1024,
      )}KB (基于上传速度: ${uploadSpeed}Kbps)`,
    );
  }

  /**
   * 执行网络测速
   * @param options 测速选项
   * @returns 测速结果
   */
  async runSpeedTest(options?: {
    adjustSampleSize?: boolean;
    sampleSize?: number;
  }): Promise<ISpeedTestResult> {
    if (this.isTesting) {
      this.logger?.warn(NETWORK_ADAPTIVE_LOG_CATEGORY, '测速已在进行中');
      throw new Error('测速已在进行中');
    }

    this.isTesting = true;

    // 应用临时样本大小
    const originalSampleSize = this.sampleSize;
    if (options?.sampleSize) {
      this.sampleSize = options.sampleSize;
    } else if (options?.adjustSampleSize !== false) {
      // 动态调整样本大小
      const latestResult = this.getLatestResult();
      if (latestResult) {
        this.adjustSampleSize(latestResult);
      }
    }

    try {
      this.eventEmitter.emit(SpeedTestEvent.START);
      this.logger?.info(
        NETWORK_ADAPTIVE_LOG_CATEGORY,
        `开始网络测速 (样本大小: ${Math.round(this.sampleSize / 1024)}KB)`,
      );

      // 测量延迟
      const latency = await this.measureLatency();

      // 测量下载速度
      const downloadSpeed = await this.measureDownloadSpeed();

      // 测量上传速度
      const uploadSpeed = await this.measureUploadSpeed();

      const result: ISpeedTestResult = {
        downloadSpeed,
        uploadSpeed,
        latency,
        timestamp: Date.now(),
      };

      // 添加到历史记录
      this.addToHistory(result);

      this.eventEmitter.emit(SpeedTestEvent.COMPLETE, result);
      this.logger?.info(
        NETWORK_ADAPTIVE_LOG_CATEGORY,
        `测速完成: 上传=${result.uploadSpeed}Kbps, 下载=${result.downloadSpeed}Kbps, 延迟=${result.latency}ms`,
      );

      return result;
    } catch (error) {
      this.eventEmitter.emit(SpeedTestEvent.ERROR, error);
      this.logger?.error(NETWORK_ADAPTIVE_LOG_CATEGORY, `测速失败: ${(error as Error).message}`);
      throw error;
    } finally {
      // 恢复原始样本大小
      if (options?.sampleSize) {
        this.sampleSize = originalSampleSize;
      }
      this.isTesting = false;
    }
  }

  /**
   * 添加测速结果到历史记录
   * @param result 测速结果
   */
  private addToHistory(result: ISpeedTestResult): void {
    this.speedHistory.push(result);

    // 保持历史记录不超过最大数量
    if (this.speedHistory.length > this.maxHistorySize) {
      this.speedHistory.shift();
    }
  }

  /**
   * 获取最近的测速结果
   * @returns 最近的测速结果，如果没有则返回null
   */
  getLatestResult(): ISpeedTestResult | null {
    if (this.speedHistory.length === 0) {
      return null;
    }

    return this.speedHistory[this.speedHistory.length - 1];
  }

  /**
   * 获取平均测速结果
   * @param count 用于计算平均值的最近结果数量
   * @returns 平均测速结果
   */
  getAverageResult(count: number = 3): ISpeedTestResult | null {
    if (this.speedHistory.length === 0) {
      return null;
    }

    // 获取最近的几条记录
    const recentResults = this.speedHistory.slice(-Math.min(count, this.speedHistory.length));

    // 计算平均值
    const avgResult: ISpeedTestResult = {
      downloadSpeed: 0,
      uploadSpeed: 0,
      latency: 0,
      timestamp: Date.now(),
    };

    recentResults.forEach(result => {
      avgResult.downloadSpeed += result.downloadSpeed;
      avgResult.uploadSpeed += result.uploadSpeed;
      avgResult.latency += result.latency;
    });

    avgResult.downloadSpeed = Math.round(avgResult.downloadSpeed / recentResults.length);
    avgResult.uploadSpeed = Math.round(avgResult.uploadSpeed / recentResults.length);
    avgResult.latency = Math.round(avgResult.latency / recentResults.length);

    return avgResult;
  }

  /**
   * 清除历史记录
   */
  clearHistory(): void {
    this.speedHistory = [];
    this.logger?.debug(NETWORK_ADAPTIVE_LOG_CATEGORY, '测速历史记录已清除');
  }

  /**
   * 获取测试状态
   * @returns 是否正在测试
   */
  isTestInProgress(): boolean {
    return this.isTesting;
  }

  /**
   * 设置测速配置
   * @param config 测速配置
   */
  setConfig(config: Partial<ISpeedTestConfig>): void {
    this.config = { ...this.config, ...config };

    // 更新相关属性
    if (config.testUrl) {
      this.testUrl = config.testUrl;
    }
    if (config.sampleSize) {
      this.sampleSize = config.sampleSize;
    }
    if (config.maxHistorySize) {
      this.maxHistorySize = config.maxHistorySize;

      // 如果历史记录超出新的最大值，裁剪历史记录
      if (this.speedHistory.length > this.maxHistorySize) {
        this.speedHistory = this.speedHistory.slice(-this.maxHistorySize);
      }
    }

    this.logger?.debug(
      NETWORK_ADAPTIVE_LOG_CATEGORY,
      `更新测速配置: 样本大小=${Math.round(this.sampleSize / 1024)}KB, URL=${this.testUrl}`,
    );
  }

  /**
   * 获取当前测速配置
   * @returns 当前测速配置
   */
  getConfig(): ISpeedTestConfig {
    return { ...this.config };
  }

  /**
   * 获取当前样本大小
   * @returns 当前样本大小(字节)
   */
  getSampleSize(): number {
    return this.sampleSize;
  }
}
