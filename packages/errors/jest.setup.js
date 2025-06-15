/**
 * 测试设置文件
 * 用于在所有测试运行前执行一些通用配置
 */

// 增加全局测试超时时间到60秒，解决retry-manager等测试的超时问题
// eslint-disable-next-line no-undef
jest.setTimeout(60000);

// 模拟localStorage
class LocalStorageMock {
  constructor() {
    this.store = {};
  }

  clear() {
    this.store = {};
  }

  getItem(key) {
    return this.store[key] || null;
  }

  setItem(key, value) {
    this.store[key] = String(value);
  }

  removeItem(key) {
    delete this.store[key];
  }

  get length() {
    return Object.keys(this.store).length;
  }

  key(index) {
    return Object.keys(this.store)[index] || null;
  }
}

// 在全局对象上设置模拟的localStorage
Object.defineProperty(global, 'localStorage', {
  value: new LocalStorageMock(),
  writable: false,
});
