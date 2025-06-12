/**
 * 默认配置模块
 * 提供上传器的默认配置选项
 */
import { IUploadConfig } from '@file-chunk-uploader/types';

/**
 * 获取默认配置
 * @returns 默认上传配置
 */
export function getDefaultConfig(): IUploadConfig {
  return {
    target: '',
    method: 'POST',
    headers: {},
    formData: {},
    timeout: 0,
    useFormData: true,
    fileFieldName: 'file',
    chunk: {
      chunkSize: 2 * 1024 * 1024, // 2MB
      concurrency: 3,
      sequential: false,
      indexBase: 0,
      chunkSizeStrategy: 'fixed',
    },
    retry: {
      enabled: true,
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      useExponentialBackoff: true,
    },
    storage: {
      type: 'localStorage',
      keyPrefix: 'file-uploader-',
      enabled: true,
      expiration: 7 * 24 * 60 * 60 * 1000, // 7天
    },
    devMode: false,
    resumable: false,
    fastUpload: false,
  };
}
