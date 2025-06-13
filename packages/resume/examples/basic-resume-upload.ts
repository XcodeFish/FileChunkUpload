/**
 * @file-chunk-uploader/resume 基本使用示例
 * 演示如何使用断点续传功能上传文件
 */
import { EventEmitter } from '@file-chunk-uploader/core/src/events';

import { ResumeUploadStrategy, ChunkStatus } from '../src';

// 模拟上传端点URL
// const _UPLOAD_URL = 'https://api.example.com/upload';

/**
 * 模拟HTTP请求上传分片
 * @param chunk 分片数据
 * @param index 分片索引
 * @param fileId 文件ID
 */
async function uploadChunk(chunk: Blob, index: number, fileId: string): Promise<void> {
  // 创建FormData
  const formData = new FormData();
  formData.append('chunk', chunk);
  formData.append('index', String(index));
  formData.append('fileId', fileId);

  // 模拟上传，实际应用中使用fetch或其他HTTP客户端
  logToUI(`上传分片 ${index} (${chunk.size} bytes)...`);

  // 模拟网络延迟
  await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

  // 模拟偶发性失败（仅用于演示失败恢复）
  if (Math.random() < 0.1) {
    throw new Error(`分片 ${index} 上传失败（模拟错误）`);
  }

  logToUI(`分片 ${index} 上传成功`, 'success');
}

/**
 * 模拟API合并请求
 * @param fileId 文件ID
 * @param totalChunks 分片总数
 */
async function mergeChunks(fileId: string, totalChunks: number): Promise<void> {
  logToUI(`请求服务器合并 ${totalChunks} 个分片...`);

  // 模拟网络延迟
  await new Promise(resolve => setTimeout(resolve, 1000));

  logToUI('文件合并成功，上传完成', 'success');
}

/**
 * 演示断点续传功能
 * @param file 要上传的文件
 */
async function demonstrateResumeUpload(file: File): Promise<void> {
  // 使用全局事件总线或创建新的事件发射器
  const myEventEmitter = new EventEmitter();

  // 禁用上传按钮
  const uploadButton = document.getElementById('uploadButton') as HTMLButtonElement;
  uploadButton.disabled = true;

  // 设置事件监听器
  setupEventListeners(myEventEmitter);

  // 创建续传策略
  const resumeStrategy = new ResumeUploadStrategy({
    storage: {
      dbName: 'resume-upload-demo',
      storeName: 'file-uploads',
      version: 1,
    },
    maxConcurrentChunks: 3,
    logger: console,
  });

  // 设置事件发射器
  resumeStrategy.setEventEmitter(myEventEmitter);

  try {
    // 生成文件ID - 这里使用简单的哈希函数生成ID
    const fileId = generateFileId(file);
    logToUI(`文件ID: ${fileId}`);

    // 检查是否有已保存的上传状态
    const hasState = await checkHasUploadState(resumeStrategy, fileId);

    if (hasState) {
      // 恢复上传
      logToUI('发现已保存的上传状态，准备恢复上传...', 'info');

      // 获取上传状态
      const uploadState = await getUploadState(resumeStrategy, fileId);
      logToUI(
        `恢复上传 "${file.name}"，` +
          `已完成: ${uploadState?.uploadedChunks?.length || 0}/${
            uploadState?.totalChunks || 0
          } 分片`,
      );

      // 处理文件
      const fileInfo = await processFile(file);

      // 更新进度条
      const initialProgress =
        ((uploadState?.uploadedChunks?.length || 0) / fileInfo.totalChunks) * 100;
      updateProgressBar(initialProgress);

      // 上传剩余分片
      await uploadRemainingChunks(
        resumeStrategy,
        fileId,
        fileInfo.chunks,
        uploadState?.uploadedChunks || [],
      );
    } else {
      // 开始新上传
      logToUI(`开始新上传: "${file.name}" (${formatSize(file.size)})`, 'info');

      // 处理文件
      const fileInfo = await processFile(file);
      logToUI(
        `文件已分为 ${fileInfo.totalChunks} 个分片，每个分片大小约为 ${formatSize(
          fileInfo.chunkSize,
        )}`,
      );

      // 上传所有分片
      await uploadRemainingChunks(resumeStrategy, fileId, fileInfo.chunks, []);
    }

    // 完成上传，清理存储
    await resumeStrategy.completeUpload(fileId);

    // 模拟调用API合并分片
    await mergeChunks(fileId, file.size);

    // 更新UI
    updateProgressBar(100);
    logToUI('上传完成！', 'success');
  } catch (error) {
    logToUI(`上传过程中发生错误: ${(error as Error).message}`, 'error');
    console.error('上传过程中发生错误:', error);
  } finally {
    // 销毁资源
    resumeStrategy.destroy();

    // 恢复上传按钮
    uploadButton.disabled = false;
  }
}

