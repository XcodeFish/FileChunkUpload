/**
 * 文件分片上传最小化示例
 * 这个例子展示了@file-chunk-uploader/core的基本用法
 */
import { FileUploader } from '@file-chunk-uploader/core';
import { EventName, LogLevel } from '@file-chunk-uploader/types';

// 获取DOM元素
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resumeBtn = document.getElementById('resumeBtn');
const cancelBtn = document.getElementById('cancelBtn');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const eventLogs = document.getElementById('eventLogs');

// 上传任务ID，用于控制暂停/恢复/取消
let currentFileId = null;

// 初始化上传器实例
const uploader = new FileUploader({
  // 注意: 在实际使用中，需要将此URL更改为您的服务器端点
  target: 'https://httpbin.org/post', // 演示用，实际使用时替换为真实的上传端点
  method: 'POST',
  // 启用开发者模式以查看详细日志
  devMode: {
    enabled: true,
    logger: {
      level: LogLevel.DEBUG,
      filter: ['core', 'network'],
    },
  },
});

// 添加事件监听
uploadBtn.addEventListener('click', handleUpload);
pauseBtn.addEventListener('click', handlePause);
resumeBtn.addEventListener('click', handleResume);
cancelBtn.addEventListener('click', handleCancel);

// 监听上传器事件
setupUploaderEvents();

/**
 * 处理上传按钮点击事件
 */
async function handleUpload() {
  const file = fileInput.files?.[0];
  if (!file) {
    addLog('错误', '请选择文件');
    return;
  }

  try {
    // 更新UI状态
    updateButtonStates(true);
    progressText.textContent = '准备上传...';

    // 开始上传
    addLog('信息', `开始上传文件: ${file.name} (${formatFileSize(file.size)})`);

    // 上传文件并等待结果
    const result = await uploader.upload(file);

    // 处理上传结果
    if (result.success) {
      addLog('成功', `文件上传成功: ${file.name}`);
      progressText.textContent = '上传完成 - 100%';
    } else {
      addLog('错误', `上传失败: ${result.error?.message || '未知错误'}`);
      progressText.textContent = '上传失败';
    }
  } catch (error) {
    addLog('错误', `上传过程出错: ${error.message}`);
    progressText.textContent = '上传出错';
  } finally {
    // 重置UI状态
    updateButtonStates(false);
  }
}

/**
 * 处理暂停按钮点击事件
 */
function handlePause() {
  if (currentFileId) {
    uploader.pause(currentFileId);
    addLog('信息', '已暂停上传');
    pauseBtn.disabled = true;
    resumeBtn.disabled = false;
  }
}

/**
 * 处理恢复按钮点击事件
 */
function handleResume() {
  if (currentFileId) {
    uploader.resume(currentFileId);
    addLog('信息', '已恢复上传');
    pauseBtn.disabled = false;
    resumeBtn.disabled = true;
  }
}

/**
 * 处理取消按钮点击事件
 */
function handleCancel() {
  if (currentFileId) {
    uploader.cancel(currentFileId);
    addLog('信息', '已取消上传');
    updateButtonStates(false);
    progressText.textContent = '上传已取消';
    progressFill.style.width = '0%';
  }
}

/**
 * 设置上传器事件监听
 */
