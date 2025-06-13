/**
 * 网络自适应策略模块
 * 提供根据网络状况自适应调整上传参数的功能
 * @packageDocumentation
 */

// 导出配置相关
export { NetworkQualityLevel, DEFAULT_ADAPTIVE_CONFIG } from './adaptive-config';
export type { IAdaptiveConfig } from './adaptive-config';

// 导出网络测速器相关
export { NetworkSpeedTester, SpeedTestEvent } from './network-speed-tester';
export type { ISpeedTestResult } from './network-speed-tester';

// 导出网络状态检测器相关
export { NetworkDetector, NetworkStatusEvent, ConnectionType } from './network-detector';
export type { INetworkStatus } from './network-detector';

// 导出自适应管理器相关
export { AdaptiveManager, AdaptiveEvent } from './adaptive-manager';
export type { IAdaptiveParams } from './adaptive-manager';

// 移除TODO注释，因为已经实现了自适应网络策略
