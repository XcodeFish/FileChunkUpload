/**
 * 网络检测器实现
 * 用于监控网络状态变化和评估网络质量
 * @packageDocumentation
 */

import { NetworkDetector, NetworkInfo } from './retry-types';

/**
 * 扩展Navigator接口以包含connection属性
 * 需要此扩展因为TS默认类型定义中不包含此实验性API
 */
interface NavigatorWithConnection extends Navigator {
  connection?: {
    type?: string;
    effectiveType?: string;
    rtt?: number;
    downlink?: number;
    addEventListener: (type: string, listener: EventListener) => void;
    removeEventListener: (type: string, listener: EventListener) => void;
  };
}

/**
 * 默认网络检测器实现类
 * 提供网络状态检测和监控功能
 *
 * 主要功能：
 * 1. 监听在线/离线状态变化
 * 2. 定期测量网络质量（RTT和速度）
 * 3. 通知网络状态变化
 * 4. 提供当前网络状态信息
 */
export class DefaultNetworkDetector implements NetworkDetector {
  /**
   * 网络状态变化监听器集合
   * 存储所有注册的网络状态变化回调函数
   */
  private listeners: Array<(network: NetworkInfo) => void> = [];

  /**
   * 当前网络状态信息
   * 包含在线状态、网络类型、速度和RTT
   */
  private currentNetwork: NetworkInfo = {
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    type: 'unknown',
    speed: 1,
    rtt: 100,
  };

  /**
   * 网络测速定时器ID
   * 用于清理定期测量网络质量的定时器
   */
  private speedTestTimerId?: number;

  /**
   * 网络连接状态监听器解绑函数集合
   * 存储所有需要在清理时执行的函数
   */
  private cleanupFunctions: Array<() => void> = [];

  /**
   * 网络质量测试URL
   * 用于测量RTT和下载速度
   */
  private networkTestUrl: string = 'https://www.google.com/favicon.ico';

  /**
   * 构造函数
   * 初始化网络检测器并设置事件监听
   */
  constructor() {
    // 初始化网络状态监听
    this.setupNetworkListeners();

    // 开始周期性网络质量测量
    this.startPeriodicSpeedTest();
  }

  /**
   * 设置网络状态监听器
   * 监听在线/离线状态变化和连接类型变化
   * @private
   */
  private setupNetworkListeners(): void {
    if (typeof window !== 'undefined') {
      // 监听在线状态变化
      const onlineListener = () => {
        this.updateNetworkStatus({ online: true });
      };

      const offlineListener = () => {
        this.updateNetworkStatus({ online: false });
      };

      window.addEventListener('online', onlineListener);
      window.addEventListener('offline', offlineListener);

      // 保存清理函数
      this.cleanupFunctions.push(() => {
        window.removeEventListener('online', onlineListener);
        window.removeEventListener('offline', offlineListener);
      });

      // 如果浏览器支持Connection API
      const nav = navigator as NavigatorWithConnection;
      if (nav.connection) {
        const connection = nav.connection;

        // 监听网络类型变化
        const connectionChangeListener = () => {
          this.updateNetworkStatus({
            type: this.getNetworkType(connection.type),
            // 转换effectiveType为近似带宽
            speed: this.getSpeedFromEffectiveType(connection.effectiveType),
            rtt: connection.rtt || 100,
          });
        };

        // 首次获取网络类型
        connectionChangeListener();

        // 监听网络类型变化
        if (connection.addEventListener) {
          connection.addEventListener('change', connectionChangeListener);

          // 保存清理函数
          this.cleanupFunctions.push(() => {
            connection.removeEventListener('change', connectionChangeListener);
          });
        }
      }
    }
  }

