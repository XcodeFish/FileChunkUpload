/**
 * 分片创建器
 * 负责文件分片和元数据创建
 * @module file-handler/chunk-creator
 */
import { IChunkInfo } from '@file-chunk-uploader/types';

/**
 * 分片创建器类
 * 负责创建文件分片和分片元数据
 */
export class ChunkCreator {
  /**
   * 创建文件分片
   * @param file 要分片的文件
   * @param chunkSize 分片大小（字节）
   * @returns 分片数组
   */
  public async createChunks(file: File, chunkSize: number): Promise<Blob[]> {
    if (!file) {
      throw new Error('文件不能为空');
    }

    if (chunkSize <= 0) {
      throw new Error('分片大小必须大于0');
    }

    const chunks: Blob[] = [];
    let start = 0;

    while (start < file.size) {
      const end = Math.min(start + chunkSize, file.size);
      const chunk = file.slice(start, end);
      chunks.push(chunk);
      start = end;
    }

    return chunks;
  }

  /**
   * 创建分片元数据
   * @param chunks 分片数组
   * @param fileId 文件ID
   * @param chunkSize 分片大小
   * @returns 分片元数据数组
   */
  public createChunkInfos(chunks: Blob[], fileId: string, chunkSize: number): IChunkInfo[] {
    return chunks.map((chunk, index) => {
      const start = index * chunkSize;
      const end = start + chunk.size - 1;

      return {
        index,
        fileId,
        data: chunk,
        size: chunk.size,
        start,
        end,
        isLast: index === chunks.length - 1,
        status: 'pending' as 'pending' | 'uploading' | 'uploaded' | 'error',
        retryCount: 0,
        updatedAt: Date.now(),
      };
    });
  }
}
