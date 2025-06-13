/**
 * 网络状态检测器
 * 用于监测和管理网络状态变化
 * @packageDocumentation
 */

import type { INetworkDetector, INetworkInfo } from '@file-chunk-uploader/types';

/**
 * NetworkDetector类
 * 实现网络状态监测、变化事件和网络速度测量
 */
export class NetworkDetector implements INetworkDetector {
  /** 监听器集合 */
  private listeners: Array<(network: INetworkInfo) => void> = [];

  /** 当前网络状态 */
  private currentNetwork: INetworkInfo = {
    online: navigator.onLine,
    type: this.getConnectionType(),
    speed: 0,
    rtt: 0,
    lastUpdate: Date.now(),
  };

  /** 是否正在监听 */
  private isMonitoring: boolean = false;

  /** 测速URL */
  private speedTestUrl: string = '/ping';

  /** 测速间隔 */
  private speedTestInterval: number = 60000;

  /** 测速定时器 */
  private speedTestTimer: number | null = null;

  /**
   * 构造函数
   * @param options 配置选项
   */
  constructor(options?: {
    speedTestUrl?: string;
    speedTestInterval?: number;
    autoStart?: boolean;
  }) {
    // 应用配置
    if (options) {
      if (options.speedTestUrl) {
        this.speedTestUrl = options.speedTestUrl;
      }
      if (options.speedTestInterval) {
        this.speedTestInterval = options.speedTestInterval;
      }
    }

    // 自动启动监听
    if (options?.autoStart !== false) {
      this.startMonitoring();
    }
  }

  /**
   * 获取当前网络状态
   * @returns 当前网络状态信息
   */
  public getCurrentNetwork(): INetworkInfo {
    // 返回当前网络状态的副本，避免外部修改
    return { ...this.currentNetwork };
  }

