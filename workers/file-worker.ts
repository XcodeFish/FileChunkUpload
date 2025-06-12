/**
 * 文件处理Worker
 * 用于在Web Worker中处理文件相关操作
 */

// 监听消息事件
self.addEventListener('message', event => {
  const { type, id } = event.data;

  // 根据消息类型处理不同任务
  switch (type) {
    case 'hash':
      handleHashCalculation(event.data, id);
      break;
    case 'chunk':
      handleFileChunking(event.data, id);
      break;
    default:
      self.postMessage({
        id,
        error: `未知任务类型: ${type}`,
      });
  }
});

/**
 * 处理文件哈希计算
 */
function handleHashCalculation(data: any, taskId: string) {
  // 注释掉未使用的变量，实际项目中会使用这些变量
  // const { file, algorithm } = data;

  // 实际项目中这里会有真正的哈希计算逻辑
  // 这里只是一个示例
  setTimeout(() => {
    self.postMessage({
      id: taskId,
      result: `hash-${Date.now()}`,
      type: 'hash',
    });
  }, 100);
}

/**
 * 处理文件分片
 */
function handleFileChunking(data: any, taskId: string) {
  // 注释掉未使用的变量，保留需要使用的变量
  const { chunkSize } = data;
  // const { file } = data;

  // 实际项目中这里会有真正的文件分片逻辑
  // 这里只是一个示例
  setTimeout(() => {
    self.postMessage({
      id: taskId,
      result: [{ start: 0, end: chunkSize }],
      type: 'chunk',
    });
  }, 100);
}

// 向主线程发送就绪消息
self.postMessage({ type: 'ready' });