/**
 * 检查是否有上传状态
 * @param resumeStrategy 续传策略实例
 * @param fileId 文件ID
 */
async function checkHasUploadState(
  resumeStrategy: ResumeUploadStrategy,
  fileId: string,
): Promise<boolean> {
  // 由于storageManager是私有的，我们可以通过公开的API检查是否存在上传状态
  // 这里使用resumeStrategy提供的公开方法或属性
  const state = await getUploadState(resumeStrategy, fileId);
  return !!state;
}

/**
 * 获取上传状态
 * @param resumeStrategy 续传策略实例
 * @param fileId 文件ID
 */
async function getUploadState(resumeStrategy: ResumeUploadStrategy, fileId: string): Promise<any> {
  // 这里使用resumeStrategy提供的公开方法获取上传状态
  // 假设通过getChunksDetails可以获取到分片详情
  try {
    const chunksDetails = await resumeStrategy.getChunksDetails(fileId);
    if (chunksDetails && chunksDetails.length > 0) {
      // 提取已上传的分片索引
      const uploadedChunks = chunksDetails
        .filter(chunk => chunk.status === ChunkStatus.SUCCESS)
        .map(chunk => chunk.index);

      return {
        uploadedChunks,
        totalChunks: chunksDetails.length,
      };
    }
  } catch (error) {
    console.log('获取上传状态失败:', error);
  }
  return null;
}

/**
 * 处理文件，将文件分为多个分片
 * @param file 文件对象
 * @returns 分片结果
 */
async function processFile(file: File) {
  // 分片大小 1MB
  const chunkSize = 1024 * 1024;
  const chunks: Blob[] = [];

  // 分片处理
  for (let start = 0; start < file.size; start += chunkSize) {
    const end = Math.min(start + chunkSize, file.size);
    const chunk = file.slice(start, end);
    chunks.push(chunk);
  }

  return {
    chunks,
    totalChunks: chunks.length,
    chunkSize,
  };
}

/**
 * 生成文件ID
 * @param file 文件对象
 * @returns 文件ID
 */
function generateFileId(file: File): string {
  // 使用文件名、大小和最后修改时间组合生成ID
  const hashInput = `${file.name}-${file.size}-${file.lastModified}`;

  // 简单哈希函数
  let hash = 0;
  for (let i = 0; i < hashInput.length; i++) {
    const char = hashInput.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // 转换为32位整数
  }

  return Math.abs(hash).toString(16);
}

/**
 * 上传剩余的文件分片
 * @param resumeStrategy 续传策略实例
 * @param fileId 文件ID
 * @param chunks 所有分片
 * @param uploadedChunks 已上传的分片索引
 */
async function uploadRemainingChunks(
  resumeStrategy: ResumeUploadStrategy,
  fileId: string,
  chunks: Blob[],
  uploadedChunks: number[],
): Promise<void> {
  // 创建已上传分片集合，便于快速查找
  const uploadedSet = new Set(uploadedChunks);

  // 使用Promise.all并行上传，但限制并发数
  const concurrency = 3;
  let pending = 0;
  const promises: Promise<void>[] = [];

  // 更新进度条计算基础
  let completedChunks = uploadedChunks.length;
  const totalChunks = chunks.length;

  // 更新初始进度
  updateProgressBar((completedChunks / totalChunks) * 100);

  for (let i = 0; i < chunks.length; i++) {
    // 跳过已上传的分片
    if (uploadedSet.has(i)) {
      logToUI(`分片 ${i} 已上传，跳过`);
      continue;
    }

    // 等待并发控制
    if (pending >= concurrency) {
      await Promise.race(promises);
    }

    // 上传分片
    pending++;
    const promise = (async (index: number) => {
      try {
        await uploadChunk(chunks[index], index, fileId);

        // 保存上传进度
        await resumeStrategy.updateChunkStatus(fileId, index, ChunkStatus.SUCCESS);

        // 更新计数器和进度条
        pending--;
        completedChunks++;
        updateProgressBar((completedChunks / totalChunks) * 100);
      } catch (error) {
        pending--;

        // 记录失败，但不中断其他上传
        logToUI(`分片 ${index} 上传失败: ${(error as Error).message}`, 'error');
        await resumeStrategy.updateChunkStatus(
          fileId,
          index,
          ChunkStatus.FAILED,
          (error as Error).message,
        );

        // 重新抛出错误
        throw error;
      }
    })(i);

    // 添加到Promise数组
    promises.push(promise);
  }

  // 等待所有上传完成
  await Promise.allSettled(promises);

  // 检查是否有失败的Promise
  const failedCount = promises.length - uploadedChunks.length;
  if (failedCount > 0) {
    throw new Error(`${failedCount} 个分片上传失败，使用断点续传功能可以继续上传`);
  }
}

