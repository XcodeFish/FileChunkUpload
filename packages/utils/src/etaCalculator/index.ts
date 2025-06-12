/**
 * @file-chunk-uploader/utils/etaCalculator
 * 动态剩余时间预测算法 - 采用三重权重平滑 + 自适应学习机制
 */

import { IETACalculatorOptions, ISpeedSample, IETAResult } from '@file-chunk-uploader/types';

/**
 * 动态剩余时间计算器
 * 使用三重权重平滑和自适应学习机制，确保预测结果既稳定又响应迅速
 */
export class ETACalculator {
  /** 采样点数据 */
  private samples: ISpeedSample[] = [];
  /** 上一次记录的文件总大小 */
  private lastTotalSize = 0;
  /** 网络是否空闲状态 */
  private isNetworkIdle = true;
  /** 上一次预测的速度 */
  private lastPrediction: number | null = null;
  /** 缓存的加权速度 */
  private cachedWeightedSpeed: number | null = null;
  /** 上次计算加权速度的时间 */
  private lastWeightedCalcTime = 0;
  /** 采样窗口大小 */
  private readonly timeWindow: number;
  /** 最小采样数量 */
  private readonly minSamples: number;
  /** 计算缓存时间（毫秒） */
  private readonly cacheTime: number;
  /** 平滑系数 */
  private readonly smoothingFactor: number;

  /**
   * 构造函数
   * @param options - 配置选项
   */
  constructor(options: IETACalculatorOptions = {}) {
    this.smoothingFactor = options.smoothingFactor ?? 0.7;
    this.timeWindow = options.timeWindow ?? 15;
    this.minSamples = options.minSamples ?? 3;
    this.cacheTime = options.cacheTime ?? 1000;
  }

  /**
   * 更新上传进度
   * @param uploadedBytes - 已上传字节数
   * @param totalSize - 文件总大小
   */
  public updateProgress(uploadedBytes: number, totalSize: number): void {
    const now = Date.now();

    // 初始化场景处理
    if (this.samples.length === 0) {
      this.samples.push({ timestamp: now, bytes: uploadedBytes });
      this.lastTotalSize = totalSize;
      return;
    }

    // 检测网络中断后重连
    if (this.samples.length > 0) {
      const lastSample = this.samples[this.samples.length - 1];
      const timeSinceLastSample = now - lastSample.timestamp;
      const byteDelta = uploadedBytes - lastSample.bytes;

      // 检测网络中断后重连（长时间无进度后突然有进度）
      const isReconnecting = timeSinceLastSample > 5000 && byteDelta > 0;

      if (isReconnecting) {
        // 重连后重置部分历史数据，避免之前的停滞数据影响预测
        this.samples = this.samples.slice(-Math.min(3, this.samples.length));
        // 重置上次预测结果，避免历史数据影响
        this.lastPrediction = null;
        this.cachedWeightedSpeed = null;
        // 添加新的重连样本点
        this.samples.push({ timestamp: now, bytes: uploadedBytes });
        this.lastTotalSize = totalSize;
        return;
      }
    }

    // 排除反向进度
    if (uploadedBytes < this.samples[this.samples.length - 1].bytes) return;

    // 计算瞬时速度
    const lastSample = this.samples[this.samples.length - 1];
    const timeDelta = (now - lastSample.timestamp) / 1000; // 秒
    const byteDelta = uploadedBytes - lastSample.bytes;
    let currentSpeed = byteDelta / timeDelta;

    // 异常值过滤
    if (this.samples.length >= 3) {
      // 计算近期平均速度
      const recentSpeeds = this.samples
        .slice(-3)
        .map((sample, idx, arr) => {
          if (idx === 0) return 0;
          return (
            (sample.bytes - arr[idx - 1].bytes) /
            ((sample.timestamp - arr[idx - 1].timestamp) / 1000)
          );
        })
        .filter(speed => speed > 0);

      if (recentSpeeds.length > 0) {
        const avgSpeed = recentSpeeds.reduce((a, b) => a + b, 0) / recentSpeeds.length;

        // 过滤异常峰值（速度异常高或低）
        if (currentSpeed > avgSpeed * 3 || (avgSpeed > 0 && currentSpeed < avgSpeed * 0.2)) {
          currentSpeed = avgSpeed * (currentSpeed > avgSpeed ? 1.5 : 0.5);
        }
      }
    }

    // 网络状态检测
    this.isNetworkIdle = byteDelta === 0;

    // 添加新样本
    this.samples.push({ timestamp: now, bytes: uploadedBytes });

    // 维护时间窗口
    if (this.samples.length > this.timeWindow) {
      this.samples.shift();
    }

    this.lastTotalSize = totalSize;
  }

