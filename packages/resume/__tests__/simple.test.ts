/**
 * 简单测试文件，用于验证测试环境配置
 */
describe('测试环境验证', () => {
  it('Jest能够正常运行', () => {
    expect(1 + 1).toBe(2);
  });

  it('能够模拟IndexedDB', () => {
    // 测试是否已正确模拟IndexedDB
    expect(typeof indexedDB).toBe('object');
    expect(indexedDB).not.toBeNull();
  });

  it('能够访问文件API', () => {
    // 测试是否已正确模拟File API
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    expect(file.name).toBe('test.txt');
    expect(file.size).toBe(12); // 'test content'.length
    expect(file.type).toBe('text/plain');
  });
});
