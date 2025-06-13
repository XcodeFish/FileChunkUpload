/**
 * 网络状态检测器实现
 */
import { IEventEmitter, Logger } from '@file-chunk-uploader/core';

import { NETWORK_ADAPTIVE_LOG_CATEGORY } from '../utils/logger-categories';

/**
 * 网络状态事件
 */
export enum NetworkStatusEvent {
  /** 网络在线 */
  ONLINE = 'network:online',
  /** 网络离线 */
  OFFLINE = 'network:offline',
  /** 网络状态变化 */
  CHANGE = 'network:change',
}

/**
 * 网络连接类型
 */
export enum ConnectionType {
  /** 未知 */
  UNKNOWN = 'unknown',
  /** 以太网 */
  ETHERNET = 'ethernet',
  /** WiFi */
  WIFI = 'wifi',
  /** 蜂窝网络 */
  CELLULAR = 'cellular',
  /** 2G网络 */
  CELLULAR_2G = '2g',
  /** 3G网络 */
  CELLULAR_3G = '3g',
  /** 4G网络 */
  CELLULAR_4G = '4g',
  /** 5G网络 */
  CELLULAR_5G = '5g',
  /** 离线 */
  NONE = 'none',
}

/**
 * 网络状态信息
 */
export interface INetworkStatus {
  /** 是否在线 */
  isOnline: boolean;
  /** 连接类型 */
  connectionType: ConnectionType;
  /** 下行带宽估计值(Mbps)，如果可用的话 */
  downlinkMbps?: number;
  /** 往返时间估计值(ms)，如果可用的话 */
  rtt?: number;
  /** 是否启用了节省数据模式 */
  saveData?: boolean;
  /** 检测时间 */
  timestamp: number;
}

/**
 * 网络状态检测器
 * 用于检测和监控网络连接状态
 */
export class NetworkDetector {
  /** 事件发射器 */
  private eventEmitter: IEventEmitter;
  /** 日志记录器 */
  private logger?: Logger;
  /** 当前网络状态 */
  private currentStatus: INetworkStatus;
  /** 是否已初始化 */
  private initialized = false;
  /** 是否支持网络信息API */
  private supportsNetworkInformation = false;
  /** 网络信息对象 */
  private networkInfo?: any;