  /**
   * 计算预估剩余时间
   * @returns 包含秒数和格式化时间的预估结果
   */
  public calculateETA(): IETAResult {
    // 网络空闲状态
    if (this.isNetworkIdle) {
      return {
        seconds: null,
        formatted: '--:--:--',
        networkState: 'idle',
        sampleCount: this.samples.length,
      };
    }

    // 样本不足
    if (this.samples.length < this.minSamples) {
      return {
        seconds: null,
        formatted: '--:--:--',
        networkState: 'initializing',
        sampleCount: this.samples.length,
      };
    }

    const totalRemaining = this.lastTotalSize - this.samples[this.samples.length - 1].bytes;
    if (totalRemaining <= 0) {
      return {
        seconds: 0,
        formatted: '00:00:00',
        networkState: 'stable',
        sampleCount: this.samples.length,
      };
    }

    // 计算三重加权速度
    const weightedSpeed = this.calculateWeightedSpeed();

    // 动态学习系数
    const learningRate = this.calculateLearningRate();

    // 应用自适应平滑
    const adaptiveSpeed =
      learningRate * weightedSpeed + (1 - learningRate) * (this.lastPrediction || weightedSpeed);

    // 处理极低速度场景
    if (adaptiveSpeed < 10) {
      // 10字节/秒作为极低速度阈值
      return {
        seconds: null,
        formatted: '--:--:--',
        networkState: 'stabilizing',
        sampleCount: this.samples.length,
      };
    }

    // 预测剩余时间（秒）
    let etaSeconds = totalRemaining / adaptiveSpeed;

    // 处理剩余时间过大的情况
    if (etaSeconds > 24 * 3600) {
      // 超过24小时
      etaSeconds = 24 * 3600; // 最多显示24小时
    }

    // 保存本次预测
    this.lastPrediction = adaptiveSpeed;

    // 确定网络状态
    const networkState = this.samples.length >= 10 ? 'stable' : 'stabilizing';

    return {
      seconds: etaSeconds > 0 ? etaSeconds : null,
      formatted: etaSeconds > 0 ? ETACalculator.formatETA(etaSeconds) : '--:--:--',
      networkState,
      sampleCount: this.samples.length,
    };
  }

  /**
   * 计算三重加权速度
   * @returns 加权平均速度（字节/秒）
   * @private
   */
  private calculateWeightedSpeed(): number {
    const now = Date.now();

    // 避免频繁重新计算（缓存时间内复用结果）
    if (this.cachedWeightedSpeed && now - this.lastWeightedCalcTime < this.cacheTime) {
      return this.cachedWeightedSpeed;
    }

    const weights = [0.5, 0.3, 0.2]; // 近、中、远三阶段权重
    const segments = this.divideSamples(3);

    const result = segments.reduce((acc, segment, i) => {
      const segmentSpeed =
        segment.reduce((sum, sample, idx, arr) => {
          if (idx === 0) return 0;
          const timeDelta = (sample.timestamp - arr[idx - 1].timestamp) / 1000;
          const byteDelta = sample.bytes - arr[idx - 1].bytes;
          return sum + byteDelta / timeDelta;
        }, 0) / (segment.length - 1 || 1);

      return acc + segmentSpeed * weights[i];
    }, 0);

    // 缓存计算结果
    this.cachedWeightedSpeed = result;
    this.lastWeightedCalcTime = now;

    return result;
  }

  /**
   * 将样本数据分成多个段
   * @param segments - 段数
   * @returns 分段后的样本数组
   * @private
   */
  private divideSamples(segments: number): ISpeedSample[][] {
    const segmentSize = Math.floor(this.samples.length / segments);
    const result = [];

    for (let i = 0; i < segments; i++) {
      const start = i * segmentSize;
      // 修复end计算逻辑
      const end = i === segments - 1 ? this.samples.length : (i + 1) * segmentSize;
      result.push(this.samples.slice(start, end));
    }

    return result;
  }

  /**
   * 计算动态学习率
   * @returns 学习率（0-1之间）
   * @private
   */
  private calculateLearningRate(): number {
    if (this.samples.length < 5) return 0.5;

    // 计算速度波动率
    const speeds: number[] = [];
    for (let i = 1; i < this.samples.length; i++) {
      const timeDelta = (this.samples[i].timestamp - this.samples[i - 1].timestamp) / 1000;
      const byteDelta = this.samples[i].bytes - this.samples[i - 1].bytes;
      speeds.push(byteDelta / timeDelta);
    }

    const maxSpeed = Math.max(...speeds);
    const minSpeed = Math.min(...speeds.filter(s => s > 0));
    const volatility = maxSpeed > 0 ? (maxSpeed - minSpeed) / maxSpeed : 0;

    // 平滑过渡的学习率（避免突变）
    const baseLearningRate = this.smoothingFactor;
    return Math.max(0.3, baseLearningRate * (1 - volatility * 0.7));
  }

  /**
   * 格式化剩余时间为 HH:MM:SS 格式
   * @param seconds - 剩余秒数
   * @returns 格式化后的时间字符串
   */
  public static formatETA(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
  }

  /**
   * 获取当前的网络状态
   * @returns 是否处于网络空闲状态
   */
  public isIdle(): boolean {
    return this.isNetworkIdle;
  }

  /**
   * 获取当前样本数量
   * @returns 当前样本数量
   */
  public getSampleCount(): number {
    return this.samples.length;
  }

  /**
   * 重置计算器状态
   */
  public reset(): void {
    this.samples = [];
    this.lastTotalSize = 0;
    this.isNetworkIdle = true;
    this.lastPrediction = null;
    this.cachedWeightedSpeed = null;
    this.lastWeightedCalcTime = 0;
  }
}