  /**
   * 监听网络状态变化
   * @param callback 网络变化回调函数
   * @returns 取消监听函数
   */
  public onNetworkChange(callback: (network: INetworkInfo) => void): () => void {
    // 添加监听器
    this.listeners.push(callback);

    // 立即执行回调，传递当前状态
    try {
      callback({ ...this.currentNetwork });
    } catch (err) {
      console.error('网络状态监听回调错误:', err);
    }

    // 返回取消订阅函数
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  /**
   * 测量网络速度
   * @returns Promise，解析为网络速度(Mbps)
   */
  public async measureNetworkSpeed(): Promise<number> {
    if (!navigator.onLine) return 0;

    try {
      const startTime = performance.now();
      // 发送请求时添加随机参数避免缓存
      const response = await fetch(`${this.speedTestUrl}?t=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store',
      });
      const endTime = performance.now();

      if (response.ok) {
        const rtt = endTime - startTime;
        // 更新当前网络状态
        this.currentNetwork.rtt = rtt;

        // 根据RTT估算网络速度
        let speed = 0;

        if (rtt < 50) {
          speed = 20; // 高速连接
        } else if (rtt < 100) {
          speed = 10; // 良好连接
        } else if (rtt < 200) {
          speed = 5; // 中等连接
        } else if (rtt < 500) {
          speed = 2; // 慢速连接
        } else {
          speed = 0.5; // 非常慢的连接
        }

        this.currentNetwork.speed = speed;
        this.currentNetwork.lastUpdate = Date.now();

        // 通知监听器
        this.notifyListeners();

        return speed;
      }

      // 请求成功但响应状态不为OK时，返回当前估计的速度
      return this.currentNetwork.speed;
    } catch (err) {
      console.warn('网络速度测量失败:', err);
      // 测量失败时返回当前估计的速度
      return this.currentNetwork.speed;
    }
  }

  /**
   * 检查是否在线
   * @returns 是否在线
   */
  public isOnline(): boolean {
    return navigator.onLine;
  }

  /**
   * 开始监听网络状态变化
   */
  public startMonitoring(): void {
    if (this.isMonitoring) return;

    // 监听在线/离线状态变化
    window.addEventListener('online', this.handleOnlineStatus);
    window.addEventListener('offline', this.handleOnlineStatus);

    // 如果支持Network Information API，监听连接变化
    if (this.hasNetworkInformation()) {
      const connection = (navigator as any).connection;
      connection.addEventListener('change', this.handleConnectionChange);
    }

    // 初始化网络信息
    this.updateNetworkInfo();

    // 启动定期测速
    this.scheduleSpeedTest();

    this.isMonitoring = true;
  }

  /**
   * 停止监听网络状态变化
   */
  public stopMonitoring(): void {
    if (!this.isMonitoring) return;

    // 移除事件监听
    window.removeEventListener('online', this.handleOnlineStatus);
    window.removeEventListener('offline', this.handleOnlineStatus);

    // 如果支持Network Information API，移除连接变化监听
    if (this.hasNetworkInformation()) {
      const connection = (navigator as any).connection;
      connection.removeEventListener('change', this.handleConnectionChange);
    }

    // 清除测速定时器
    if (this.speedTestTimer !== null) {
      window.clearInterval(this.speedTestTimer);
      this.speedTestTimer = null;
    }

    this.isMonitoring = false;
  }

  /**
   * 处理在线状态变化
   */
  private handleOnlineStatus = (): void => {
    this.updateNetworkInfo();
  };

  /**
   * 处理连接变化
   */
  private handleConnectionChange = (): void => {
    this.updateNetworkInfo();
  };

  /**
   * 更新网络信息
   */
  private updateNetworkInfo(): void {
    const oldNetwork = { ...this.currentNetwork };

    // 更新在线状态
    this.currentNetwork.online = navigator.onLine;

    // 更新连接类型
    this.currentNetwork.type = this.getConnectionType();

    // 如果支持Network Information API，更新更多信息
    if (this.hasNetworkInformation()) {
      const connection = (navigator as any).connection;

      // 更新RTT
      if (typeof connection.rtt === 'number') {
        this.currentNetwork.rtt = connection.rtt;
      }

      // 更新有效连接类型
      if (connection.effectiveType) {
        this.currentNetwork.effectiveType = connection.effectiveType;
        // 根据effectiveType估计速度
        this.currentNetwork.speed = this.estimateSpeedFromEffectiveType(connection.effectiveType);
      }

      // 更新下行速度
      if (typeof connection.downlink === 'number') {
        this.currentNetwork.downlink = connection.downlink;
      }

      // 更新最大下行速度
      if (typeof connection.downlinkMax === 'number') {
        this.currentNetwork.downlinkMax = connection.downlinkMax;
      }

      // 更新数据保护模式
      if (typeof connection.saveData === 'boolean') {
        this.currentNetwork.saveData = connection.saveData;
      }
    }

    this.currentNetwork.lastUpdate = Date.now();

    // 如果网络状态有变化，通知监听器
    if (JSON.stringify(oldNetwork) !== JSON.stringify(this.currentNetwork)) {
      this.notifyListeners();
    }
  }

  /**
   * 获取连接类型
   * @returns 网络连接类型
   */
  private getConnectionType(): 'wifi' | 'cellular' | 'ethernet' | 'unknown' {
    if (!this.hasNetworkInformation()) return 'unknown';

    const connection = (navigator as any).connection;
    if (!connection.type) return 'unknown';

    switch (connection.type) {
      case 'wifi':
        return 'wifi';
      case 'cellular':
        return 'cellular';
      case 'ethernet':
        return 'ethernet';
      default:
        return 'unknown';
    }
  }

  /**
   * 根据有效连接类型估计网络速度
   * @param effectiveType 有效连接类型
   * @returns 估计的网络速度(Mbps)
   */
  private estimateSpeedFromEffectiveType(effectiveType: string): number {
    // 根据effectiveType估计网络速度(Mbps)
    switch (effectiveType) {
      case 'slow-2g':
        return 0.1;
      case '2g':
        return 0.5;
      case '3g':
        return 2;
      case '4g':
        return 10;
      default:
        return 1;
    }
  }

  /**
   * 通知所有监听器网络状态变化
   */
  private notifyListeners(): void {
    const networkInfo = { ...this.currentNetwork };

    this.listeners.forEach(callback => {
      try {
        callback(networkInfo);
      } catch (err) {
        console.error('网络状态监听回调错误:', err);
      }
    });
  }

  /**
   * 安排定期测速
   */
  private scheduleSpeedTest(): void {
    // 清除现有定时器
    if (this.speedTestTimer !== null) {
      window.clearInterval(this.speedTestTimer);
    }

    // 设置新定时器
    this.speedTestTimer = window.setInterval(
      () => this.measureNetworkSpeed(),
      this.speedTestInterval,
    );
  }

  /**
   * 检查是否支持Network Information API
   * @returns 是否支持
   */
  private hasNetworkInformation(): boolean {
    return 'connection' in navigator;
  }
}