function setupUploaderEvents() {
  // 文件添加事件
  uploader.on(EventName.FILE_ADDED, event => {
    currentFileId = event.file.id;
    addLog('信息', `文件已添加: ${event.file.name}`);
  });

  // 上传开始事件
  uploader.on(EventName.UPLOAD_START, event => {
    addLog('信息', `文件开始上传: ${event.file.name}`);
  });

  // 上传进度事件
  uploader.on(EventName.UPLOAD_PROGRESS, event => {
    const progress = event.progress.percentage;
    updateProgressBar(progress);

    // 不要记录太多进度日志，只记录整数百分比变化
    if (Math.floor(progress) % 10 === 0) {
      const speed = event.progress.speed ? `${formatSpeed(event.progress.speed)}` : '计算中...';

      const eta = event.progress.remainingTime
        ? `剩余时间: ${formatTime(event.progress.remainingTime)}`
        : '';

      addLog('进度', `上传进度: ${progress.toFixed(1)}% | 速度: ${speed} ${eta}`);
    }
  });

  // 上传暂停事件
  uploader.on(EventName.UPLOAD_PAUSE, event => {
    addLog('信息', `上传已暂停: ${event.name}`);
    progressText.textContent = `已暂停 - ${uploader.getProgress(currentFileId)}%`;
  });

  // 上传恢复事件
  uploader.on(EventName.UPLOAD_RESUME, event => {
    addLog('信息', `上传已恢复: ${event.name}`);
  });

  // 上传成功事件
  uploader.on(EventName.UPLOAD_SUCCESS, event => {
    const duration = formatTime(event.duration);
    addLog('成功', `上传成功: ${event.file.name} (用时: ${duration})`);
  });

  // 上传错误事件
  uploader.on(EventName.UPLOAD_ERROR, event => {
    addLog('错误', `上传错误: ${event.file.name} - ${event.error.message}`);
    progressText.textContent = `上传失败 - ${uploader.getProgress(currentFileId)}%`;
  });

  // 上传取消事件
  uploader.on(EventName.UPLOAD_CANCEL, event => {
    addLog('信息', `上传已取消: ${event.name}`);
  });
}

/**
 * 更新进度条
 * @param {number} progress - 进度百分比(0-100)
 */
function updateProgressBar(progress) {
  progressFill.style.width = `${progress}%`;
  progressText.textContent = `上传中 - ${progress.toFixed(1)}%`;
}

/**
 * 更新按钮状态
 * @param {boolean} isUploading - 是否正在上传
 */
function updateButtonStates(isUploading) {
  uploadBtn.disabled = isUploading;
  pauseBtn.disabled = !isUploading;
  resumeBtn.disabled = true;
  cancelBtn.disabled = !isUploading;

  if (!isUploading) {
    currentFileId = null;
  }
}

/**
 * 添加日志条目到日志区域
 * @param {string} type - 日志类型
 * @param {string} message - 日志消息
 */
function addLog(type, message) {
  const date = new Date();
  const time = date.toTimeString().split(' ')[0];
  const milliseconds = date.getMilliseconds().toString().padStart(3, '0');

  const logEntry = document.createElement('div');
  logEntry.innerHTML = `<span style="color: #888;">[${time}.${milliseconds}]</span> <span style="color: ${getLogTypeColor(
    type,
  )};">[${type}]</span> ${message}`;

  eventLogs.appendChild(logEntry);
  eventLogs.scrollTop = eventLogs.scrollHeight;
}

/**
 * 获取日志类型对应的颜色
 * @param {string} type - 日志类型
 * @returns {string} 颜色代码
 */
function getLogTypeColor(type) {
  switch (type) {
    case '成功':
      return '#4CAF50';
    case '错误':
      return '#f44336';
    case '警告':
      return '#ff9800';
    case '进度':
      return '#2196F3';
    default:
      return '#666';
  }
}

/**
 * 格式化文件大小
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的文件大小
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';

  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));

  return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i];
}

/**
 * 格式化上传速度
 * @param {number} bytesPerSecond - 每秒字节数
 * @returns {string} 格式化后的上传速度
 */
function formatSpeed(bytesPerSecond) {
  if (bytesPerSecond < 1024) {
    return bytesPerSecond.toFixed(2) + ' B/s';
  } else if (bytesPerSecond < 1024 * 1024) {
    return (bytesPerSecond / 1024).toFixed(2) + ' KB/s';
  } else {
    return (bytesPerSecond / (1024 * 1024)).toFixed(2) + ' MB/s';
  }
}

/**
 * 格式化时间（毫秒转为可读时间）
 * @param {number} milliseconds - 毫秒数
 * @returns {string} 格式化后的时间
 */
function formatTime(milliseconds) {
  if (milliseconds < 1000) {
    return milliseconds + 'ms';
  }

  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}
