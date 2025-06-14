/**
 * 重试状态可视化示例
 * 展示文件上传过程中的重试机制状态可视化
 */
import { FileUploader } from '@file-chunk-uploader/core';
import { EventName, LogLevel } from '@file-chunk-uploader/types';

// DOM元素
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resumeBtn = document.getElementById('resumeBtn');
const cancelBtn = document.getElementById('cancelBtn');
const simulateErrorBtn = document.getElementById('simulateErrorBtn');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const eventLogs = document.getElementById('eventLogs');

// 重试可视化元素
const retryStatus = document.getElementById('retryStatus');
const countdownContainer = document.getElementById('countdownContainer');
const countdownFill = document.getElementById('countdownFill');
const countdownText = document.getElementById('countdownText');
const totalRetriesValue = document.getElementById('totalRetriesValue');
const successRetriesValue = document.getElementById('successRetriesValue');
const failedRetriesValue = document.getElementById('failedRetriesValue');
const remainingRetriesValue = document.getElementById('remainingRetriesValue');
const qualityIndicator = document.getElementById('qualityIndicator');
const qualityText = document.getElementById('qualityText');
const networkType = document.getElementById('networkType');
const networkDetails = document.getElementById('networkDetails');

// 上传任务ID
let currentFileId = null;

// 重试统计数据
const retryStats = {
  total: 0,
  success: 0,
  failed: 0,
  maxRetries: 3,
  currentCountdown: null,
};

// 网络质量数据
const networkQuality = {
  type: 'unknown',
  speed: 0,
  rtt: 0,
};

// 倒计时定时器
let countdownTimer = null;

// 模拟错误的网络条件 (用于演示)
const simulateNetworkConditions = [
  { online: true, type: 'wifi', speed: 10, rtt: 50 }, // 优秀
  { online: true, type: 'wifi', speed: 5, rtt: 100 }, // 良好
  { online: true, type: 'cellular', speed: 2, rtt: 200 }, // 一般
  { online: true, type: 'cellular', speed: 0.5, rtt: 500 }, // 较差
  { online: false, type: 'unknown', speed: 0, rtt: 1000 }, // 离线
];

// 初始化上传器实例
const uploader = new FileUploader({
  // 使用模拟的上传端点，确保偶尔会失败以展示重试机制
  target: 'https://httpbin.org/status/429',
  method: 'POST',
  // 设置重试相关配置
  retryConfig: {
    enabled: true,
    maxRetries: retryStats.maxRetries,
    baseDelay: 3000, // 基础延迟3秒，方便演示倒计时
    maxDelay: 10000, // 最大延迟10秒
    useExponentialBackoff: true,
    persistRetryState: true,
  },
  // 启用开发者模式
  devMode: {
    enabled: true,
    logger: {
      level: LogLevel.DEBUG,
      filter: ['core', 'network', 'errors'],
    },
  },
});

// 添加事件监听
uploadBtn.addEventListener('click', handleUpload);
pauseBtn.addEventListener('click', handlePause);
resumeBtn.addEventListener('click', handleResume);
cancelBtn.addEventListener('click', handleCancel);
simulateErrorBtn.addEventListener('click', handleSimulateError);

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
    // 重置重试统计
    resetRetryStats();

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
      updateRetryStatus('success', '成功');
    } else {
      addLog('错误', `上传失败: ${result.error?.message || '未知错误'}`);
      progressText.textContent = '上传失败';
      updateRetryStatus('failed', '失败');
    }
  } catch (error) {
    addLog('错误', `上传过程出错: ${error.message}`);
    progressText.textContent = '上传出错';
    updateRetryStatus('failed', '失败');
  } finally {
    // 重置UI状态
    updateButtonStates(false);
    simulateErrorBtn.disabled = true;
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
    updateRetryStatus('idle', '空闲');
    stopCountdown();
  }
}

/**
 * 处理模拟错误按钮点击事件
 */
function handleSimulateError() {
  addLog('信息', '模拟网络错误...');

  // 随机选择一种网络条件
  const conditionIndex = Math.floor(Math.random() * simulateNetworkConditions.length);
  const condition = simulateNetworkConditions[conditionIndex];

  // 更新网络质量显示
  updateNetworkQuality(condition);

  // 人为触发一个错误事件
  uploader.emit(EventName.UPLOAD_ERROR, {
    file: { id: currentFileId, name: fileInput.files?.[0]?.name || '未知文件' },
    error: {
      message: '模拟的网络错误',
      code: condition.online ? 'network_error' : 'network_disconnect',
    },
  });
}

