# File Chunk Uploader

一个轻量级、高性能、易用的大文件上传解决方案，支持多框架环境。

## 特性

- 分片上传 - 将大文件切分为小块进行上传
- 断点续传 - 支持上传中断后的恢复
- 并行上传 - 多块并行上传提升速度
- 秒传 - 避免重复上传相同文件
- 多框架支持 - 支持React、Vue和原生JS
- 可扩展 - 插件系统支持自定义功能
- 高性能 - Web Worker并行计算和网络自适应
- 轻量级 - 核心包仅5KB gzipped

## 安装

```bash
# 使用npm
npm install @file-chunk-uploader/core

# 使用yarn
yarn add @file-chunk-uploader/core

# 使用pnpm
pnpm add @file-chunk-uploader/core
```

## 框架适配器

```bash
# React
pnpm add @file-chunk-uploader/react

# Vue
pnpm add @file-chunk-uploader/vue

# 原生JS增强
pnpm add @file-chunk-uploader/vanilla
```

## 基本使用

```typescript
import { FileUploader } from '@file-chunk-uploader/core';

const uploader = new FileUploader({
  target: 'https://api.example.com/upload',
  chunkSize: 2 * 1024 * 1024, // 2MB
  concurrency: 3,
  retryCount: 3,
  onProgress: progress => console.log(`上传进度: ${progress}%`),
});

// 选择文件上传
const fileInput = document.getElementById('fileInput');
fileInput.addEventListener('change', async e => {
  const file = e.target.files[0];
  try {
    const result = await uploader.upload(file);
    console.log('上传成功:', result);
  } catch (error) {
    console.error('上传失败:', error);
  }
});

// 控制上传
document.getElementById('pauseBtn').addEventListener('click', () => {
  uploader.pause();
});

document.getElementById('resumeBtn').addEventListener('click', () => {
  uploader.resume();
});

document.getElementById('cancelBtn').addEventListener('click', () => {
  uploader.cancel();
});
```

## 开发

```bash
# 安装依赖
pnpm install

# 开发模式
pnpm run dev

# 构建
pnpm run build

# 测试
pnpm run test

# 代码检查
pnpm run lint

# 代码质量检测
pnpm run quality        # 运行所有质量检测
pnpm run quality:fix    # 运行所有检测并显示修复建议
pnpm run quality:core   # 只检测core包
pnpm run quality:unused # 检测未使用的代码
pnpm run quality:types  # 检测类型覆盖率
```

## 代码质量检测

项目集成了全面的代码质量检测工具，可以通过以下命令运行：

```bash
# 运行所有质量检测
pnpm run quality

# 运行所有检测并显示修复建议
pnpm run quality:fix

# 只检测指定包
pnpm run quality:core

# 检测未使用的代码
pnpm run quality:unused

# 检测重复代码
pnpm run quality:duplicated

# 检测文件体积
pnpm run quality:size

# 检测类型覆盖率
pnpm run quality:types

# 检测包依赖关系
pnpm run quality:deps

# 并行执行所有检测
pnpm run quality:parallel
```

## 贡献

欢迎提交Pull Request或Issue。

## 许可证

MIT
