# @file-chunk-uploader 原生JS最小化示例

这个示例展示了如何在不使用任何框架的情况下使用 @file-chunk-uploader 来上传文件。

## 功能特点

- 基本的文件上传功能演示
- 上传进度实时展示
- 支持暂停、恢复和取消上传
- 事件监听与日志展示
- 开发者模式的使用
- 完全使用原生JavaScript

## 启动示例

在项目根目录执行:

```bash
# 安装依赖
pnpm install

# 启动示例
pnpm --filter "file-chunk-uploader-vanilla-example" start
```

然后在浏览器中访问 <http://localhost:3000> 即可使用示例。

## 使用说明

1. 点击"选择文件"按钮选择要上传的文件
2. 点击"上传文件"按钮开始上传
3. 可以使用"暂停"、"恢复"和"取消"按钮控制上传过程
4. 下方日志区域会实时显示上传事件和状态

## 关键代码说明

### 初始化上传器

```javascript
import { FileUploader } from '@file-chunk-uploader/core';
import { LogLevel } from '@file-chunk-uploader/types';

// 初始化上传器实例
const uploader = new FileUploader({
  target: 'https://api.example.com/upload',
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
```

### 上传文件

```javascript
const result = await uploader.upload(file);

if (result.success) {
  console.log('上传成功:', result);
} else {
  console.error('上传失败:', result.error);
}
```

### 监听事件

```javascript
import { EventName } from '@file-chunk-uploader/types';

// 监听上传进度
uploader.on(EventName.UPLOAD_PROGRESS, event => {
  const progress = event.progress.percentage;
  updateProgressBar(progress);
});

// 监听上传成功
uploader.on(EventName.UPLOAD_SUCCESS, event => {
  console.log('上传成功:', event);
});

// 监听上传错误
uploader.on(EventName.UPLOAD_ERROR, event => {
  console.error('上传错误:', event.error);
});
```

### 控制上传

```javascript
// 暂停上传
uploader.pause(fileId);

// 恢复上传
uploader.resume(fileId);

// 取消上传
uploader.cancel(fileId);
```

## 注意事项

- 示例中使用的是 httpbin.org 作为演示用的上传端点，实际使用时请替换为您自己的服务器端点
- 开发者模式默认启用，可以在控制台看到详细的调试信息
- 如果需要测试大文件上传，请调整服务器端的上传限制
