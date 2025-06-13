/**
 * NetworkDetector单元测试
 */

import { NetworkDetector } from '../network-detector';

// 模拟浏览器环境
global.navigator = {
  onLine: true,
  connection: undefined,
} as any;

global.window = {
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  setInterval: jest.fn(() => 123),
  clearInterval: jest.fn(),
  performance: {
    now: jest.fn().mockReturnValueOnce(100).mockReturnValueOnce(150),
  },
} as any;

global.fetch = jest.fn().mockResolvedValue({
  ok: true,
});

// 模拟window.performance.now
global.performance = {
  now: jest.fn().mockReturnValueOnce(100).mockReturnValueOnce(150),
} as any;

// 重置所有模拟函数
beforeEach(() => {
  jest.clearAllMocks();
  (global.navigator as any).onLine = true;
});

describe('NetworkDetector', () => {
  describe('构造函数', () => {
    it('应使用默认选项创建实例', () => {
      const detector = new NetworkDetector();
      expect(detector).toBeDefined();
      expect(window.addEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(window.addEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    });

    it('应接受自定义选项', () => {
      const detector = new NetworkDetector({
        speedTestUrl: '/custom-ping',
        speedTestInterval: 30000,
        autoStart: false,
      });
      expect(detector).toBeDefined();
      expect(window.addEventListener).not.toHaveBeenCalled();
    });
  });

  describe('getCurrentNetwork', () => {
    it('应返回当前网络状态', () => {
      const detector = new NetworkDetector();
      const network = detector.getCurrentNetwork();
      expect(network).toEqual(
        expect.objectContaining({
          online: true,
          type: 'unknown',
          speed: expect.any(Number),
          rtt: expect.any(Number),
        }),
      );
    });
  });

  describe('onNetworkChange', () => {
    it('应注册网络变化监听器并立即执行一次', () => {
      const detector = new NetworkDetector();
      const callback = jest.fn();
      const unsubscribe = detector.onNetworkChange(callback);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(unsubscribe).toBeInstanceOf(Function);

      // 测试取消订阅
      unsubscribe();
      detector['notifyListeners']();
      expect(callback).toHaveBeenCalledTimes(1); // 仍然为1，因为已取消订阅
    });
  });

  describe('isOnline', () => {
    it('应返回navigator.onLine', () => {
      const detector = new NetworkDetector();
      expect(detector.isOnline()).toBe(true);

      // 模拟离线
      (global.navigator as any).onLine = false;
      expect(detector.isOnline()).toBe(false);
    });
  });

  describe('measureNetworkSpeed', () => {
    it('应测量网络速度并返回结果', async () => {
      const detector = new NetworkDetector();
      const speed = await detector.measureNetworkSpeed();

      expect(fetch).toHaveBeenCalled();
      expect(performance.now).toHaveBeenCalledTimes(2);
      expect(speed).toBeGreaterThanOrEqual(0);
    });

    it('离线时应返回0', async () => {
      (global.navigator as any).onLine = false;
      const detector = new NetworkDetector();
      const speed = await detector.measureNetworkSpeed();

      expect(fetch).not.toHaveBeenCalled();
      expect(speed).toBe(0);
    });
  });

  describe('startMonitoring和stopMonitoring', () => {
    it('应启动和停止监听', () => {
      const detector = new NetworkDetector({ autoStart: false });

      // 启动监控
      detector.startMonitoring();
      expect(window.addEventListener).toHaveBeenCalledTimes(2);
      expect(window.setInterval).toHaveBeenCalled();

      // 停止监控
      detector.stopMonitoring();
      expect(window.removeEventListener).toHaveBeenCalledTimes(2);
      expect(window.clearInterval).toHaveBeenCalledWith(123);
    });
  });
});
