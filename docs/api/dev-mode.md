# 开发者模式使用指南

开发者模式是 `@file-chunk-uploader` 提供的强大调试功能，可以帮助开发者更好地理解上传过程、排查问题并优化应用。本指南详细说明如何配置和使用开发者模式。

## 启用开发者模式

在创建 `FileUploader` 实例时，可以通过配置 `devMode` 选项来启用开发者模式：

```typescript
import { FileUploader } from '@file-chunk-uploader/core';
import { LogLevel } from '@file-chunk-uploader/types';

// 简单启用方式
const uploader1 = new FileUploader({
  target: 'https://api.example.com/upload',
  devMode: true, // 使用默认配置启用
});

// 详细配置方式
const uploader2 = new FileUploader({
  target: 'https://api.example.com/upload',
  devMode: {
    enabled: true,
    logger: {
      level: LogLevel.DEBUG, // 设置日志级别
      format: 'pretty', // 设置日志格式
      filter: ['core', 'network'], // 只显示特定模块的日志
    },
    performanceMonitoring: true, // 启用性能监控
    networkLogging: true, // 记录网络请求
    workerLogging: true, // 记录Web Worker操作
    pluginTracing: true, // 追踪插件调用链
  },
});
```

## 日志系统

开发者模式的核心功能是强大的日志系统，它提供了详细的操作记录。

### 日志级别

日志系统支持不同的级别，按严重程度从低到高排序：

- `LogLevel.DEBUG` - 调试信息，最详细的日志
- `LogLevel.INFO` - 一般信息，默认级别
- `LogLevel.WARN` - 警告信息
- `LogLevel.ERROR` - 错误信息
- `LogLevel.SILENT` - 不输出任何日志

### 日志分类

日志按模块进行分类，便于过滤特定类型的信息：

- `core` - 核心上传器操作
- `events` - 事件系统
- `plugin` - 插件系统
- `network` - 网络请求和响应
- `storage` - 存储操作
- `worker` - Web Worker操作
- `retry` - 重试机制
- `chunk` - 分片上传

### 日志格式

开发者模式支持两种日志格式：

- `pretty` - 格式化输出，易于人类阅读
- `json` - JSON格式输出，便于机器处理和日志工具集成

### 访问日志

可以通过以下方式访问日志实例：

```typescript
// 直接从上传器实例访问日志对象
const logger = uploader.logger;

// 使用不同级别记录日志
logger.debug('custom', '这是一条调试信息', { extraData: 123 });
logger.info('custom', '这是一条信息');
logger.warn('custom', '这是一条警告');
logger.error('custom', '这是一条错误', new Error('错误详情'));
```

### 日志过滤

通过配置 `filter` 选项可以只显示特定分类的日志：

```typescript
const uploader = new FileUploader({
  target: 'https://api.example.com/upload',
  devMode: {
    enabled: true,
    logger: {
      level: LogLevel.DEBUG,
      filter: ['core', 'network'], // 只显示core和network分类的日志
    },
  },
});
```

## 性能监控

启用 `performanceMonitoring` 后，开发者模式会记录上传过程中的性能指标：

```typescript
// 配置性能监控
const uploader = new FileUploader({
  target: 'https://api.example.com/upload',
  devMode: {
    enabled: true,
    performanceMonitoring: true,
  },
});
```

性能监控会记录以下指标：

- 上传速度（实时和平均）
- 各阶段耗时（初始化、分片、网络传输等）
- 内存使用情况
- 并发请求数
- 重试次数和成功率

## 网络日志

启用 `networkLogging` 后，可以详细跟踪所有网络请求和响应：

```typescript
// 配置网络日志
const uploader = new FileUploader({
  target: 'https://api.example.com/upload',
  devMode: {
    enabled: true,
    networkLogging: true,
  },
});
```

网络日志包含以下信息：

- 请求URL、方法、头部和正文
- 响应状态码、头部和正文
- 请求耗时
- 请求错误详情
- 重定向信息

