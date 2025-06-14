/**
 * 重试错误分析器
 * 负责分析和分类错误，为重试决策提供支持
 * @packageDocumentation
 */

import { IUploadError } from '@file-chunk-uploader/types';

/**
 * 错误类型分类
 * 将错误代码归类为不同类型
 */
export const ERROR_TYPE_MAP: Record<string, 'network' | 'server' | 'timeout' | 'unknown'> = {
  // 网络错误
  network_error: 'network',
  network_disconnect: 'network',

  // 服务器错误
  server_error: 'server',
  server_overload: 'server',
  server_timeout: 'timeout',

  // 超时错误
  timeout: 'timeout',

  // 其他错误
  chunk_upload_failed: 'network',
  file_read_error: 'network',
  storage_error: 'network',
  quota_exceeded: 'server',
  unknown_error: 'unknown',

  // 字符串形式的错误代码（用于兼容测试，与上面的枚举值不重复）
  auth_error: 'server',
  file_error: 'network',
  chunk_error: 'network',
};

/**
 * 重试错误分析器类
 * 负责分析错误类型并提供错误分类服务
 */
export class RetryErrorAnalyzer {
  /**
   * 获取错误类型
   * 根据错误代码将错误分类为网络、服务器、超时或未知类型
   * 使用预定义的错误类型映射和智能推断
   *
   * @param error 错误对象
   * @returns 错误类型
   */
  getErrorType(error: IUploadError): 'network' | 'server' | 'timeout' | 'unknown' {
    // 首先检查预定义的错误类型映射
    const mappedType = ERROR_TYPE_MAP[error.code.toLowerCase()];
    if (mappedType) {
      return mappedType;
    }

    // 对于没有预定义映射的错误，通过错误代码特征进行智能推断
    const code = error.code.toLowerCase();
    const message = (error.message || '').toLowerCase();

    // 网络相关错误特征
    if (
      code.includes('network') ||
      code.includes('connect') ||
      code.includes('offline') ||
      message.includes('network') ||
      message.includes('connection') ||
      message.includes('断网') ||
      message.includes('offline')
    ) {
      return 'network';
    }

    // 服务器相关错误特征
    if (
      code.includes('server') ||
      code.includes('5xx') ||
      code.includes('500') ||
      message.includes('server') ||
      message.includes('服务器')
    ) {
      return 'server';
    }

    // 超时相关错误特征
    if (
      code.includes('timeout') ||
      code.includes('time_out') ||
      code.includes('timed_out') ||
      message.includes('timeout') ||
      message.includes('超时') ||
      message.includes('timed out')
    ) {
      return 'timeout';
    }

    // 默认为未知类型
    return 'unknown';
  }

  /**
   * 判断错误是否可重试
   * 基于错误类型和代码判断该错误是否可以重试
   *
   * @param error 错误对象
   * @returns 是否可重试
   */
  isErrorRetryable(error: IUploadError): boolean {
    // 获取错误类型
    const errorType = this.getErrorType(error);

    // 这些类型的错误通常是可重试的
    const retryableTypes = ['network', 'timeout', 'server'];
    if (retryableTypes.includes(errorType)) {
      // 某些服务器错误是不可重试的，例如权限错误
      if (errorType === 'server') {
        const code = error.code.toLowerCase() || '';
        // 特定类型的服务器错误可能不应该重试（如权限错误）
        if (code === 'authentication_failed' || code === 'authorization_failed') {
          return false;
        }
      }
      return true;
    }

    return false;
  }

  /**
   * 分析错误并推荐重试策略
   *
   * @param error 错误对象
   * @returns 重试策略建议
   */
  analyzeError(error: IUploadError): {
    shouldRetry: boolean;
    recommendedDelay: number;
    reason: string;
  } {
    const errorType = this.getErrorType(error);
    let shouldRetry = true;
    let recommendedDelay = 1000;
    let reason = '默认策略';

    switch (errorType) {
      case 'network':
        recommendedDelay = 3000; // 网络错误适中延迟
        reason = '网络错误，适中延迟重试';
        break;
      case 'server':
        if (error.code.toLowerCase() === 'server_overload') {
          recommendedDelay = 5000; // 服务器过载，较长延迟
          reason = '服务器过载，较长延迟重试';
        } else {
          recommendedDelay = 2000; // 一般服务器错误
          reason = '服务器错误，标准延迟重试';
        }
        break;
      case 'timeout':
        recommendedDelay = 4000; // 超时错误，较长延迟
        reason = '超时错误，较长延迟重试';
        break;
      case 'unknown':
        shouldRetry = this.isErrorRetryable(error);
        recommendedDelay = 2000;
        reason = shouldRetry ? '未知但可能可重试的错误' : '未知且不可重试的错误';
        break;
    }

    // 特殊错误代码处理
    const specialErrorResult = this.handleSpecialErrorCodes(error);
    if (specialErrorResult) {
      shouldRetry = specialErrorResult.shouldRetry;
      reason = specialErrorResult.reason;
    }

    return {
      shouldRetry,
      recommendedDelay,
      reason,
    };
  }

  /**
   * 特殊错误代码处理
   * @param error 错误对象
   * @returns 处理结果
   */
  private handleSpecialErrorCodes(
    error: IUploadError,
  ): { shouldRetry: boolean; reason: string } | null {
    // 特殊错误代码处理
    const errorCode = error.code.toLowerCase();
    if (errorCode === 'quota_exceeded') {
      return {
        shouldRetry: false,
        reason: '配额超出错误，不建议重试',
      };
    } else if (errorCode === 'file_read_error' || errorCode === 'file_not_found') {
      return {
        shouldRetry: false,
        reason: '文件错误，不建议重试',
      };
    }

    return null;
  }

  /**
   * 获取错误类型的延迟因子
   * 不同类型的错误适用不同的延迟策略
   *
   * @param errorType 错误类型
   * @returns 延迟因子
   */
  getErrorTypeDelayFactor(errorType: 'network' | 'server' | 'timeout' | 'unknown'): number {
    switch (errorType) {
      case 'network':
        return 1.5; // 网络错误稍长延迟
      case 'server':
        return 2.0; // 服务器错误更长延迟
      case 'timeout':
        return 1.8; // 超时错误较长延迟
      case 'unknown':
      default:
        return 1.0; // 默认因子
    }
  }
}

/**
 * 创建重试错误分析器的工厂函数
 * @returns 重试错误分析器实例
 */
export function createRetryErrorAnalyzer(): RetryErrorAnalyzer {
  return new RetryErrorAnalyzer();
}
