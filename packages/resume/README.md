# @file-chunk-uploader/resume

断点续传功能包，支持上传中断后恢复上传功能。

## 功能

- 上传进度持久化
- 断点恢复上传
- 多种存储策略支持

## 目录结构

- `src/resume-strategy/` - 断点续传策略实现
- `src/storage/` - 上传进度存储实现
- `src/index.ts` - 包入口文件
