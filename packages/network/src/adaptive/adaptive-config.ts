/**
 * 网络自适应配置
 */

/**
 * 网络质量等级
 */
export enum NetworkQualityLevel {
  /** 极好 */
  EXCELLENT = 'excellent',
  /** 良好 */
  GOOD = 'good',
  /** 一般 */
  FAIR = 'fair',
  /** 较差 */
  POOR = 'poor',
  /** 极差 */
  BAD = 'bad',
  /** 离线 */
  OFFLINE = 'offline',
}

/**
 * 网络自适应配置接口
 */
export interface IAdaptiveConfig {
  /** 是否启用自适应 */
  enabled: boolean;

  /** 并发连接数配置 */
  concurrency: {
    /** 最小并发连接数 */
    min: number;
    /** 最大并发连接数 */
    max: number;
    /** 默认并发连接数 */
    default: number;
  };

  /** 分片大小配置(字节) */
  chunkSize: {
    /** 最小分片大小 */
    min: number;
    /** 最大分片大小 */
    max: number;
    /** 默认分片大小 */
    default: number;
  };

  /** 重试配置 */
  retry: {
    /** 网络质量较差时的最大重试次数 */
    maxRetriesForPoorNetwork: number;
    /** 网络质量良好时的最大重试次数 */
    maxRetriesForGoodNetwork: number;
  };

  /** 网络测速配置 */
  speedTest: {
    /** 是否启用测速 */
    enabled: boolean;
    /** 测速样本大小(字节) */
    sampleSize: number;
    /** 测速间隔(毫秒) */
    interval: number;
  };

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

  /** 自适应调整间隔(毫秒) */
  adjustmentInterval: number;

  /** 自适应调整灵敏度(0-1之间，越大调整越激进) */
  sensitivity: number;
}

/**
 * 默认网络自适应配置
 */
export const DEFAULT_ADAPTIVE_CONFIG: IAdaptiveConfig = {
  enabled: true,
  concurrency: {
    min: 1,
    max: 6,
    default: 3,
  },
  chunkSize: {
    min: 512 * 1024, // 512KB
    max: 5 * 1024 * 1024, // 5MB
    default: 2 * 1024 * 1024, // 2MB
  },
  retry: {
    maxRetriesForPoorNetwork: 5,
    maxRetriesForGoodNetwork: 2,
  },
  speedTest: {
    enabled: true,
    sampleSize: 200 * 1024, // 200KB
    interval: 30000, // 30秒
  },
  qualityThresholds: {
    excellent: 10000, // 10Mbps
    good: 5000, // 5Mbps
    fair: 2000, // 2Mbps
    poor: 500, // 500Kbps
  },
  adjustmentInterval: 10000, // 10秒
  sensitivity: 0.5,
};
