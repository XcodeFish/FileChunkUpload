/**
 * 示例插件实现
 * 展示插件系统的使用方法
 */
import { IPlugin, IPluginLifecycle, IFileUploaderCore } from '@file-chunk-uploader/types';

/**
 * 创建日志记录插件
 * 为上传过程添加日志记录功能
 * @param options 插件选项
 * @returns 插件实例
 */
export function createLoggerPlugin(options: { detailed?: boolean } = {}): IPlugin {
  return {
    name: 'logger-plugin',
    version: '1.0.0',
    apiVersion: '1.0.0',

    /**
     * 安装插件
     * @param uploader 上传器实例
     */
    install(_uploader: IFileUploaderCore): void {
      // 日志记录的生命周期钩子
      const lifecycle: IPluginLifecycle = {
        // 初始化钩子
        init(_uploader) {
          console.log(`[Logger插件] 初始化, 详细模式: ${options.detailed ? '开启' : '关闭'}`);
        },

        // 上传前钩子
        beforeUpload(file, _config) {
          console.log(`[Logger插件] 准备上传文件: ${file.name}, 大小: ${file.size} 字节`);
          return file;
        },

        // 分片上传前钩子
        beforeChunkUpload(chunk, index, total) {
          if (options.detailed) {
            console.log(
              `[Logger插件] 准备上传分片 ${index + 1}/${total}, 大小: ${chunk.size} 字节`,
            );
          }
          return chunk;
        },

        // 分片上传后钩子
        afterChunkUpload(response, chunk, index) {
          if (options.detailed) {
            console.log(`[Logger插件] 分片 ${index + 1} 上传完成, 响应:`, response);
          }
        },

        // 上传后钩子
        afterUpload(result) {
          console.log(`[Logger插件] 文件上传完成, 结果:`, result);
        },

        // 错误处理钩子
        onError(error) {
          console.error(`[Logger插件] 上传出错:`, error);
          // 返回false表示未处理错误，允许其他插件或上传器继续处理
          return false;
        },

        // 进度处理钩子
        onProgress(progress) {
          if (options.detailed || progress % 10 === 0) {
            // 只在详细模式或进度为10的倍数时记录
            console.log(`[Logger插件] 上传进度: ${progress}%`);
          }
        },

        // 清理钩子
        cleanup() {
          console.log('[Logger插件] 清理资源');
        },
      };

      // 将生命周期钩子作为插件的一部分
      this.lifecycle = lifecycle;
    },

    // 生命周期实例将在install方法中设置
    lifecycle: undefined,
  };
}

/**
 * 扩展的插件接口，支持依赖关系
 */
interface IExtendedPlugin extends IPlugin {
  dependencies?: string[];
}

/**
 * 演示插件依赖关系
 * 将loggerPlugin作为依赖
 * @param options 插件选项
 * @returns 插件实例
 */
export function createAnalyticsPlugin(): IExtendedPlugin {
  return {
    name: 'analytics-plugin',
    version: '1.0.0',
    // 声明依赖关系
    dependencies: ['logger-plugin'],

    install(_uploader: IFileUploaderCore): void {
      const metrics = {
        startTime: 0,
        endTime: 0,
        totalSize: 0,
        uploadSpeed: 0,
      };

      const lifecycle: IPluginLifecycle = {
        beforeUpload(file) {
          metrics.startTime = Date.now();
          metrics.totalSize = file.size;
          return file;
        },

        afterUpload(_result) {
          metrics.endTime = Date.now();
          const duration = (metrics.endTime - metrics.startTime) / 1000; // 转换为秒
          metrics.uploadSpeed = metrics.totalSize / duration; // 字节/秒

          console.log('[分析插件] 上传性能指标:');
          console.log(`  - 总大小: ${formatSize(metrics.totalSize)}`);
          console.log(`  - 总耗时: ${duration.toFixed(2)}秒`);
          console.log(`  - 平均速度: ${formatSize(metrics.uploadSpeed)}/s`);
        },
      };

      this.lifecycle = lifecycle;

      function formatSize(bytes: number): string {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
          size /= 1024;
          unitIndex++;
        }

        return `${size.toFixed(2)} ${units[unitIndex]}`;
      }
    },

    lifecycle: undefined,
  };
}

/**
 * 插件使用示例
 * @example
 * import { FileUploader } from '@file-chunk-uploader/core';
 * import { createLoggerPlugin, createAnalyticsPlugin } from './example-plugin';
 *
 * const uploader = new FileUploader({
 *   target: 'https://api.example.com/upload'
 * });
 *
 * // 先注册logger插件（因为analytics插件依赖它）
 * uploader.use(createLoggerPlugin({ detailed: true }));
 *
 * // 注册analytics插件
 * uploader.use(createAnalyticsPlugin());
 */
