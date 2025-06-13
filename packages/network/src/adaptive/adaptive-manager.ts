/**
 * 自适应网络管理器实现
 */
import { IEventEmitter, Logger } from '@file-chunk-uploader/core';

import { NETWORK_ADAPTIVE_LOG_CATEGORY } from '../utils/logger-categories';

import { DEFAULT_ADAPTIVE_CONFIG, IAdaptiveConfig, NetworkQualityLevel } from './adaptive-config';
import { ISpeedTestResult, NetworkSpeedTester, SpeedTestEvent } from './network-speed-tester';

/**
 * 自适应参数接口
 */
export interface IAdaptiveParams {
  /** 并发连接数 */
  concurrency: number;
  /** 分片大小(字节) */
  chunkSize: number;
  /** 最大重试次数 */
  maxRetries: number;
  /** 网络质量等级 */
  networkQuality: NetworkQualityLevel;
}

/**
 * 自适应事件
 */
export enum AdaptiveEvent {
  /** 参数调整 */
  PARAMS_ADJUSTED = 'adaptive:params-adjusted',
  /** 网络质量变化 */
  QUALITY_CHANGED = 'adaptive:quality-changed',
}

/**
 * 网络质量参数映射接口
 */
interface IQualityParamsMapping {
  concurrency: number;
  chunkSize: number;
  maxRetries: number;
}

/**
 * 自适应网络管理器
 * 根据网络状况动态调整上传参数
 */
export class AdaptiveManager {
  /** 配置 */
  private config: IAdaptiveConfig;
  /** 事件发射器 */
  private eventEmitter: IEventEmitter;
  /** 日志记录器 */
  private logger?: Logger;
  /** 网络测速器 */
  private speedTester: NetworkSpeedTester;
  /** 当前网络质量 */
  private currentQuality: NetworkQualityLevel = NetworkQualityLevel.GOOD;
  /** 当前自适应参数 */
  private currentParams: IAdaptiveParams;
  /** 调整计时器ID */
  private adjustmentTimerId?: number;
  /** 测速计时器ID */
  private speedTestTimerId?: number;

  /**
   * 构造函数
   * @param config 自适应配置
   * @param eventEmitter 事件发射器
   * @param logger 日志记录器
   * @param speedTestUrl 测速URL
   */
  constructor(
    config: Partial<IAdaptiveConfig> = {},
    eventEmitter: IEventEmitter,
    logger?: Logger,
    speedTestUrl: string = '/speed-test',
  ) {
    this.config = { ...DEFAULT_ADAPTIVE_CONFIG, ...config };
    this.eventEmitter = eventEmitter;
    this.logger = logger;

    // 初始化网络测速器
    this.speedTester = new NetworkSpeedTester(
      eventEmitter,
      speedTestUrl,
      this.config.speedTest.sampleSize,
      logger,
    );

    // 初始化当前参数为默认值
    this.currentParams = {
      concurrency: this.config.concurrency.default,
      chunkSize: this.config.chunkSize.default,
      maxRetries: this.config.retry.maxRetriesForGoodNetwork,
      networkQuality: NetworkQualityLevel.GOOD,
    };

    // 注册测速事件监听
    this.registerSpeedTestEvents();
  }

  /**
   * 注册测速事件监听
   */
  private registerSpeedTestEvents(): void {
    this.eventEmitter.on(SpeedTestEvent.COMPLETE, this.handleSpeedTestComplete.bind(this));
    this.eventEmitter.on(SpeedTestEvent.ERROR, this.handleSpeedTestError.bind(this));
  }

  /**
   * 处理测速完成事件
   * @param result 测速结果
   */
  private handleSpeedTestComplete(result: ISpeedTestResult): void {
    // 根据测速结果更新网络质量
    this.updateNetworkQuality(result);

    // 调整参数
    this.adjustParameters();
  }

  /**
   * 处理测速错误事件
   * @param error 错误对象
   */
  private handleSpeedTestError(error: Error): void {
    this.logger?.warn(NETWORK_ADAPTIVE_LOG_CATEGORY, `测速失败，保持当前参数: ${error.message}`);
  }

