/**
 * 模拟的断点续传策略类
 */
export class MockResumeUploadStrategy {
  constructor(options) {
    this.options = options;
  }
  /**
   * 生成文件唯一ID
   */
  generateFileId(file) {
    return `mock-file-id-${file.name}-${file.size}`;
  }
  /**
   * 处理文件分片
   */
  async processFile(file) {
    const fileId = this.generateFileId(file);
    const totalChunks = Math.ceil(file.size / this.options.chunkSize);
    const chunks = Array.from({ length: totalChunks }, (_, index) => {
      const start = index * this.options.chunkSize;
      const end = Math.min(start + this.options.chunkSize, file.size);
      return {
        index,
        start,
        end,
        uploaded: false,
      };
    });
    return {
      fileId,
      fileName: file.name,
      fileSize: file.size,
      chunkSize: this.options.chunkSize,
      totalChunks,
      chunks,
    };
  }
  /**
   * 检查是否存在上传状态
   */
  async hasUploadState(_fileId) {
    // 模拟总是存在上传状态
    return true;
  }
  /**
   * 恢复上传状态
   */
  async resumeUpload(fileId) {
    // 模拟恢复上传状态
    return {
      fileId,
      fileName: 'mock-file.txt',
      fileSize: 1024,
      chunkSize: this.options.chunkSize,
      totalChunks: 2,
      uploadedChunks: [0],
      lastUpdated: Date.now(),
    };
  }
  /**
   * 保存上传状态
   */
  async saveUploadState(state) {
    this.options.logger.debug('保存上传状态', state);
    // 不执行实际操作，仅记录日志
  }
  /**
   * 删除上传状态
   */
  async removeUploadState(fileId) {
    this.options.logger.debug('删除上传状态', fileId);
    // 不执行实际操作，仅记录日志
  }
}
// 模拟存储管理器，用于测试
export class MockStorageManager {
  async init() {}
  async get(key) {
    return { key, value: 'mock-value' };
  }
  async set(_key, _value) {}
  async delete(_key) {}
  async clear() {}
  async close() {}
}
//# sourceMappingURL=type-overrides.js.map
