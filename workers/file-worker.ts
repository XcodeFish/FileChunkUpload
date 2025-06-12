/**
 * 文件处理Worker
 * 用于在Web Worker中处理文件相关操作
 */

/**
 * 分片元数据接口
 */
interface ChunkMeta {
  /** 分片索引 */
  index: number;
  /** 分片大小 */
  size: number;
  /** 起始位置 */
  start: number;
  /** 结束位置 */
  end: number;
  /** 是否为最后一个分片 */
  isLast: boolean;
}

/**
 * 进度事件数据
 */
interface ProgressData {
  /** 当前处理的字节数 */
  processed: number;
  /** 总字节数 */
  total: number;
  /** 百分比进度 (0-100) */
  percentage: number;
}

/**
 * Worker任务类型
 */
type TaskType = 'hash' | 'chunk' | 'analyze';

/**
 * 任务操作状态
 */
enum TaskStatus {
  STARTED = 'started',
  PROGRESS = 'progress',
  COMPLETE = 'complete',
  ERROR = 'error',
}

/**
 * Worker配置
 */
interface WorkerConfig {
  /** 是否启用流式处理 */
  streamProcessing: boolean;
  /** 流式处理块大小 */
  streamBlockSize: number;
  /** 进度报告频率（毫秒） */
  progressInterval: number;
  /** 是否使用SharedArrayBuffer */
  useSharedBuffers: boolean;
}

// Worker默认配置
const DEFAULT_CONFIG: WorkerConfig = {
  streamProcessing: true,
  streamBlockSize: 5 * 1024 * 1024, // 5MB
  progressInterval: 100, // 100ms报告一次进度
  useSharedBuffers: false, // 默认禁用，可由主线程启用
};

// Worker当前配置
let config = { ...DEFAULT_CONFIG };

// 初始化Worker
self.postMessage({ type: 'ready' });

// 监听消息事件
self.addEventListener('message', event => {
  const { type, id } = event.data;

  try {
    // 如果包含配置，更新Worker配置
    if (event.data.config) {
      config = { ...config, ...event.data.config };
    }

    // 根据消息类型处理不同任务
    switch (type) {
      case 'hash':
        handleHashCalculation(event.data, id);
        break;
      case 'chunk':
        handleFileChunking(event.data, id);
        break;
      case 'analyze':
        handleFileAnalysis(event.data, id);
        break;
      case 'config':
        updateConfig(event.data.config);
        self.postMessage({ id, type: 'config', status: 'success' });
        break;
      default:
        self.postMessage({
          id,
          type: 'error',
          error: `未知任务类型: ${type}`,
        });
    }
  } catch (err) {
    self.postMessage({
      id,
      type: 'error',
      error: (err as Error).message || '任务处理错误',
      stack: (err as Error).stack,
    });
  }
});

/**
 * 更新Worker配置
 */
function updateConfig(newConfig: Partial<WorkerConfig>): void {
  config = { ...config, ...newConfig };
}

/**
 * 报告任务状态
 */
function reportTaskStatus<T>(id: string, type: TaskType, status: TaskStatus, data?: T): void {
  self.postMessage({
    id,
    type,
    status,
    ...(data ? { data } : {}),
  });
}

/**
 * 报告任务进度
 */
function reportProgress(id: string, processed: number, total: number): void {
  const percentage = Math.min(100, Math.floor((processed / total) * 100));
  const progressData: ProgressData = {
    processed,
    total,
    percentage,
  };

  self.postMessage({
    id,
    type: 'progress',
    status: TaskStatus.PROGRESS,
    data: progressData,
  });
}

/**
 * 处理文件哈希计算
 */
async function handleHashCalculation(data: any, taskId: string) {
  try {
    const { file, algorithm = 'SHA-256' } = data;

    if (!file) {
      throw new Error('缺少文件参数');
    }

    reportTaskStatus(taskId, 'hash', TaskStatus.STARTED);

    let hash: string;
    const startTime = performance.now();

    if (config.streamProcessing && file.size > config.streamBlockSize) {
      // 大文件使用流式处理
      hash = await calculateHashStreamed(file, algorithm, taskId);
    } else {
      // 小文件一次性处理
      hash = await calculateHashDirect(file, algorithm);
    }

    const endTime = performance.now();

    self.postMessage({
      id: taskId,
      type: 'hash',
      status: TaskStatus.COMPLETE,
      hash,
      processingTime: endTime - startTime,
    });
  } catch (err) {
    self.postMessage({
      id: taskId,
      type: 'error',
      error: (err as Error).message || '哈希计算错误',
      stack: (err as Error).stack,
    });
  }
}

/**
 * 直接计算小文件哈希
 */
