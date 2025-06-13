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

## 网络状态监测

`NetworkDetector` 类提供了监测和管理网络状态变化的功能：

```typescript
import { NetworkDetector } from '@file-chunk-uploader/network';

// 创建检测器实例
const detector = new NetworkDetector({
  speedTestUrl: '/api/ping', // 用于测速的URL
  speedTestInterval: 60000, // 测速间隔（毫秒）
  autoStart: true, // 是否自动开始监听
});

// 获取当前网络状态
const networkInfo = detector.getCurrentNetwork();
console.log(`在线状态: ${networkInfo.online}`);
console.log(`网络类型: ${networkInfo.type}`);
console.log(`网络速度: ${networkInfo.speed} Mbps`);
console.log(`网络延迟: ${networkInfo.rtt} ms`);

// 监听网络变化
const unsubscribe = detector.onNetworkChange(network => {
  console.log('网络状态变化:', network);
});

// 手动测量网络速度
detector.measureNetworkSpeed().then(speed => {
  console.log(`当前网络速度: ${speed} Mbps`);
});

// 停止监听
detector.stopMonitoring();

// 取消特定事件监听
unsubscribe();
```

### 功能特点

- 实时监测网络状态变化
- 根据RTT（往返时间）估算网络速度
- 支持Network Information API（如果浏览器支持）
- 提供网络状态变化事件通知
- 可配置的网络速度测试
