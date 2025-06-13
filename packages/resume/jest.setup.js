/* global jest, expect, afterAll */
/* eslint-disable @typescript-eslint/no-var-requires */

// MockIndexedDB 全局模拟设置
require('fake-indexeddb/auto');

// 扩展 Jest 匹配器
const { toHaveNoViolations } = require('jest-axe');
expect.extend(toHaveNoViolations);

// 全局模拟 console 中的某些方法以防止测试输出过多日志
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

// 在测试中可能需要模拟这些方法以减少输出
console.error = jest.fn((...args) => {
  // 可以在这里添加过滤条件，如不输出特定消息
  if (process.env.NODE_ENV !== 'test:silent') {
    originalConsoleError(...args);
  }
});

console.warn = jest.fn((...args) => {
  if (process.env.NODE_ENV !== 'test:silent') {
    originalConsoleWarn(...args);
  }
});

console.log = jest.fn((...args) => {
  if (process.env.NODE_ENV !== 'test:silent') {
    originalConsoleLog(...args);
  }
});

// 模拟 DOM 存储 API
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  },
  writable: true,
});

Object.defineProperty(window, 'sessionStorage', {
  value: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  },
  writable: true,
});

// 模拟 Blob API
global.Blob = class Blob {
  constructor(content, options) {
    this.content = content;
    this.options = options;
    this.size = content.reduce((acc, val) => acc + (val.length || 0), 0);
    this.type = options?.type || '';
  }

  // 简单模拟 slice 方法
  slice(start, end, contentType) {
    return new Blob([this.content[0].slice(start, end)], {
      type: contentType || this.type,
    });
  }

  // 简单模拟 text 方法
  async text() {
    return this.content.join('');
  }

  // 简单模拟 arrayBuffer 方法
  async arrayBuffer() {
    const text = this.content.join('');
    const buf = new ArrayBuffer(text.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < text.length; i++) {
      view[i] = text.charCodeAt(i);
    }
    return buf;
  }
};

// 模拟 FileReader API
global.FileReader = class FileReader {
  constructor() {
    this.onload = null;
    this.onerror = null;
  }

  readAsArrayBuffer(blob) {
    Promise.resolve(blob.arrayBuffer())
      .then(buffer => {
        if (this.onload) {
          this.onload({ target: { result: buffer } });
        }
      })
      .catch(error => {
        if (this.onerror) {
          this.onerror({ target: { error } });
        }
      });
  }

  readAsText(blob) {
    Promise.resolve(blob.text())
      .then(text => {
        if (this.onload) {
          this.onload({ target: { result: text } });
        }
      })
      .catch(error => {
        if (this.onerror) {
          this.onerror({ target: { error } });
        }
      });
  }
};

// 模拟 File API
global.File = class File extends Blob {
  constructor(bits, name, options = {}) {
    super(bits, options);
    this.name = name;
    this.lastModified = options.lastModified || Date.now();
  }
};

// 清理函数
afterAll(() => {
  // 还原被模拟的控制台方法
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  console.log = originalConsoleLog;
});