/**
 * 设置上传器事件监听
 */
function setupUploaderEvents() {
  // 文件添加事件
  uploader.on(EventName.FILE_ADDED, event => {
    currentFileId = event.file.id;
    addLog('信息', `文件已添加: ${event.file.name}`);
    simulateErrorBtn.disabled = false;
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
    simulateErrorBtn.disabled = true;
  });

  // 上传错误事件
  uploader.on(EventName.UPLOAD_ERROR, event => {
    addLog('错误', `上传错误: ${event.file.name} - ${event.error.message}`);
    progressText.textContent = `上传失败 - ${uploader.getProgress(currentFileId)}%`;

    // 更新重试统计
    retryStats.total++;
    updateRetryStatsDisplay();
  });

  // 上传取消事件
  uploader.on(EventName.UPLOAD_CANCEL, event => {
    addLog('信息', `上传已取消: ${event.name}`);
    simulateErrorBtn.disabled = true;
  });

  // 重试事件监听 - 开始重试
  uploader.on('retry:start', event => {
    addLog('重试', `准备开始第${event.retryCount}次重试，延迟: ${event.delay / 1000}秒`);
    updateRetryStatus('retrying', '重试中');

    // 开始倒计时
    startCountdown(event.delay);

    // 随机选择一种网络条件 (模拟网络状况变化)
    const conditionIndex = Math.floor(Math.random() * (simulateNetworkConditions.length - 1));
    updateNetworkQuality(simulateNetworkConditions[conditionIndex]);
  });

  // 重试事件监听 - 重试成功
  uploader.on('retry:success', event => {
    addLog('重试', `第${event.successCount}次重试成功`);
    retryStats.success++;
    updateRetryStatsDisplay();
    updateRetryStatus('success', '成功');
    stopCountdown();
  });

  // 重试事件监听 - 重试失败
  uploader.on('retry:failed', event => {
    addLog(
      '重试',
      `重试失败: ${event.error.message} (${event.failCount}/${retryStats.maxRetries})`,
    );
    retryStats.failed++;
    updateRetryStatsDisplay();

    if (event.failCount >= retryStats.maxRetries) {
      updateRetryStatus('failed', '已失败');
      stopCountdown();
    }
  });

  // 重试事件监听 - 重试倒计时
  uploader.on('retry:countdown', _event => {
    // 倒计时更新由我们的内部倒计时函数处理
    // 如果需要可以在这里添加额外处理逻辑
  });

  // 网络状态变化事件
  uploader.on('network:change', event => {
    addLog('网络', `网络状态变化: ${event.online ? '在线' : '离线'} (${event.type})`);
    updateNetworkQuality(event);
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
  simulateErrorBtn.disabled = !isUploading;
}

/**
 * 添加日志
 * @param {string} type - 日志类型
 * @param {string} message - 日志消息
 */
function addLog(type, message) {
  const timestamp = new Date().toLocaleTimeString();
  const logElement = document.createElement('div');
  logElement.innerHTML = `<span style="color: ${getLogTypeColor(
    type,
  )};">[${timestamp}] [${type}]</span> ${message}`;
  eventLogs.appendChild(logElement);
  eventLogs.scrollTop = eventLogs.scrollHeight;

  // 自动清理超过100条的日志
  if (eventLogs.children.length > 100) {
    eventLogs.removeChild(eventLogs.children[0]);
  }
}

/**
 * 获取日志类型颜色
 * @param {string} type - 日志类型
 * @returns {string} 颜色代码
 */
function getLogTypeColor(type) {
  switch (type.toLowerCase()) {
    case '信息':
      return '#2196F3';
    case '成功':
      return '#4CAF50';
    case '错误':
      return '#F44336';
    case '重试':
      return '#FF9800';
    case '进度':
      return '#9C27B0';
    case '网络':
      return '#00BCD4';
    default:
      return '#757575';
  }
}

/**
 * 格式化文件大小
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的大小
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 格式化传输速度
 * @param {number} bytesPerSecond - 每秒字节数
 * @returns {string} 格式化后的速度
 */
function formatSpeed(bytesPerSecond) {
  if (bytesPerSecond === 0) return '0 B/s';
  if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(1)} B/s`;
  if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
}

/**
 * 格式化时间
 * @param {number} milliseconds - 毫秒数
 * @returns {string} 格式化后的时间
 */
function formatTime(milliseconds) {
  if (milliseconds < 1000) return `${milliseconds}ms`;

  const seconds = Math.floor(milliseconds / 1000);
  if (seconds < 60) return `${seconds}秒`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes < 60) {
    return `${minutes}分${remainingSeconds}秒`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return `${hours}时${remainingMinutes}分${remainingSeconds}秒`;
}

/**
 * 更新重试状态显示
 * @param {string} status - 状态类型: idle, retrying, success, failed
 * @param {string} text - 状态文本
 */
function updateRetryStatus(status, text) {
  retryStatus.className = `retry-status status-${status}`;
  retryStatus.textContent = text;
}

/**
 * 开始倒计时
 * @param {number} delay - 延迟时间(毫秒)
 */
function startCountdown(delay) {
  // 清除现有的倒计时
  stopCountdown();

  // 设置倒计时显示
  countdownContainer.style.display = 'block';
  countdownFill.style.transition = `width ${delay}ms linear`;
  countdownFill.style.width = '100%';

  const startTime = Date.now();
  const endTime = startTime + delay;

  // 更新倒计时文本
  function updateCountdownText() {
    const now = Date.now();
    const remaining = Math.max(0, endTime - now);
    const remainingSeconds = Math.ceil(remaining / 1000);

    countdownText.textContent = `${remainingSeconds}秒后重试...`;

    if (remaining <= 0) {
      clearInterval(countdownTimer);
      countdownContainer.style.display = 'none';
    }
  }

  // 初始化倒计时条动画
  setTimeout(() => {
    countdownFill.style.width = '0%';
  }, 50);

  // 设置定时器更新文本
  updateCountdownText();
  countdownTimer = setInterval(updateCountdownText, 100);

  // 倒计时结束时隐藏
  setTimeout(() => {
    countdownContainer.style.display = 'none';
  }, delay + 100);
}

/**
 * 停止倒计时
 */
function stopCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
  countdownContainer.style.display = 'none';
}

/**
 * 重置重试统计
 */
function resetRetryStats() {
  retryStats.total = 0;
  retryStats.success = 0;
  retryStats.failed = 0;
  updateRetryStatsDisplay();
  updateRetryStatus('idle', '空闲');
}

/**
 * 更新重试统计显示
 */
function updateRetryStatsDisplay() {
  totalRetriesValue.textContent = retryStats.total;
  successRetriesValue.textContent = retryStats.success;
  failedRetriesValue.textContent = retryStats.failed;
  remainingRetriesValue.textContent = Math.max(0, retryStats.maxRetries - retryStats.failed);
}

/**
 * 更新网络质量显示
 * @param {Object} network - 网络状态对象
 */
function updateNetworkQuality(network) {
  // 更新网络状态
  networkQuality.type = network.type || 'unknown';
  networkQuality.speed = network.speed || 0;
  networkQuality.rtt = network.rtt || 0;

  // 更新网络类型
  networkType.textContent = network.type || '未知';

  // 更新网络详情
  networkDetails.textContent = `速度: ${networkQuality.speed.toFixed(1)} Mbps, RTT: ${
    networkQuality.rtt
  } ms`;

  // 更新在线状态
  if (!network.online) {
    qualityText.textContent = '离线';
    qualityIndicator.className = 'quality-indicator';
    return;
  }

  // 根据网络质量更新指示器
  let qualityClass = '';
  let qualityDescription = '';

  if (networkQuality.speed >= 8 && networkQuality.rtt < 100) {
    qualityClass = 'quality-excellent';
    qualityDescription = '优秀';
  } else if (networkQuality.speed >= 3 && networkQuality.rtt < 200) {
    qualityClass = 'quality-good';
    qualityDescription = '良好';
  } else if (networkQuality.speed >= 1 && networkQuality.rtt < 500) {
    qualityClass = 'quality-fair';
    qualityDescription = '一般';
  } else {
    qualityClass = 'quality-poor';
    qualityDescription = '较差';
  }

  qualityIndicator.className = `quality-indicator ${qualityClass}`;
  qualityText.textContent = qualityDescription;
}