/**
 * 设置事件监听器
 * @param eventEmitter 事件发射器
 */
function setupEventListeners(eventEmitter: any): void {
  eventEmitter.on('upload:progress', (data: any) => {
    logToUI(`上传进度: ${Math.round(data.progress)}%`);
    updateProgressBar(data.progress);
  });

  eventEmitter.on('upload:resume', (data: any) => {
    logToUI(
      `续传开始: "${data.fileName}", 已完成: ${data.uploadedChunks.length}/${data.totalChunks} 分片`,
      'info',
    );
  });

  eventEmitter.on('upload:complete', (data: any) => {
    logToUI(`上传完成: "${data.fileName}"`, 'success');
    updateProgressBar(100);
  });

  eventEmitter.on('upload:error', (data: any) => {
    logToUI(`上传错误: ${data.error.message}`, 'error');
  });

  eventEmitter.on('storage:cleanup', (data: any) => {
    logToUI(`清理存储: 删除了 ${data.count} 个过期状态`, 'info');
  });
}

/**
 * 更新进度条
 * @param progress 进度值(0-100)
 */
function updateProgressBar(progress: number): void {
  const progressBar = document.getElementById('progressBar') as HTMLElement;
  if (progressBar) {
    progressBar.style.width = `${Math.round(progress)}%`;
  }
}

/**
 * 向UI日志区域添加日志
 * @param message 日志信息
 * @param type 日志类型
 */
function logToUI(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info'): void {
  const logArea = document.getElementById('logArea');
  if (logArea) {
    const logEntry = document.createElement('div');
    logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logEntry.className = `log-entry ${type}`;
    logArea.appendChild(logEntry);
    logArea.scrollTop = logArea.scrollHeight; // 自动滚动到最新日志

    // 同时在控制台输出
    console.log(message);
  }
}

/**
 * 格式化文件大小
 * @param bytes 字节数
 */
function formatSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 在DOM加载完成后设置事件处理
document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('fileInput') as HTMLInputElement;
  const uploadButton = document.getElementById('uploadButton') as HTMLButtonElement;
  const pauseButton = document.getElementById('pauseButton') as HTMLButtonElement;
  const resumeButton = document.getElementById('resumeButton') as HTMLButtonElement;

  // 初始化UI
  logToUI('请选择一个文件进行上传', 'info');

  // 上传按钮事件
  uploadButton.addEventListener('click', async () => {
    if (fileInput.files && fileInput.files.length > 0) {
      const file = fileInput.files[0];

      // 启用暂停按钮
      pauseButton.disabled = false;

      try {
        await demonstrateResumeUpload(file);
      } catch (error) {
        logToUI(`上传失败: ${(error as Error).message}`, 'error');
      } finally {
        // 禁用暂停按钮
        pauseButton.disabled = true;
      }
    } else {
      logToUI('请先选择文件', 'warning');
    }
  });

  // 文件选择事件
  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files.length > 0) {
      const file = fileInput.files[0];
      logToUI(`已选择文件: ${file.name} (${formatSize(file.size)})`, 'info');
      uploadButton.disabled = false;
    }
  });

  // 暂停按钮和恢复按钮事件 - 在实际应用中实现
  pauseButton.addEventListener('click', () => {
    logToUI('暂停功能在这个简化示例中未实现', 'warning');
  });

  resumeButton.addEventListener('click', () => {
    logToUI('恢复功能在这个简化示例中未实现', 'warning');
  });
});
