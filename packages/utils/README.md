# @file-chunk-uploader/utils

通用工具库，提供文件上传库所需的各种工具函数和类。

## 功能模块

### 日志工具 (logger)

提供统一的日志记录功能，支持不同级别的日志输出和分类。

```typescript
import { LoggerUtil } from '@file-chunk-uploader/utils';

const logger = new LoggerUtil(console, 'MyModule');
logger.debug('调试信息');
logger.info('普通信息');
logger.warn('警告信息');
logger.error('错误信息');
```

### 错误处理工具 (error)

提供统一的错误处理和转换功能，用于创建标准化的上传错误对象。

```typescript
import { createUploadError, createCancelError, createPauseError } from '@file-chunk-uploader/utils';

// 创建标准上传错误
const error = createUploadError(new Error('上传失败'));

// 创建取消上传错误
const cancelError = createCancelError();

// 创建暂停上传错误
const pauseError = createPauseError();
```

### 事件辅助工具 (event)

提供事件发送和处理功能，简化事件处理逻辑。

```typescript
import { EventHelper } from '@file-chunk-uploader/utils';

const eventHelper = new EventHelper(eventEmitter);
eventHelper.emit('custom-event', { data: 'value' });
eventHelper.on('another-event', data => console.log(data));
```

### 格式化工具 (format)

提供文件大小和时间格式化功能。

```typescript
import { formatFileSize, formatTime } from '@file-chunk-uploader/utils';

// 格式化文件大小
const size = formatFileSize(1024 * 1024); // "1.00 MB"

// 格式化时间
const time = formatTime(3665); // "01:01:05"
```

## 安装

```bash
npm install @file-chunk-uploader/utils
# 或
pnpm add @file-chunk-uploader/utils
```

## 使用

```typescript
import { LoggerUtil, EventHelper, formatFileSize } from '@file-chunk-uploader/utils';

// 使用日志工具
const logger = new LoggerUtil(console, 'MyApp');
logger.info('应用启动');

// 使用格式化工具
const fileSize = formatFileSize(2048576);
logger.info(`文件大小: ${fileSize}`);
```

## 功能

- 节流控制
- 日志工具
- Observable支持

## 目录结构

- `src/throttle/` - 节流控制实现
- `src/logger/` - 日志工具实现
- `src/observable/` - Observable支持实现
- `src/index.ts` - 包入口文件