  /**
   * 将Navigator connection API的网络类型转换为标准类型
   * @param connectionType 原始连接类型
   * @returns 标准化的网络类型
   * @private
   */
  private getNetworkType(connectionType?: string): 'wifi' | 'cellular' | 'ethernet' | 'unknown' {
    if (!connectionType) return 'unknown';

    switch (connectionType) {
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
   * 根据effectiveType估算网络速度
   * @param effectiveType 有效网络类型
   * @returns 估算的网络速度(Mbps)
   * @private
   */
  private getSpeedFromEffectiveType(effectiveType?: string): number {
    // 根据常见的effectiveType估算速度
    switch (effectiveType) {
      case 'slow-2g':
        return 0.1; // ~100 Kbps
      case '2g':
        return 0.3; // ~300 Kbps
      case '3g':
        return 1.5; // ~1.5 Mbps
      case '4g':
        return 10; // ~10 Mbps
      default:
        return 1; // 默认1 Mbps
    }
  }

  /**
   * 开始周期性网络质量测量
   * 定期发送小请求测量网络RTT和下载速度
   * @private
   */
  private startPeriodicSpeedTest(): void {
    // 每60秒测量一次网络质量
    this.speedTestTimerId = window.setInterval(() => {
      if (this.currentNetwork.online) {
        this.measureNetworkQuality();
      }
    }, 60000);
  }

  /**
   * 测量网络质量
   * 通过下载小文件测量RTT和下载速度
   * @private
   */
  private measureNetworkQuality(): void {
    const startTime = Date.now();

    // 创建新图像对象并加载小文件
    const img = new Image();

    // 添加加载完成处理器
    img.onload = () => {
      const endTime = Date.now();
      const rtt = endTime - startTime;

      // 更新网络状态
      this.updateNetworkStatus({
        rtt,
        // 简单估算
        speed: this.currentNetwork.speed,
      });
    };

    // 添加加载失败处理器
    img.onerror = () => {
      // 加载失败可能表示网络问题
      this.updateNetworkStatus({
        online: false,
      });
    };

    // 添加随机参数避免缓存
    img.src = `${this.networkTestUrl}?t=${Date.now()}`;
  }

  /**
   * 更新网络状态并通知监听器
   * @param status 部分网络状态信息
   * @private
   */
  private updateNetworkStatus(status: Partial<NetworkInfo>): void {
    // 更新当前网络状态
    this.currentNetwork = {
      ...this.currentNetwork,
      ...status,
    };

    // 通知所有监听器
    this.listeners.forEach(listener => {
      try {
        listener(this.currentNetwork);
      } catch (err) {
        console.error('网络状态变化监听器执行失败:', err);
      }
    });
  }

  /**
   * 获取当前网络状态
   * 返回包含在线状态、网络类型和速度的对象
   * @returns 网络状态信息
   */
  getCurrentNetwork(): NetworkInfo {
    return { ...this.currentNetwork };
  }

  /**
   * 注册网络状态变化监听器
   * @param callback 网络状态变化回调函数
   * @returns 取消监听的函数
   */
  onNetworkChange(callback: (network: NetworkInfo) => void): () => void {
    // 添加到监听器列表
    this.listeners.push(callback);

    // 立即调用一次回调，传递当前网络状态
    try {
      callback(this.currentNetwork);
    } catch (err) {
      console.error('执行网络状态监听器失败:', err);
    }

    // 返回取消监听的函数
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
    };
  }

  /**
   * 清理资源
   * 移除所有事件监听器和定时器，防止内存泄漏
   */
  cleanup(): void {
    // 清理定时器
    if (this.speedTestTimerId) {
      clearInterval(this.speedTestTimerId);
      this.speedTestTimerId = undefined;
    }

    // 清空监听器列表
    this.listeners = [];

    // 执行所有清理函数
    this.cleanupFunctions.forEach(cleanupFn => {
      try {
        cleanupFn();
      } catch (err) {
        console.error('执行清理函数失败:', err);
      }
    });

    // 清空清理函数列表
    this.cleanupFunctions = [];
  }
}

/**
 * 创建网络检测器
 * 工厂函数，创建并返回网络检测器实例
 * @returns 网络检测器实例
 */
export function createNetworkDetector(): NetworkDetector {
  return new DefaultNetworkDetector();
}
