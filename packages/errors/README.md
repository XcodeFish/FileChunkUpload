# @file-chunk-uploader/errors

错误处理包，处理上传过程中的错误。

## 功能

- 错误类型定义
- 错误处理策略
- 错误恢复机制

## 目录结构

- `src/error-types/` - 错误类型定义实现
- `src/error-handler/` - 错误处理器实现
- `src/recovery/` - 错误恢复机制实现
- `src/index.ts` - 包入口文件

## 使用示例

### 基本使用

```typescript
import { UploadError } from '@file-chunk-uploader/errors';
import { ErrorCode } from '@file-chunk-uploader/types';

// 创建基本错误
const error = new UploadError('上传失败', ErrorCode.NETWORK_ERROR);

// 使用静态工厂方法创建错误
const networkError = UploadError.network('网络连接失败');
const fileError = UploadError.file('文件不存在', ErrorCode.FILE_NOT_FOUND);
const serverError = UploadError.server('服务器错误', 500);
const chunkError = UploadError.chunk('分片上传失败', 3);

// 获取本地化错误消息
console.log(error.getLocalizedMessage('zh-CN')); // '网络错误'
console.log(error.getLocalizedMessage('en-US')); // 'Network error'

// 在开发者模式下获取详细信息
console.log(error.getDevModeDetails());
```

### 错误处理示例

```typescript
try {
  // 尝试上传文件
  await uploader.upload(file);
} catch (err) {
  if (err instanceof UploadError) {
    // 处理特定类型的错误
    switch (err.code) {
      case ErrorCode.NETWORK_ERROR:
        console.log('网络错误，请检查网络连接');
        break;
      case ErrorCode.FILE_TOO_LARGE:
        console.log('文件过大，请压缩后再上传');
        break;
      case ErrorCode.SERVER_ERROR:
        console.log('服务器错误，请稍后重试');
        break;
      default:
        console.log(`上传错误: ${err.getLocalizedMessage()}`);
    }

    // 检查是否可重试
    if (err.retryable) {
      console.log('正在重试上传...');
      // 重试逻辑...
    }
  } else {
    console.log('发生未知错误', err);
  }
}
```

## 开发

```bash
# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 构建
pnpm build

# 运行测试
pnpm test
```
