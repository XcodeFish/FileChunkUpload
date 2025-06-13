/**
 * 断点续传策略索引文件
 * 导出断点续传相关组件
 */

// 导出组件
export { ResumeUploadStrategy } from './resume-upload-strategy';
export { ChunkStateManager } from './chunk-state-manager';
export { UploadStateValidator } from './upload-state-validator';
export { ProgressCalculator } from './progress-calculator';

// 导出类型
export type {
  IChunkDetail,
  IExtendedUploadState,
  IResumeUploadStrategyOptions,
  IUploadStats,
  IUploadStateValidationResult,
} from './types';
export { ChunkStatus } from './types';

// 导入实现
import { ResumeUploadStrategy } from './resume-upload-strategy';
import { ChunkStatus } from './types';
import type { IResumeUploadStrategyOptions } from './types';

/**
 * 创建并返回一个续传策略插件
 * @param options 续传策略选项
 * @returns 续传策略插件
 */
export const resumable = (options?: IResumeUploadStrategyOptions) => {
  return {
    name: 'resumable',
    version: '1.0.0',
    install: (uploader: any, opts: any) => {
      const finalOptions = {
        maxConcurrentChunks: 3, // 默认并发数
        cleanupInterval: 24 * 60 * 60 * 1000, // 默认每天清理一次
        ...options,
        ...opts,
      };
      const resumeStrategy = new ResumeUploadStrategy(finalOptions);

      // 设置事件发射器
      resumeStrategy.setEventEmitter(uploader.eventEmitter);

      // 注册钩子
      uploader.hooks.beforeUpload.register(async (file: any) => {
        // 检查文件是否可以续传
        const resumeState = await resumeStrategy.checkResumable(file);
        if (resumeState) {
          // 将续传状态附加到文件上下文
          file._resumeState = resumeState;

          // 获取分片详细状态统计
          const stats = await resumeStrategy.getUploadStats(file.id);

          // 触发续传状态事件
          uploader.eventEmitter.emit('resume:detected', {
            fileId: file.id,
            fileName: file.name,
            progress: resumeState.progress.percent,
            uploadedChunks: resumeState.uploadedChunks.length,
            totalChunks: resumeState.totalChunks,
            uploaded: stats.uploaded,
            failed: stats.failed,
            pending: stats.pending,
            uploading: stats.uploading,
            estimatedTimeRemaining: stats.estimatedTimeRemaining,
          });
        }
        return file;
      });

      // 注册分片处理钩子
      uploader.hooks.beforeChunkUpload.register(async (params: any) => {
        const { file, chunks } = params;
        if (file._resumeState) {
          // 获取需要上传的分片
          const pendingChunks = await resumeStrategy.getPendingChunks(file.id, chunks.length);
          params._pendingChunks = pendingChunks;

          // 添加并发控制
          if (!resumeStrategy.canUploadMoreChunks(file.id)) {
            // 如果当前活跃分片数已达到最大并发数，暂停此分片
            params._shouldSkip = true;

            // 发送并发限制事件
            uploader.eventEmitter.emit('resume:concurrency_limit', {
              fileId: file.id,
              activeChunks: resumeStrategy.getActiveChunksCount(file.id),
              maxConcurrentChunks: finalOptions.maxConcurrentChunks,
            });
          }
        }
        return params;
      });

      // 注册分片开始上传钩子
      uploader.hooks.beforeChunkRequest?.register(async (params: any) => {
        const { file, chunkIndex } = params;
        // 标记分片开始上传
        resumeStrategy.markChunkAsUploading(file.id, chunkIndex);

        // 发送分片开始上传事件
        uploader.eventEmitter.emit('resume:chunk_start', {
          fileId: file.id,
          chunkIndex,
          activeChunks: resumeStrategy.getActiveChunksCount(file.id),
        });

        return params;
      });

      // 注册分片上传成功钩子
      uploader.hooks.afterChunkUpload.register(async (result: any) => {
        const { file, chunkIndex } = result;
        // 标记分片完成（这个方法内部会更新上传状态，不需要再调用updateUploadedChunk）
        await resumeStrategy.markChunkAsComplete(file.id, chunkIndex);

        // 获取最新状态
        const stats = await resumeStrategy.getUploadStats(file.id);

        // 发送分片完成事件
        uploader.eventEmitter.emit('resume:chunk_complete', {
          fileId: file.id,
          chunkIndex,
          remainingChunks: stats.total - stats.uploaded,
          uploaded: stats.uploaded,
          total: stats.total,
          progress: stats.progress,
        });

        return result;
      });

      // 注册分片上传失败钩子
      uploader.hooks.onChunkError?.register(async (error: any) => {
        const { file, chunkIndex, error: errorInfo } = error;
        // 标记分片失败
        resumeStrategy.markChunkAsFailed(file.id, chunkIndex, errorInfo?.message);

        // 发送分片失败事件
        uploader.eventEmitter.emit('resume:chunk_failed', {
          fileId: file.id,
          chunkIndex,
          error: errorInfo?.message || '未知错误',
        });

        return error;
      });

      // 注册上传完成钩子
      uploader.hooks.afterUpload.register(async (result: any) => {
        const { file } = result;
        // 清理存储
        await resumeStrategy.completeUpload(file.id);

        // 发送存储清理事件
        uploader.eventEmitter.emit('resume:storage_cleared', {
          fileId: file.id,
          fileName: file.name,
        });

        return result;
      });

      // 注册上传暂停钩子
      uploader.hooks.onPause?.register(async (file: any) => {
        if (!file) return file;

        try {
          // 获取当前分片状态并更新所有正在上传的分片为暂停状态
          const chunksDetails = await resumeStrategy.getChunksDetails(file.id);
          for (const chunk of chunksDetails) {
            if (chunk.status === ChunkStatus.UPLOADING) {
              await resumeStrategy.updateChunkStatus(file.id, chunk.index, ChunkStatus.PAUSED);
            }
          }

          // 发送暂停事件
          uploader.eventEmitter.emit('resume:paused', {
            fileId: file.id,
            fileName: file.name,
          });
        } catch (error) {
          console.error('暂停上传时出错', error);
        }

        return file;
      });

      // 添加获取上传状态方法
      uploader.getUploadStats = async (fileId: string) => {
        return resumeStrategy.getUploadStats(fileId);
      };

      // 添加获取分片详情方法
      uploader.getChunksDetails = async (fileId: string) => {
        return resumeStrategy.getChunksDetails(fileId);
      };

      // 向上传器添加resumeStrategy引用，以便在需要时直接访问
      uploader.resumeStrategy = resumeStrategy;
    },

    // 清理资源
    cleanup: (uploader: any) => {
      if (uploader.resumeStrategy) {
        uploader.resumeStrategy.destroy();
        delete uploader.resumeStrategy;
        delete uploader.getUploadStats;
        delete uploader.getChunksDetails;
      }
    },
  };
};