async function calculateHashDirect(file: File, algorithm: string): Promise<string> {
  // 读取整个文件
  const buffer = await readFileAsArrayBuffer(file);

  // 计算哈希
  const hashBuffer = await crypto.subtle.digest(algorithm, buffer);

  // 转换为十六进制字符串
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * 流式计算大文件哈希
 */
async function calculateHashStreamed(
  file: File,
  algorithm: string,
  taskId: string,
): Promise<string> {
  try {
    // 尝试使用WebCrypto API创建增量哈希
    await crypto.subtle.digest(algorithm, new ArrayBuffer(0));
  } catch (e) {
    // 如果浏览器不支持增量哈希，回退到分块哈希
    return calculateHashByChunks(file, algorithm, taskId);
  }

  // 计算哈希
  const hashBuffer = await crypto.subtle.digest(algorithm, await readFileAsArrayBuffer(file));

  // 转换为十六进制字符串
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * 通过分块计算大文件哈希
 */
async function calculateHashByChunks(
  file: File,
  algorithm: string,
  taskId: string,
): Promise<string> {
  const chunkSize = config.streamBlockSize;
  const chunks = Math.ceil(file.size / chunkSize);
  let processedBytes = 0;

  // 准备哈希计算
  const hashBuffer = await crypto.subtle.digest(algorithm, new ArrayBuffer(0));

  // 创建一个新的空哈希上下文
  let context: ArrayBuffer = hashBuffer;

  // 处理每个块
  for (let i = 0; i < chunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const chunk = file.slice(start, end);
    const chunkBuffer = await readFileAsArrayBuffer(chunk);

    // 计算这个块的哈希并合并到上下文中
    context = await crypto.subtle.digest(algorithm, concatArrayBuffers(context, chunkBuffer));

    // 更新进度
    processedBytes += end - start;
    reportProgress(taskId, processedBytes, file.size);
  }

  // 返回最终哈希
  return Array.from(new Uint8Array(context))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * 合并两个ArrayBuffer
 */
function concatArrayBuffers(buffer1: ArrayBuffer, buffer2: ArrayBuffer): ArrayBuffer {
  const result = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
  result.set(new Uint8Array(buffer1), 0);
  result.set(new Uint8Array(buffer2), buffer1.byteLength);
  return result.buffer;
}

/**
 * 处理文件分块
 */
async function handleFileChunking(data: any, taskId: string) {
  try {
    const { file, chunkSize = 2 * 1024 * 1024, indexBase = 0 } = data;

    if (!file) {
      throw new Error('缺少文件参数');
    }

    reportTaskStatus(taskId, 'chunk', TaskStatus.STARTED);
    const startTime = performance.now();

    // 计算分片数量
    const count = Math.ceil(file.size / chunkSize);
    const chunks: Blob[] = [];
    const chunkInfos: ChunkMeta[] = [];

    // 使用流式处理还是一次性处理
    if (config.streamProcessing && count > 20) {
      // 流式处理大量分片
      await processChunksStreamed(file, chunkSize, indexBase, chunks, chunkInfos, taskId);
    } else {
      // 一次性处理少量分片
      processChunksDirect(file, chunkSize, indexBase, chunks, chunkInfos);
    }

    const endTime = performance.now();

    // 发送结果
    self.postMessage({
      id: taskId,
      type: 'chunk',
      status: TaskStatus.COMPLETE,
      chunks,
      count,
      chunkInfos,
      processingTime: endTime - startTime,
    });
  } catch (err) {
    self.postMessage({
      id: taskId,
      type: 'error',
      error: (err as Error).message || '文件分片错误',
      stack: (err as Error).stack,
    });
  }
}

/**
 * 直接处理文件分片（适用于小文件或少量分片）
 */
function processChunksDirect(
  file: File,
  chunkSize: number,
  indexBase: number,
  chunks: Blob[],
  chunkInfos: ChunkMeta[],
): void {
  const count = Math.ceil(file.size / chunkSize);

  // 创建分片
  for (let i = 0; i < count; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const size = end - start;
    const isLast = i === count - 1;

    // 创建分片
    const chunk = file.slice(start, end);
    chunks.push(chunk);

    // 记录分片信息
    chunkInfos.push({
      index: i + indexBase,
      size,
      start,
      end,
      isLast,
    });
  }
}

/**
 * 流式处理文件分片（适用于大文件或大量分片）
 */
async function processChunksStreamed(
  file: File,
  chunkSize: number,
  indexBase: number,
  chunks: Blob[],
  chunkInfos: ChunkMeta[],
  taskId: string,
): Promise<void> {
  const count = Math.ceil(file.size / chunkSize);
  let processedBytes = 0;
  let lastProgressReport = 0;

  // 获取进度报告间隔，可在config中配置
  const progressInterval = config.progressInterval || 100; // 默认100ms

  // 预先计算所有分片的元数据
  for (let i = 0; i < count; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const size = end - start;
    const isLast = i === count - 1;

    // 创建分片
    const chunk = file.slice(start, end);
    chunks.push(chunk);

    // 记录分片信息
    chunkInfos.push({
      index: i + indexBase,
      size,
      start,
      end,
      isLast,
    });

    // 更新进度
    processedBytes += size;

    // 限制进度报告频率
    const now = performance.now();
    if (now - lastProgressReport > progressInterval) {
      reportProgress(taskId, processedBytes, file.size);
      lastProgressReport = now;

      // 让出主线程，避免阻塞UI
      await sleep(0);
    }
  }

  // 最终进度报告100%
  reportProgress(taskId, file.size, file.size);
}

/**
 * 处理文件分析（获取文件详细信息）
 */
async function handleFileAnalysis(data: any, taskId: string) {
  try {
    const { file } = data;

    if (!file) {
      throw new Error('缺少文件参数');
    }

    reportTaskStatus(taskId, 'analyze', TaskStatus.STARTED);

    // 分析文件类型
    const fileTypeInfo = await analyzeFileType(file);

    // 返回分析结果
    self.postMessage({
      id: taskId,
      type: 'analyze',
      status: TaskStatus.COMPLETE,
      analysis: {
        fileSize: file.size,
        mimeType: file.type || 'unknown',
        fileName: file.name,
        lastModified: file.lastModified,
        detectedType: fileTypeInfo.type,
        detectedExtension: fileTypeInfo.extension,
        isImage: fileTypeInfo.category === 'image',
        isVideo: fileTypeInfo.category === 'video',
        isAudio: fileTypeInfo.category === 'audio',
        isText: fileTypeInfo.category === 'text',
        isArchive: fileTypeInfo.category === 'archive',
      },
    });
  } catch (err) {
    self.postMessage({
      id: taskId,
      type: 'error',
      error: (err as Error).message || '文件分析错误',
      stack: (err as Error).stack,
    });
  }
}

/**
 * 分析文件类型
 */
async function analyzeFileType(file: File): Promise<{
  type: string;
  extension: string;
  category: 'image' | 'video' | 'audio' | 'text' | 'archive' | 'unknown';
}> {
  // 检查MIME类型
  const mimeType = file.type || '';

  // 默认结果
  const result = {
    type: mimeType,
    extension: getExtensionFromFilename(file.name),
    category: 'unknown' as 'image' | 'video' | 'audio' | 'text' | 'archive' | 'unknown',
  };

  // 根据MIME类型分类
  if (mimeType.startsWith('image/')) {
    result.category = 'image';
  } else if (mimeType.startsWith('video/')) {
    result.category = 'video';
  } else if (mimeType.startsWith('audio/')) {
    result.category = 'audio';
  } else if (mimeType.startsWith('text/')) {
    result.category = 'text';
  } else if (
    mimeType === 'application/zip' ||
    mimeType === 'application/x-rar-compressed' ||
    mimeType === 'application/gzip'
  ) {
    result.category = 'archive';
  }

  // 如果MIME类型不可靠，检查文件头部签名
  if (result.category === 'unknown') {
    try {
      // 读取文件头部
      const headerBytes = await readFileHeader(file, 12);
      const category = detectFileTypeFromHeader(headerBytes);
      if (category) {
        result.category = category;
      }
    } catch (err) {
      // 忽略错误，使用默认结果
    }
  }

  return result;
}

/**
 * 从文件头部字节检测文件类型
 */
function detectFileTypeFromHeader(
  header: Uint8Array,
): 'image' | 'video' | 'audio' | 'text' | 'archive' | undefined {
  // 检查常见文件头部签名
  if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
    return 'image'; // JPEG
  }

  if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47) {
    return 'image'; // PNG
  }

  if (header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46) {
    return 'image'; // GIF
  }

  if (header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46) {
    return 'video'; // RIFF (AVI, WAV)
  }

  if (header[0] === 0x50 && header[1] === 0x4b && header[2] === 0x03 && header[3] === 0x04) {
    return 'archive'; // ZIP
  }

  if (header[0] === 0x52 && header[1] === 0x61 && header[2] === 0x72 && header[3] === 0x21) {
    return 'archive'; // RAR
  }

  const textChars = [0x09, 0x0a, 0x0d]; // Tab, LF, CR
  const isText = Array.from(header.slice(0, 8)).every(
    byte => (byte >= 0x20 && byte <= 0x7e) || textChars.includes(byte),
  );

  if (isText) {
    return 'text';
  }

  return undefined;
}

/**
 * 从文件名获取扩展名
 */
function getExtensionFromFilename(filename: string): string {
  const match = filename.match(/\.([^.]+)$/);
  return match ? match[1].toLowerCase() : '';
}

/**
 * 读取文件头部
 */
async function readFileHeader(file: File, bytes: number): Promise<Uint8Array> {
  const headerBlob = file.slice(0, bytes);
  const buffer = await readFileAsArrayBuffer(headerBlob);
  return new Uint8Array(buffer);
}

/**
 * 读取文件为ArrayBuffer
 */
function readFileAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsArrayBuffer(blob);
  });
}

/**
 * 睡眠函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
