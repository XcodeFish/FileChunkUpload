/**
 * Jest 全局设置文件
 *
 * 此文件在每次测试运行前执行，可以用来设置全局配置、模拟对象或扩展Jest匹配器
 */

// 扩展超时时间，适应异步测试需求
jest.setTimeout(10000);

// 模拟localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: jest.fn((key: string) => {
      return store[key] || null;
    }),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = String(value);
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    key: jest.fn((index: number) => {
      return Object.keys(store)[index] || null;
    }),
    get length() {
      return Object.keys(store).length;
    },
  };
})();

// 替换localStorage方法
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// 模拟requestAnimationFrame
global.requestAnimationFrame = (callback: FrameRequestCallback) => {
  return setTimeout(() => callback(Date.now()), 0) as unknown as number;
};

// 模拟cancelAnimationFrame
global.cancelAnimationFrame = (id: number) => {
  clearTimeout(id);
};

// 这个空导出确保文件被视为模块
export {};
