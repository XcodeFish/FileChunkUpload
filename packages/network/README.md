# @file-chunk-uploader/network

网络请求功能包，处理上传请求发送和网络适配。

## 功能

- 多种请求方式适配（XHR、Fetch）
- 网络状态检测
- 自适应上传策略

## 目录结构

- `src/adapters/` - 网络请求适配器实现
- `src/detector/` - 网络检测实现
- `src/adaptive/` - 自适应策略实现
- `src/index.ts` - 包入口文件
