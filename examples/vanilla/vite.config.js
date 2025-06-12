import { resolve } from 'path';

import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  // 配置项目根目录（包括index.html所在位置）
  root: resolve(__dirname, './'),

  // 开发服务器配置
  server: {
    port: 3000,
    open: true, // 自动打开浏览器
    cors: true, // 启用CORS
  },

  // 构建选项
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },

  // 解析选项
  resolve: {
    // 允许从monorepo的包中导入
    alias: {
      '@file-chunk-uploader/core': resolve(__dirname, '../../packages/core/src'),
      '@file-chunk-uploader/types': resolve(__dirname, '../../packages/types/src'),
    },
  },
});
