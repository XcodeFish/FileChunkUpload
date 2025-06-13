# 文件断点续传演示

这个目录包含了演示文件断点续传功能的示例代码。

## 文件说明

- `simple-demo.html` - 一个自包含的断点续传演示页面，使用IndexedDB存储上传状态
- `server.js` - 一个简单的HTTP服务器，用于运行演示页面
- `basic-resume-upload.ts` - TypeScript版本的示例代码（需要构建）
- `webpack.config.js` - Webpack配置文件，用于构建TypeScript示例

## 运行简单演示

无需构建，直接运行服务器即可查看演示：

```bash
# 从项目根目录
cd packages/resume
npm run demo

# 或从examples目录
node server.js
```

然后在浏览器中访问 <http://localhost:3000/simple-demo.html>

## 功能特性

- 文件分片上传
- 使用IndexedDB存储上传状态
- 支持暂停和恢复上传
- 上传进度显示
- 模拟上传失败和恢复机制

## 构建TypeScript示例

如果要构建TypeScript版本的示例：

```bash
# 从项目根目录
cd packages/resume
npm run build:example
```

这将会生成 `bundle.js` 文件，然后可以使用以下命令运行：

```bash
npm run serve:example
```