  /**
   * 更新网络质量等级
   * @param result 测速结果
   */
  private updateNetworkQuality(result: ISpeedTestResult): void {
    // 使用上传速度作为主要指标，因为上传是我们的主要场景
    const uploadSpeed = result.uploadSpeed;
    let newQuality: NetworkQualityLevel;

    if (uploadSpeed === 0) {
      newQuality = NetworkQualityLevel.OFFLINE;
    } else if (uploadSpeed >= this.config.qualityThresholds.excellent) {
      newQuality = NetworkQualityLevel.EXCELLENT;
    } else if (uploadSpeed >= this.config.qualityThresholds.good) {
      newQuality = NetworkQualityLevel.GOOD;
    } else if (uploadSpeed >= this.config.qualityThresholds.fair) {
      newQuality = NetworkQualityLevel.FAIR;
    } else if (uploadSpeed >= this.config.qualityThresholds.poor) {
      newQuality = NetworkQualityLevel.POOR;
    } else {
      newQuality = NetworkQualityLevel.BAD;
    }

    // 如果网络质量发生变化，触发事件
    if (newQuality !== this.currentQuality) {
      const oldQuality = this.currentQuality;
      this.currentQuality = newQuality;

      this.logger?.info(
        NETWORK_ADAPTIVE_LOG_CATEGORY,
        `网络质量变化: ${oldQuality} -> ${newQuality} (上传速度: ${uploadSpeed}Kbps)`,
      );

      this.eventEmitter.emit(AdaptiveEvent.QUALITY_CHANGED, {
        oldQuality,
        newQuality,
        uploadSpeed,
        downloadSpeed: result.downloadSpeed,
        latency: result.latency,
      });
    }
  }

  /**
   * 调整上传参数
   */
  private adjustParameters(): void {
    if (!this.config.enabled) {
      return;
    }

    const oldParams = { ...this.currentParams };

    // 使用参数映射表简化逻辑
    const qualityParamsMap = this.getQualityParamsMapping();
    const mappingForQuality = qualityParamsMap[this.currentQuality];

    if (mappingForQuality) {
      this.currentParams.concurrency = mappingForQuality.concurrency;
      this.currentParams.chunkSize = mappingForQuality.chunkSize;
      this.currentParams.maxRetries = mappingForQuality.maxRetries;
    }

    // 更新网络质量
    this.currentParams.networkQuality = this.currentQuality;

    // 如果参数发生变化，触发事件
    if (
      oldParams.concurrency !== this.currentParams.concurrency ||
      oldParams.chunkSize !== this.currentParams.chunkSize ||
      oldParams.maxRetries !== this.currentParams.maxRetries
    ) {
      this.logger?.info(
        NETWORK_ADAPTIVE_LOG_CATEGORY,
        `参数调整: 并发=${oldParams.concurrency}->${this.currentParams.concurrency}, ` +
          `分片大小=${oldParams.chunkSize}->${this.currentParams.chunkSize}, ` +
          `最大重试=${oldParams.maxRetries}->${this.currentParams.maxRetries}`,
      );

      this.eventEmitter.emit(AdaptiveEvent.PARAMS_ADJUSTED, {
        oldParams,
        newParams: { ...this.currentParams },
        networkQuality: this.currentQuality,
      });
    }
  }

  /**
   * 获取网络质量参数映射表
   * @returns 网络质量参数映射表
   */
  private getQualityParamsMapping(): Record<NetworkQualityLevel, IQualityParamsMapping> {
    const { concurrency, chunkSize, retry } = this.config;

    return {
      [NetworkQualityLevel.EXCELLENT]: {
        concurrency: concurrency.max,
        chunkSize: chunkSize.max,
        maxRetries: retry.maxRetriesForGoodNetwork,
      },
      [NetworkQualityLevel.GOOD]: {
        concurrency: Math.floor((concurrency.max + concurrency.default) / 2),
        chunkSize: Math.floor((chunkSize.max + chunkSize.default) / 2),
        maxRetries: retry.maxRetriesForGoodNetwork,
      },
      [NetworkQualityLevel.FAIR]: {
        concurrency: concurrency.default,
        chunkSize: chunkSize.default,
        maxRetries: retry.maxRetriesForGoodNetwork,
      },
      [NetworkQualityLevel.POOR]: {
        concurrency: Math.floor((concurrency.default + concurrency.min) / 2),
        chunkSize: Math.floor((chunkSize.default + chunkSize.min) / 2),
        maxRetries: retry.maxRetriesForPoorNetwork,
      },
      [NetworkQualityLevel.BAD]: {
        concurrency: concurrency.min,
        chunkSize: chunkSize.min,
        maxRetries: retry.maxRetriesForPoorNetwork,
      },
      [NetworkQualityLevel.OFFLINE]: {
        concurrency: 1,
        chunkSize: chunkSize.min,
        maxRetries: retry.maxRetriesForPoorNetwork,
      },
    };
  }

