/**
 * NetworkDetector单元测试
 */

import { NetworkDetector } from '../network-detector';

// 保存原始全局函数
const originalAddEventListener = window.addEventListener;
const originalRemoveEventListener = window.removeEventListener;
const originalSetInterval = window.setInterval;
const originalClearInterval = window.clearInterval;
const originalFetch = global.fetch;

// 模拟事件监听器函数和回调存储
const eventListeners: Record<string, Array<(event?: any) => void>> = {
  online: [],
  offline: [],
  connection: [],
};

// 窗口事件处理函数
const windowAddEventListener = jest.fn((event: string, callback: (event?: any) => void) => {
  eventListeners[event] = eventListeners[event] || [];
  eventListeners[event].push(callback);
});

const windowRemoveEventListener = jest.fn((event: string, callback: (event?: any) => void) => {
  if (eventListeners[event]) {
    const index = eventListeners[event].indexOf(callback);
    if (index !== -1) {
      eventListeners[event].splice(index, 1);
    }
  }
});

// 定时器ID计数器
let timerIdCounter = 1;
const windowSetInterval = jest.fn(() => timerIdCounter++);
const windowClearInterval = jest.fn();

// 辅助函数：触发事件
function triggerEvent(eventName: string, eventData?: any): void {
  const listeners = eventListeners[eventName] || [];
  listeners.forEach(listener => listener(eventData));
}

// 配置可变的导航器在线状态
let navigatorOnLine = true;

// 创建模拟connection对象
const connection = {
  type: 'wifi',
  effectiveType: '4g',
  downlink: 10,
  downlinkMax: 20,
  rtt: 50,
  saveData: false,
  addEventListener: jest.fn((event: string, callback: (event?: any) => void) => {
    eventListeners['connection'] = eventListeners['connection'] || [];
    eventListeners['connection'].push(callback);
  }),
  removeEventListener: jest.fn((event: string, callback: (event?: any) => void) => {
    if (eventListeners['connection']) {
      const index = eventListeners['connection'].indexOf(callback);
      if (index !== -1) {
        eventListeners['connection'].splice(index, 1);
      }
    }
  }),
};

// 使用 jest.fn() 替换 performance.now
const performanceNow = jest
  .fn()
  .mockReturnValueOnce(100) // 第一次调用返回100
  .mockReturnValueOnce(150); // 第二次调用返回150，差值为50ms

// 替换全局函数而不是整个对象
beforeAll(() => {
  // 模拟navigator.onLine
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: () => navigatorOnLine,
  });

  // 模拟navigator.connection
  Object.defineProperty(navigator, 'connection', {
    configurable: true,
    get: () => connection,
  });

  // 模拟window方法 - 使用类型断言解决类型问题
  window.addEventListener = windowAddEventListener as unknown as typeof window.addEventListener;
  window.removeEventListener =
    windowRemoveEventListener as unknown as typeof window.removeEventListener;
  window.setInterval = windowSetInterval as unknown as typeof window.setInterval;
  window.clearInterval = windowClearInterval as unknown as typeof window.clearInterval;

  // 模拟performance.now
  performance.now = performanceNow;

  // 模拟fetch
  global.fetch = jest.fn().mockImplementation(() => {
    return Promise.resolve({
      ok: true,
    });
  });
});

// 测试结束后恢复全局函数
afterAll(() => {
  // 恢复window方法
  window.addEventListener = originalAddEventListener;
  window.removeEventListener = originalRemoveEventListener;
  window.setInterval = originalSetInterval;
  window.clearInterval = originalClearInterval;

  // 恢复fetch
  global.fetch = originalFetch;

  // 恢复navigator属性
  if (Object.hasOwnProperty.call(navigator, 'connection')) {
    delete (navigator as any).connection;
  }
});

describe('NetworkDetector', () => {
  // 每次测试前重置状态
  beforeEach(() => {
    jest.clearAllMocks();
    navigatorOnLine = true;

    // 清空事件监听器
    Object.keys(eventListeners).forEach(key => {
      eventListeners[key] = [];
    });

    // 重置定时器计数器
    timerIdCounter = 1;
  });

  describe('构造函数', () => {
    it('应使用默认选项创建实例', () => {
      const detector = new NetworkDetector();
      expect(detector).toBeDefined();
      expect(windowAddEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(windowAddEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    });

    it('应接受自定义选项', () => {
      const detector = new NetworkDetector({
        speedTestUrl: '/custom-ping',
        speedTestInterval: 30000,
        autoStart: false,
      });
      expect(detector).toBeDefined();
      expect(windowAddEventListener).not.toHaveBeenCalled();
    });
  });

  describe('getCurrentNetwork', () => {
    it('应返回当前网络状态', () => {
      const detector = new NetworkDetector();
      const network = detector.getCurrentNetwork();
      expect(network).toEqual(
        expect.objectContaining({
          online: true,
          type: 'wifi',
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

      // 模拟网络变化
      navigatorOnLine = false;
      triggerEvent('offline');

      expect(callback).toHaveBeenCalledTimes(2);

      // 测试取消订阅
      unsubscribe();

      // 再次模拟网络变化
      navigatorOnLine = true;
      triggerEvent('online');

      // 回调应该仍然是2次，因为已取消订阅
      expect(callback).toHaveBeenCalledTimes(2);
    });
  });

  describe('isOnline', () => {
    it('应返回navigator.onLine', () => {
      const detector = new NetworkDetector();
      expect(detector.isOnline()).toBe(true);

      // 模拟离线
      navigatorOnLine = false;
      expect(detector.isOnline()).toBe(false);
    });
  });

  describe('measureNetworkSpeed', () => {
    it('应测量网络速度并返回结果', async () => {
      const detector = new NetworkDetector();
      const speed = await detector.measureNetworkSpeed();

      expect(global.fetch).toHaveBeenCalled();
      expect(performanceNow).toHaveBeenCalledTimes(2);
      expect(speed).toBeGreaterThanOrEqual(0);
    });

    it('离线时应返回0', async () => {
      navigatorOnLine = false;
      const detector = new NetworkDetector();
      const speed = await detector.measureNetworkSpeed();

      expect(global.fetch).not.toHaveBeenCalled();
      expect(speed).toBe(0);
    });
  });

  describe('startMonitoring和stopMonitoring', () => {
    it('应启动和停止监听', () => {
      const detector = new NetworkDetector({ autoStart: false });

      // 启动监控
      detector.startMonitoring();
      expect(windowAddEventListener).toHaveBeenCalledTimes(2);
      expect(windowSetInterval).toHaveBeenCalled();

      // 停止监控
      detector.stopMonitoring();
      expect(windowRemoveEventListener).toHaveBeenCalledTimes(2);
      expect(windowClearInterval).toHaveBeenCalled();
    });
  });
});
