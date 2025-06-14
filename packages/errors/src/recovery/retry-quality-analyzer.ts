/**
 * 重试网络质量分析器
 * 负责评估和分析网络质量，为重试决策提供支持
 * @packageDocumentation
 */

import { IRetryConfig } from '@file-chunk-uploader/types';

import { DEFAULT_RETRY_CONFIG } from './retry-default-config';
import { NetworkDetector, NetworkConditionRecord } from './retry-types';

/**
 * 网络质量分析器类
 * 负责评估网络质量，为重试决策提供支持
 */
export class RetryQualityAnalyzer {
  /**
   * 网络检测器
   */
  private networkDetector: NetworkDetector;

  /**
   * 网络配置
   */
  private config: {
    networkQualityThreshold?: {
      minSpeed?: number;
      maxRtt?: number;
    };
  };

  /**
   * 最近一次网络评估结果缓存
   * 用于避免频繁重复评估网络状态
   * @private
   */
  private lastNetworkAssessment: { time: number; result: boolean } = {
    time: 0,
    result: true,
  };

  /**
   * 网络状态评估缓存
   * 缓存一段时间内的网络状态评估结果，以便快速决策
   * @private
   */
  private networkQualityCache: {
    timestamp: number;
    quality: 'good' | 'fair' | 'poor' | 'offline';
    speed: number;
    rtt: number;
  } | null = null;

  /**
   * 构造函数
   * @param networkDetector 网络检测器
   * @param config 网络配置
   */
  constructor(networkDetector: NetworkDetector, config?: Partial<IRetryConfig>) {
    this.networkDetector = networkDetector;

    // 合并默认配置和用户配置
    this.config = {
      networkQualityThreshold: {
        ...DEFAULT_RETRY_CONFIG.networkQualityThreshold,
        ...config?.networkQualityThreshold,
      },
    };

    // 初始化网络质量缓存
    this.updateNetworkQualityCache(this.networkDetector.getCurrentNetwork());

    // 设置网络变化监听器
    if (this.networkDetector && typeof this.networkDetector.onNetworkChange === 'function') {
      this.networkDetector.onNetworkChange(network => {
        this.updateNetworkQualityCache(network);
      });
    }
  }

  /**
   * 更新网络质量缓存
   * 分析当前网络状况并缓存评估结果
   *
   * @param network 当前网络状态
   */
  updateNetworkQualityCache(network: {
    online: boolean;
    type: string;
    speed: number;
    rtt: number;
  }): void {
    const now = Date.now();

    // 如果网络离线，直接设置为离线状态
    if (!network.online) {
      this.networkQualityCache = {
        timestamp: now,
        quality: 'offline',
        speed: 0,
        rtt: network.rtt || 0,
      };
      return;
    }

    // 获取配置的网络质量阈值
    const minSpeed =
      this.config.networkQualityThreshold?.minSpeed ??
      DEFAULT_RETRY_CONFIG.networkQualityThreshold!.minSpeed!;
    const maxRtt =
      this.config.networkQualityThreshold?.maxRtt ??
      DEFAULT_RETRY_CONFIG.networkQualityThreshold!.maxRtt!;

    // 评估网络质量
    let quality: 'good' | 'fair' | 'poor' | 'offline';

    if (network.speed > minSpeed * 2 && network.rtt < maxRtt / 2) {
      quality = 'good';
    } else if (network.speed >= minSpeed && network.rtt <= maxRtt) {
      quality = 'fair';
    } else {
      quality = 'poor';
    }

    // 更新缓存
    this.networkQualityCache = {
      timestamp: now,
      quality,
      speed: network.speed,
      rtt: network.rtt,
    };
  }

  /**
   * 获取当前网络质量
   * 如果缓存未过期则使用缓存的评估结果，否则重新评估
   *
   * @returns 网络质量评估结果
   */
  getNetworkQuality(): {
    quality: 'good' | 'fair' | 'poor' | 'offline';
    speed: number;
    rtt: number;
  } {
    const now = Date.now();

    // 如果缓存有效（不超过10秒），直接返回
    if (this.networkQualityCache && now - this.networkQualityCache.timestamp < 10000) {
      return {
        quality: this.networkQualityCache.quality,
        speed: this.networkQualityCache.speed,
        rtt: this.networkQualityCache.rtt,
      };
    }

    // 重新评估网络质量
    const network = this.networkDetector.getCurrentNetwork();
    this.updateNetworkQualityCache(network);

    return {
      quality: this.networkQualityCache!.quality,
      speed: this.networkQualityCache!.speed,
      rtt: this.networkQualityCache!.rtt,
    };
  }

  /**
   * 检查网络质量是否适合重试
   * 使用缓存策略减少频繁评估
   *
   * @param networkConditions 网络状况记录数组
   * @returns 是否适合在当前网络下重试
   */
  checkNetworkQuality(networkConditions: NetworkConditionRecord[]): boolean {
    // 使用缓存的网络评估结果，如果距离上次评估不超过10秒
    const now = Date.now();
    if (now - this.lastNetworkAssessment.time < 10000) {
      return this.lastNetworkAssessment.result;
    }

    // 配置的网络质量阈值
    const minSpeed =
      this.config.networkQualityThreshold?.minSpeed ??
      DEFAULT_RETRY_CONFIG.networkQualityThreshold!.minSpeed!;
    const maxRtt =
      this.config.networkQualityThreshold?.maxRtt ??
      DEFAULT_RETRY_CONFIG.networkQualityThreshold!.maxRtt!;

    // 检查最近3次网络记录
    const recentConditions = networkConditions.slice(-3);
    if (recentConditions.length >= 3) {
      // 如果连续3次网络状况很差，暂停重试
      const allPoorConditions = recentConditions.every(
        (c: NetworkConditionRecord) => !c.online || c.speed < minSpeed || c.rtt > maxRtt,
      );

      // 更新缓存
      this.lastNetworkAssessment = {
        time: now,
        result: !allPoorConditions,
      };

      return !allPoorConditions;
    }

    // 检查网络是否在线
    const isNetworkOnline = this.networkDetector.getCurrentNetwork().online;

    // 更新缓存
    this.lastNetworkAssessment = {
      time: now,
      result: isNetworkOnline,
    };

    return isNetworkOnline;
  }

  /**
   * 计算基于网络质量的等待时间
   * 根据网络质量动态调整重试间隔
   *
   * @param networkQuality 网络质量评估结果
   * @returns 计算的等待时间（毫秒）
   */
  calculateNetworkBasedWaitTime(networkQuality: {
    quality: string;
    speed: number;
    rtt: number;
  }): number {
    // 根据网络质量动态调整重试等待时间
    switch (networkQuality.quality) {
      case 'good':
        return 500; // 良好网络，最小等待时间
      case 'fair':
        return 1500; // 一般网络，中等等待时间
      case 'poor':
        return 3000; // 糟糕网络，较长等待时间
      case 'offline':
        return 5000; // 离线，最长等待时间
      default:
        return 2000; // 默认等待时间
    }
  }

  /**
   * 获取网络检测器
   * @returns 网络检测器实例
   */
  getNetworkDetector(): NetworkDetector {
    return this.networkDetector;
  }
}

/**
 * 创建重试质量分析器的工厂函数
 * @param networkDetector 网络检测器
 * @param config 重试配置
 * @returns 重试质量分析器实例
 */
export function createRetryQualityAnalyzer(
  networkDetector: NetworkDetector,
  config?: Partial<IRetryConfig>,
): RetryQualityAnalyzer {
  return new RetryQualityAnalyzer(networkDetector, config);
}