  /**
   * 构造函数
   * @param eventEmitter 事件发射器
   * @param logger 日志记录器
   */
  constructor(eventEmitter: IEventEmitter, logger?: Logger) {
    this.eventEmitter = eventEmitter;
    this.logger = logger;

    // 初始化当前状态
    this.currentStatus = {
      isOnline: true,
      connectionType: ConnectionType.UNKNOWN,
      timestamp: Date.now(),
    };

    // 检查是否支持网络信息API
    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
      this.supportsNetworkInformation = true;
      this.networkInfo = (navigator as any).connection;
    }
  }

  /**
   * 初始化检测器
   */
  initialize(): void {
    if (this.initialized) {
      return;
    }

    this.logger?.info(NETWORK_ADAPTIVE_LOG_CATEGORY, '初始化网络状态检测器');

    // 获取初始网络状态
    this.updateNetworkStatus();

    // 添加事件监听
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline.bind(this));
      window.addEventListener('offline', this.handleOffline.bind(this));
    }

    // 如果支持网络信息API，添加change事件监听
    if (this.supportsNetworkInformation && this.networkInfo) {
      try {
        this.networkInfo.addEventListener('change', this.handleConnectionChange.bind(this));
      } catch (error) {
        this.logger?.warn(
          NETWORK_ADAPTIVE_LOG_CATEGORY,
          `无法监听网络信息变化: ${(error as Error).message}`,
        );
      }
    }

    this.initialized = true;
  }

  /**
   * 销毁检测器
   */
  destroy(): void {
    if (!this.initialized) {
      return;
    }

    this.logger?.info(NETWORK_ADAPTIVE_LOG_CATEGORY, '销毁网络状态检测器');

    // 移除事件监听
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline.bind(this));
      window.removeEventListener('offline', this.handleOffline.bind(this));
    }

    // 如果支持网络信息API，移除change事件监听
    if (this.supportsNetworkInformation && this.networkInfo) {
      try {
        this.networkInfo.removeEventListener('change', this.handleConnectionChange.bind(this));
      } catch (error) {
        this.logger?.warn(
          NETWORK_ADAPTIVE_LOG_CATEGORY,
          `无法移除网络信息变化监听: ${(error as Error).message}`,
        );
      }
    }

    this.initialized = false;
  }

  /**
   * 处理网络在线事件
   */
  private handleOnline(): void {
    this.logger?.info(NETWORK_ADAPTIVE_LOG_CATEGORY, '网络已连接');

    const oldStatus = { ...this.currentStatus };
    this.currentStatus.isOnline = true;
    this.currentStatus.timestamp = Date.now();

    // 更新其他网络信息
    this.updateConnectionInfo();

    // 触发事件
    this.eventEmitter.emit(NetworkStatusEvent.ONLINE, this.currentStatus);
    this.eventEmitter.emit(NetworkStatusEvent.CHANGE, {
      oldStatus,
      newStatus: { ...this.currentStatus },
    });
  }

  /**
   * 处理网络离线事件
   */
  private handleOffline(): void {
    this.logger?.info(NETWORK_ADAPTIVE_LOG_CATEGORY, '网络已断开');

    const oldStatus = { ...this.currentStatus };
    this.currentStatus.isOnline = false;
    this.currentStatus.connectionType = ConnectionType.NONE;
    this.currentStatus.timestamp = Date.now();

    // 清除带宽和RTT信息
    delete this.currentStatus.downlinkMbps;
    delete this.currentStatus.rtt;

    // 触发事件
    this.eventEmitter.emit(NetworkStatusEvent.OFFLINE, this.currentStatus);
    this.eventEmitter.emit(NetworkStatusEvent.CHANGE, {
      oldStatus,
      newStatus: { ...this.currentStatus },
    });
  }

  /**
   * 处理网络连接变化事件
   */
  private handleConnectionChange(): void {
    this.logger?.debug(NETWORK_ADAPTIVE_LOG_CATEGORY, '网络连接状态发生变化');

    const oldStatus = { ...this.currentStatus };
    this.updateConnectionInfo();

    // 检查是否有实质性变化
    const hasChanged =
      oldStatus.connectionType !== this.currentStatus.connectionType ||
      oldStatus.downlinkMbps !== this.currentStatus.downlinkMbps ||
      oldStatus.rtt !== this.currentStatus.rtt ||
      oldStatus.saveData !== this.currentStatus.saveData;

    if (hasChanged) {
      this.logger?.info(
        NETWORK_ADAPTIVE_LOG_CATEGORY,
        `网络状态变化: ${oldStatus.connectionType} -> ${this.currentStatus.connectionType}, ` +
          `下行速度: ${this.currentStatus.downlinkMbps}Mbps, RTT: ${this.currentStatus.rtt}ms`,
      );

      // 触发事件
      this.eventEmitter.emit(NetworkStatusEvent.CHANGE, {
        oldStatus,
        newStatus: { ...this.currentStatus },
      });
    }
  }

  /**
   * 更新网络连接信息
   */
  private updateConnectionInfo(): void {
    if (!this.supportsNetworkInformation || !this.networkInfo) {
      return;
    }

    try {
      // 获取连接类型
      const effectiveType = this.networkInfo.effectiveType;
      const type = this.networkInfo.type;

      // 设置连接类型
      if (effectiveType) {
        switch (effectiveType) {
          case 'slow-2g':
          case '2g':
            this.currentStatus.connectionType = ConnectionType.CELLULAR_2G;
            break;
          case '3g':
            this.currentStatus.connectionType = ConnectionType.CELLULAR_3G;
            break;
          case '4g':
            this.currentStatus.connectionType = ConnectionType.CELLULAR_4G;
            break;
          default:
            if (type === 'cellular') {
              this.currentStatus.connectionType = ConnectionType.CELLULAR;
            } else if (type === 'wifi') {
              this.currentStatus.connectionType = ConnectionType.WIFI;
            } else if (type === 'ethernet') {
              this.currentStatus.connectionType = ConnectionType.ETHERNET;
            } else {
              this.currentStatus.connectionType = ConnectionType.UNKNOWN;
            }
        }
      } else if (type) {
        switch (type) {
          case 'cellular':
            this.currentStatus.connectionType = ConnectionType.CELLULAR;
            break;
          case 'wifi':
            this.currentStatus.connectionType = ConnectionType.WIFI;
            break;
          case 'ethernet':
            this.currentStatus.connectionType = ConnectionType.ETHERNET;
            break;
          case 'none':
            this.currentStatus.connectionType = ConnectionType.NONE;
            break;
          default:
            this.currentStatus.connectionType = ConnectionType.UNKNOWN;
        }
      }

      // 获取下行带宽
      if (typeof this.networkInfo.downlink === 'number') {
        this.currentStatus.downlinkMbps = this.networkInfo.downlink;
      }

      // 获取RTT
      if (typeof this.networkInfo.rtt === 'number') {
        this.currentStatus.rtt = this.networkInfo.rtt;
      }

      // 获取节省数据模式
      if (typeof this.networkInfo.saveData === 'boolean') {
        this.currentStatus.saveData = this.networkInfo.saveData;
      }

      this.currentStatus.timestamp = Date.now();
    } catch (error) {
      this.logger?.error(
        NETWORK_ADAPTIVE_LOG_CATEGORY,
        `获取网络信息出错: ${(error as Error).message}`,
      );
    }
  }

  /**
   * 更新网络状态
   * @returns 当前网络状态
   */
  updateNetworkStatus(): INetworkStatus {
    // 检查是否在线
    if (typeof navigator !== 'undefined') {
      this.currentStatus.isOnline = navigator.onLine !== false;
    }

    // 更新连接信息
    this.updateConnectionInfo();

    // 如果离线，设置连接类型为NONE
    if (!this.currentStatus.isOnline) {
      this.currentStatus.connectionType = ConnectionType.NONE;
    }

    this.logger?.debug(
      NETWORK_ADAPTIVE_LOG_CATEGORY,
      `当前网络状态: ${this.currentStatus.isOnline ? '在线' : '离线'}, ` +
        `连接类型: ${this.currentStatus.connectionType}` +
        (this.currentStatus.downlinkMbps
          ? `, 下行速度: ${this.currentStatus.downlinkMbps}Mbps`
          : '') +
        (this.currentStatus.rtt ? `, RTT: ${this.currentStatus.rtt}ms` : ''),
    );

    return { ...this.currentStatus };
  }

  /**
   * 获取当前网络状态
   * @returns 当前网络状态
   */
  getCurrentStatus(): INetworkStatus {
    return { ...this.currentStatus };
  }

  /**
   * 检查是否在线
   * @returns 是否在线
   */
  isOnline(): boolean {
    return this.currentStatus.isOnline;
  }

  /**
   * 获取当前连接类型
   * @returns 连接类型
   */
  getConnectionType(): ConnectionType {
    return this.currentStatus.connectionType;
  }

  /**
   * 检查是否支持网络信息API
   * @returns 是否支持网络信息API
   */
  supportsNetworkInfo(): boolean {
    return this.supportsNetworkInformation;
  }

  /**
   * 检查是否为高速连接
   * @returns 是否为高速连接
   */
  isHighSpeedConnection(): boolean {
    // 以太网和WiFi通常被视为高速连接
    if (
      this.currentStatus.connectionType === ConnectionType.ETHERNET ||
      this.currentStatus.connectionType === ConnectionType.WIFI ||
      this.currentStatus.connectionType === ConnectionType.CELLULAR_5G ||
      this.currentStatus.connectionType === ConnectionType.CELLULAR_4G
    ) {
      return true;
    }

    // 如果有下行带宽信息，大于5Mbps视为高速
    if (this.currentStatus.downlinkMbps && this.currentStatus.downlinkMbps >= 5) {
      return true;
    }

    return false;
  }

  /**
   * 检查是否为低速连接
   * @returns 是否为低速连接
   */
  isLowSpeedConnection(): boolean {
    // 2G和3G通常被视为低速连接
    if (
      this.currentStatus.connectionType === ConnectionType.CELLULAR_2G ||
      this.currentStatus.connectionType === ConnectionType.CELLULAR_3G
    ) {
      return true;
    }

    // 如果有下行带宽信息，小于2Mbps视为低速
    if (this.currentStatus.downlinkMbps && this.currentStatus.downlinkMbps < 2) {
      return true;
    }

    // 如果有RTT信息，大于500ms视为低速
    if (this.currentStatus.rtt && this.currentStatus.rtt > 500) {
      return true;
    }

    return false;
  }

  /**
   * 检查是否应该节省数据
   * @returns 是否应该节省数据
   */
  shouldSaveData(): boolean {
    // 如果明确指定了节省数据模式
    if (this.currentStatus.saveData === true) {
      return true;
    }

    // 如果是低速连接
    if (this.isLowSpeedConnection()) {
      return true;
    }

    // 如果是蜂窝网络但不是高速的
    if (
      this.currentStatus.connectionType === ConnectionType.CELLULAR &&
      !this.isHighSpeedConnection()
    ) {
      return true;
    }

    return false;
  }

  /**
   * 测量网络速度
   * 基于实际传输数据量计算更精确的网络速度
   * @param url 测试URL
   * @param sampleSize 样本大小(字节)
   * @returns 网络速度测量结果
   */
  async measureNetworkSpeed(
    url: string = this.currentStatus.isOnline ? '/speed-test' : '',
    sampleSize: number = 200 * 1024,
  ): Promise<{ uploadSpeed: number; downloadSpeed: number }> {
    if (!this.currentStatus.isOnline || !url) {
      return { uploadSpeed: 0, downloadSpeed: 0 };
    }

    try {
      this.logger?.debug(NETWORK_ADAPTIVE_LOG_CATEGORY, '开始测量网络速度');

      // 测量下载速度
      const downloadSpeed = await this.measureDownloadSpeed(url, sampleSize);

      // 测量上传速度
      const uploadSpeed = await this.measureUploadSpeed(url, sampleSize);

      this.logger?.debug(
        NETWORK_ADAPTIVE_LOG_CATEGORY,
        `网络速度测量结果: 下载=${downloadSpeed}Kbps, 上传=${uploadSpeed}Kbps`,
      );

      return { downloadSpeed, uploadSpeed };
    } catch (error) {
      this.logger?.error(
        NETWORK_ADAPTIVE_LOG_CATEGORY,
        `测量网络速度出错: ${(error as Error).message}`,
      );
      return { uploadSpeed: 0, downloadSpeed: 0 };
    }
  }

  /**
   * 测量下载速度
   * @param url 测试URL
   * @param sampleSize 样本大小(字节)
   * @returns 下载速度(Kbps)
   */
  private async measureDownloadSpeed(url: string, sampleSize: number): Promise<number> {
    try {
      // 添加参数以请求特定大小的响应
      const testUrl = `${url}?size=${sampleSize}&t=${Date.now()}`;

      // 记录开始时间
      const startTime = performance.now();

      // 发送请求
      const response = await fetch(testUrl, {
        method: 'GET',
        cache: 'no-cache',
      });

      if (!response.ok) {
        throw new Error(`下载测速失败: ${response.status} ${response.statusText}`);
      }

      // 获取响应数据
      const data = await response.arrayBuffer();

      // 计算实际接收的数据大小(位)
      const actualBits = data.byteLength * 8;

      // 记录结束时间
      const endTime = performance.now();

      // 计算持续时间(秒)
      const duration = (endTime - startTime) / 1000;

      // 如果持续时间太短，可能不准确
      if (duration < 0.1) {
        this.logger?.warn(
          NETWORK_ADAPTIVE_LOG_CATEGORY,
          `下载测速持续时间过短(${duration.toFixed(3)}秒)，结果可能不准确`,
        );
      }

      // 计算速度(Kbps)
      const speedKbps = Math.round(actualBits / 1000 / duration);

      this.logger?.debug(
        NETWORK_ADAPTIVE_LOG_CATEGORY,
        `下载速度: ${speedKbps}Kbps, 数据大小: ${Math.round(
          actualBits / 8 / 1024,
        )}KB, 时间: ${duration.toFixed(2)}秒`,
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
   * @param url 测试URL
   * @param sampleSize 样本大小(字节)
   * @returns 上传速度(Kbps)
   */
  private async measureUploadSpeed(url: string, sampleSize: number): Promise<number> {
    try {
      // 创建随机数据
      const data = new Uint8Array(sampleSize);
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.floor(Math.random() * 256);
      }

      const blob = new Blob([data]);

      // 记录开始时间
      const startTime = performance.now();

      // 发送请求
      const response = await fetch(url, {
        method: 'POST',
        body: blob,
        cache: 'no-cache',
      });

      if (!response.ok) {
        throw new Error(`上传测速失败: ${response.status} ${response.statusText}`);
      }

      // 记录结束时间
      const endTime = performance.now();

      // 计算实际发送的数据大小(位)
      const actualBits = blob.size * 8;

      // 计算持续时间(秒)
      const duration = (endTime - startTime) / 1000;

      // 如果持续时间太短，可能不准确
      if (duration < 0.1) {
        this.logger?.warn(
          NETWORK_ADAPTIVE_LOG_CATEGORY,
          `上传测速持续时间过短(${duration.toFixed(3)}秒)，结果可能不准确`,
        );
      }

      // 计算速度(Kbps)
      const speedKbps = Math.round(actualBits / 1000 / duration);

      this.logger?.debug(
        NETWORK_ADAPTIVE_LOG_CATEGORY,
        `上传速度: ${speedKbps}Kbps, 数据大小: ${Math.round(
          actualBits / 8 / 1024,
        )}KB, 时间: ${duration.toFixed(2)}秒`,
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
}