  /**
   * 启动自适应管理
   */
  start(): void {
    if (!this.config.enabled) {
      this.logger?.info(NETWORK_ADAPTIVE_LOG_CATEGORY, '自适应网络管理已禁用');
      return;
    }

    this.logger?.info(NETWORK_ADAPTIVE_LOG_CATEGORY, '启动自适应网络管理');

    // 立即执行一次测速
    this.runSpeedTest();

    // 定期执行测速
    if (this.config.speedTest.enabled && this.config.speedTest.interval > 0) {
      this.speedTestTimerId = setInterval(() => {
        this.runSpeedTest();
      }, this.config.speedTest.interval) as unknown as number;
    }

    // 定期调整参数
    if (this.config.adjustmentInterval > 0) {
      this.adjustmentTimerId = setInterval(() => {
        // 使用最近的测速结果调整参数
        const result = this.speedTester.getAverageResult();
        if (result) {
          this.updateNetworkQuality(result);
          this.adjustParameters();
        }
      }, this.config.adjustmentInterval) as unknown as number;
    }
  }

  /**
   * 停止自适应管理
   */
  stop(): void {
    this.logger?.info(NETWORK_ADAPTIVE_LOG_CATEGORY, '停止自适应网络管理');

    // 清除计时器
    if (this.speedTestTimerId !== undefined) {
      clearInterval(this.speedTestTimerId);
      this.speedTestTimerId = undefined;
    }

    if (this.adjustmentTimerId !== undefined) {
      clearInterval(this.adjustmentTimerId);
      this.adjustmentTimerId = undefined;
    }
  }

  /**
   * 执行网络测速
   */
  async runSpeedTest(): Promise<ISpeedTestResult | null> {
    try {
      this.logger?.debug(NETWORK_ADAPTIVE_LOG_CATEGORY, '执行网络测速');
      return await this.speedTester.runSpeedTest();
    } catch (error) {
      this.logger?.error(NETWORK_ADAPTIVE_LOG_CATEGORY, `测速失败: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * 获取当前自适应参数
   * @returns 当前参数
   */
  getCurrentParams(): IAdaptiveParams {
    return { ...this.currentParams };
  }

  /**
   * 获取当前网络质量
   * @returns 当前网络质量
   */
  getCurrentNetworkQuality(): NetworkQualityLevel {
    return this.currentQuality;
  }

  /**
   * 手动设置参数
   * @param params 要设置的参数
   */
  setParams(params: Partial<IAdaptiveParams>): void {
    const oldParams = { ...this.currentParams };

    // 更新参数，确保在有效范围内
    if (params.concurrency !== undefined) {
      this.currentParams.concurrency = Math.max(
        this.config.concurrency.min,
        Math.min(this.config.concurrency.max, params.concurrency),
      );
    }

    if (params.chunkSize !== undefined) {
      this.currentParams.chunkSize = Math.max(
        this.config.chunkSize.min,
        Math.min(this.config.chunkSize.max, params.chunkSize),
      );
    }

    if (params.maxRetries !== undefined) {
      this.currentParams.maxRetries = params.maxRetries;
    }

    this.logger?.info(
      NETWORK_ADAPTIVE_LOG_CATEGORY,
      `手动设置参数: 并发=${oldParams.concurrency}->${this.currentParams.concurrency}, ` +
        `分片大小=${oldParams.chunkSize}->${this.currentParams.chunkSize}, ` +
        `最大重试=${oldParams.maxRetries}->${this.currentParams.maxRetries}`,
    );

    this.eventEmitter.emit(AdaptiveEvent.PARAMS_ADJUSTED, {
      oldParams,
      newParams: { ...this.currentParams },
      networkQuality: this.currentQuality,
      isManual: true,
    });
  }

  /**
   * 重置参数为默认值
   */
  resetParams(): void {
    this.setParams({
      concurrency: this.config.concurrency.default,
      chunkSize: this.config.chunkSize.default,
      maxRetries: this.config.retry.maxRetriesForGoodNetwork,
    });
  }
}
