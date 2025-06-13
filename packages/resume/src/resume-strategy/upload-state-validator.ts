/**
 * 上传状态验证器
 * 负责验证上传状态的有效性
 */
import { IFileInfo } from '@file-chunk-uploader/types';

import { IExtendedUploadState } from './types';
import { IUploadStateValidationResult } from './types';

/**
 * 上传状态验证器类
 * 验证上传状态的有效性，确保断点续传安全
 */
export class UploadStateValidator {
  /**
   * 验证上传状态是否有效
   * @param state 上传状态
   * @param fileInfo 文件信息
   * @returns 验证结果
   */
  public validateUploadState(
    state: IExtendedUploadState,
    fileInfo: IFileInfo & { config?: { chunkSize: number; target: string } },
  ): IUploadStateValidationResult {
    // 如果状态不存在，则无效
    if (!state) {
      return {
        valid: false,
        reason: 'state_missing',
        recoverable: false,
      };
    }

    // 基本验证：文件ID和名称
    if (state.fileId !== fileInfo.id) {
      return {
        valid: false,
        reason: 'file_id_mismatch',
        recoverable: false,
        details: {
          expectedId: state.fileId,
          actualId: fileInfo.id,
        },
      };
    }

    // 文件名验证（允许文件名变化，但记录为警告）
    const fileNameChanged = state.fileName !== fileInfo.name;

    // 文件大小验证 - 这是必须匹配的
    if (state.fileSize !== fileInfo.size) {
      return {
        valid: false,
        reason: 'file_size_mismatch',
        recoverable: false,
        details: {
          expectedSize: state.fileSize,
          actualSize: fileInfo.size,
        },
      };
    }

    // 最后修改时间验证 - 如果不匹配，可能文件内容已变化
    if (state.lastModified !== fileInfo.lastModified) {
      return {
        valid: false,
        reason: 'last_modified_mismatch',
        recoverable: false,
        details: {
          expectedLastModified: state.lastModified,
          actualLastModified: fileInfo.lastModified,
          timeDifference: Math.abs(state.lastModified - fileInfo.lastModified),
        },
      };
    }

    // 检查分片信息是否存在
    if (!state.uploadedChunks || !Array.isArray(state.uploadedChunks)) {
      return {
        valid: false,
        reason: 'chunks_info_missing',
        recoverable: true,
      };
    }

    // 验证上传配置是否兼容
    if (state.config && fileInfo.config) {
      // 验证分片大小 - 如果分片大小变化，可能导致分片索引错位
      if ((state.config as any).chunkSize !== fileInfo.config.chunkSize) {
        return {
          valid: false,
          reason: 'chunk_size_mismatch',
          recoverable: false,
          details: {
            expectedChunkSize: (state.config as any).chunkSize,
            actualChunkSize: fileInfo.config.chunkSize,
          },
        };
      }

      // 验证上传目标URL - 如果变化，可能需要重新上传
      if ((state.config as any).target !== fileInfo.config.target) {
        return {
          valid: false,
          reason: 'target_url_mismatch',
          recoverable: false,
          details: {
            expectedTarget: (state.config as any).target,
            actualTarget: fileInfo.config.target,
          },
        };
      }
    }

    // 检查上传时间是否过期
    const now = Date.now();
    const maxUploadAge = 7 * 24 * 60 * 60 * 1000; // 默认7天
    const uploadAge = now - (state.lastUpdated || 0);

    if (uploadAge > maxUploadAge) {
      return {
        valid: false,
        reason: 'upload_expired',
        recoverable: false,
        details: {
          age: uploadAge,
          maxAge: maxUploadAge,
        },
      };
    }

    // 所有验证通过，但文件名可能已变化
    if (fileNameChanged) {
      return {
        valid: true,
        reason: 'file_name_changed',
        details: {
          expectedName: state.fileName,
          actualName: fileInfo.name,
        },
      };
    }

    // 验证通过
    return { valid: true };
  }
}
