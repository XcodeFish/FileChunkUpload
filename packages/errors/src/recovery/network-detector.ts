/**
 * 网络检测器实现
 * 用于监控网络状态变化和评估网络质量
 * @packageDocumentation
 */

import { NetworkDetector, NetworkInfo } from './retry-types';

/**
 * 默认网络检测器实现类
 * 提供网络状态检测和监控功能
 */
export class DefaultNetworkDetector implements NetworkDetector {
  /** 网络状态变化监听器集合 */
  private listeners: Array<(network: NetworkInfo) => void> = [];

  /** 当前网络状态信息 */
  private currentNetwork: NetworkInfo = {
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    type: 'unknown',
    speed: 1,
    rtt: 100,
  };

  /** 网络测速定时器ID */
  private speedTestTimerId?: number;

  /** 网络连接状态监听器解绑函数 */
  private cleanupFunctions: Array<() => void> = [];

  /**
   * 构造函数
   * 初始化网络监听
   */
  constructor() {
    if (typeof window !== 'undefined') {
      // 监听在线状态变化
      const onlineHandler = () => this.updateNetworkInfo({ online: true });
      const offlineHandler = () => this.updateNetworkInfo({ online: false });

      window.addEventListener('online', onlineHandler);
      window.addEventListener('offline', offlineHandler);

      this.cleanupFunctions.push(() => {
        window.removeEventListener('online', onlineHandler);
        window.removeEventListener('offline', offlineHandler);
      });
    }

    // 定期测量网络质量
    this.startNetworkQualityMonitoring();
  }

  /**
   * 获取当前网络状态
   * @returns 网络状态信息
   */
  getCurrentNetwork(): NetworkInfo {
    return { ...this.currentNetwork };
  }

  /**
   * 添加网络变化监听器
   * @param callback 监听器回调函数
   * @returns 解绑函数
   */
  onNetworkChange(callback: (network: NetworkInfo) => void): () => void {
    this.listeners.push(callback);

    // 立即通知当前网络状态
    callback(this.getCurrentNetwork());

    // 返回解绑函数
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index !== -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * 更新网络信息
   * @param partialInfo 部分网络信息
   */
  private updateNetworkInfo(partialInfo: Partial<NetworkInfo> = {}): void {
    const oldNetwork = { ...this.currentNetwork };

    // 更新网络信息
    this.currentNetwork = {
      ...this.currentNetwork,
      ...partialInfo,
    };

    // 检测网络类型
    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection && connection.effectiveType) {
        // 根据effectiveType推断网络类型
        const effectiveType = connection.effectiveType;
        if (effectiveType === '4g') {
          this.currentNetwork.type = 'wifi'; // 假设4G连接质量与WiFi相当
        } else if (effectiveType === '3g' || effectiveType === '2g') {
          this.currentNetwork.type = 'cellular';
        }
      }
    }

    // 判断是否有变化
    const hasChanged =
      oldNetwork.online !== this.currentNetwork.online ||
      oldNetwork.type !== this.currentNetwork.type ||
      Math.abs(oldNetwork.speed - this.currentNetwork.speed) > 0.5 ||
      Math.abs(oldNetwork.rtt - this.currentNetwork.rtt) > 50;

    // 通知监听器
    if (hasChanged) {
      this.notifyListeners();
    }
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(): void {
    const networkInfo = this.getCurrentNetwork();
    this.listeners.forEach(listener => {
      try {
        listener(networkInfo);
      } catch (err) {
        console.error('网络状态监听器出错:', err);
      }
    });
  }

  /**
   * 启动网络质量监控
   */
  private startNetworkQualityMonitoring(): void {
    // 立即执行一次网络质量测量
    this.measureNetworkQuality();

    // 定期测量网络质量（每30秒）
    this.speedTestTimerId = window.setInterval(() => {
      this.measureNetworkQuality();
    }, 30000);

    this.cleanupFunctions.push(() => {
      if (this.speedTestTimerId !== undefined) {
        clearInterval(this.speedTestTimerId);
        this.speedTestTimerId = undefined;
      }
    });
  }

  /**
   * 测量网络质量
   */
  private measureNetworkQuality(): void {
    if (typeof window === 'undefined' || !this.currentNetwork.online) return;

    // 测量网络RTT
    const startTime = Date.now();

    // 使用一个小图片进行网络测试
    const img = new Image();
    img.onload = () => {
      const rtt = Date.now() - startTime;
      this.updateNetworkInfo({ rtt });
    };

    img.onerror = () => {
      // 请求失败，可能是网络问题
      this.updateNetworkInfo({ online: false });
    };

    // 添加时间戳防止缓存
    img.src = `https://www.google.com/favicon.ico?_t=${Date.now()}`;

    // 如果支持Performance API，尝试获取更准确的网络信息
    this.getPerformanceMetrics();
  }

  /**
   * 获取性能指标
   */
  private getPerformanceMetrics(): void {
    if (typeof performance === 'undefined' || !performance.getEntriesByType) return;

    // 获取资源加载性能数据
    const resources = performance.getEntriesByType('resource');
    if (resources.length === 0) return;

    // 计算最近10个资源的平均下载速度
    const recentResources = resources.slice(-10);
    let totalSize = 0;
    let totalTime = 0;

    recentResources.forEach(resource => {
      if ('transferSize' in resource && 'duration' in resource) {
        const size = (resource as any).transferSize || 0;
        const time = (resource as any).duration || 1;

        if (size > 0 && time > 0) {
          totalSize += size;
          totalTime += time;
        }
      }
    });

    if (totalSize > 0 && totalTime > 0) {
      // 计算平均速度（Mbps）
      const speedBytesPerMs = totalSize / totalTime;
      const speedMbps = (speedBytesPerMs * 8 * 1000) / (1024 * 1024);

      this.updateNetworkInfo({ speed: speedMbps });
    }
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    // 执行所有清理函数
    this.cleanupFunctions.forEach(cleanup => {
      try {
        cleanup();
      } catch (err) {
        console.error('清理网络检测器资源出错:', err);
      }
    });

    // 清空监听器
    this.listeners = [];
    this.cleanupFunctions = [];
  }
}

/**
 * 创建网络检测器
 * @returns 网络检测器实例
 */
export function createNetworkDetector(): NetworkDetector {
  return new DefaultNetworkDetector();
}