## 插件跟踪

启用 `pluginTracing` 后，可以跟踪插件的调用链和影响：

```typescript
// 配置插件跟踪
const uploader = new FileUploader({
  target: 'https://api.example.com/upload',
  devMode: {
    enabled: true,
    pluginTracing: true,
  },
});
```

插件跟踪记录：

- 插件安装顺序
- 插件钩子调用链
- 插件处理耗时
- 插件修改的数据

## 控制台集成

在浏览器环境中，开发者模式会自动与浏览器控制台集成：

1. 使用彩色和分组显示日志
2. 在日志中展示可展开的对象
3. 记录耗时操作的性能时间线
4. 用表格形式展示统计数据

## 导出日志

可以导出开发者模式收集的日志数据，便于离线分析或提交问题报告：

```typescript
// 获取日志历史
const logHistory = uploader.logger.getHistory();

// 导出日志为文本
const logText = uploader.logger.exportAsText();

// 导出日志为JSON
const logJson = uploader.logger.exportAsJson();

// 清除日志历史
uploader.logger.clearHistory();
```

## 最佳实践

1. **开发环境启用，生产环境禁用**：

   ```typescript
   const uploader = new FileUploader({
     target: 'https://api.example.com/upload',
     devMode: process.env.NODE_ENV !== 'production',
   });
   ```

2. **按需过滤日志**：
   在开发特定功能时，只关注相关模块的日志：

   ```typescript
   const uploader = new FileUploader({
     target: 'https://api.example.com/upload',
     devMode: {
       enabled: true,
       logger: {
         filter: ['chunk', 'network'], // 只关注分片上传和网络请求
       },
     },
   });
   ```

3. **性能调优**：
   在测试性能时，重点关注性能监控指标：

   ```typescript
   const uploader = new FileUploader({
     target: 'https://api.example.com/upload',
     devMode: {
       enabled: true,
       performanceMonitoring: true,
       logger: {
         level: LogLevel.INFO, // 降低日志级别，减少干扰
         filter: ['performance'],
       },
     },
   });
   ```

## 故障排除示例

### 问题：上传失败且没有明显错误

1. 启用详细日志：

```typescript
const uploader = new FileUploader({
  target: 'https://api.example.com/upload',
  devMode: {
    enabled: true,
    logger: { level: LogLevel.DEBUG },
    networkLogging: true,
  },
});
```

2. 监听错误事件并检查日志：

```typescript
import { EventName } from '@file-chunk-uploader/types';

uploader.on(EventName.UPLOAD_ERROR, event => {
  console.error('上传错误:', event.error);

  // 检查网络日志
  const networkLogs = uploader.logger.getHistory('network');
  console.log('最近的网络请求:', networkLogs.slice(-5));
});
```

### 问题：上传性能不佳

1. 启用性能监控：

```typescript
const uploader = new FileUploader({
  target: 'https://api.example.com/upload',
  devMode: {
    enabled: true,
    performanceMonitoring: true,
  },
});
```

2. 分析性能指标：

```typescript
uploader.on(EventName.UPLOAD_COMPLETE, () => {
  const performanceLogs = uploader.logger.getHistory('performance');

  // 分析性能日志
  const avgSpeed =
    performanceLogs.filter(log => log.data.speed).reduce((sum, log) => sum + log.data.speed, 0) /
    performanceLogs.length;

  console.log('平均上传速度:', avgSpeed, 'Mbps');

  // 检查并发设置是否合理
  const concurrency = uploader.config.chunk?.concurrency || 3;
  if (avgSpeed < 1 && concurrency > 2) {
    console.log('建议降低并发设置');
  } else if (avgSpeed > 10 && concurrency < 5) {
    console.log('建议提高并发设置');
  }
});
```

## 结论

开发者模式是一个强大的工具，可帮助你更好地理解文件上传过程中发生的各种事件和操作。通过合理配置和使用开发者模式，可以有效提高开发效率，快速定位和解决问题。
