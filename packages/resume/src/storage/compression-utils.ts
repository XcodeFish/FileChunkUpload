/**
 * 数据压缩工具类
 * 提供用于压缩和解压数据的工具方法
 */

/**
 * 压缩Blob数据
 * @param data 要压缩的数据
 * @param method 压缩方法
 * @returns 压缩后的数据
 */
export async function compressData(
  data: Blob,
  method: 'gzip' | 'deflate' | 'custom' = 'gzip',
  customCompressor?: (data: Blob) => Promise<Blob>,
): Promise<{ compressedData: Blob; originalSize: number; method: string }> {
  // 输入类型验证
  if (!(data instanceof Blob)) {
    throw new Error('压缩数据必须是Blob类型');
  }

  // 保存原始大小
  const originalSize = data.size;

  // 如果数据太小，不压缩
  if (originalSize < 1024) {
    return { compressedData: data, originalSize, method: 'none' };
  }

  // 使用自定义压缩器
  if (method === 'custom' && customCompressor) {
    try {
      const compressedData = await customCompressor(data);
      return {
        compressedData,
        originalSize,
        method: 'custom',
      };
    } catch (error) {
      console.warn('自定义压缩失败，使用原始数据', error);
      return { compressedData: data, originalSize, method: 'none' };
    }
  }

  // 使用 CompressionStream API (如果浏览器支持)
  if (typeof CompressionStream !== 'undefined') {
    try {
      const blob = new Blob([await data.arrayBuffer()]);
      const stream = blob.stream();
      // 仅使用有效的压缩格式
      const compressionMethod = method === 'custom' ? 'gzip' : method;
      const compressedStream = stream.pipeThrough(
        new CompressionStream(compressionMethod as CompressionFormat),
      );
      const compressedData = await new Response(compressedStream).blob();

      // 如果压缩后更大，则使用原始数据
      if (compressedData.size >= originalSize) {
        return { compressedData: data, originalSize, method: 'none' };
      }

      return {
        compressedData,
        originalSize,
        method,
      };
    } catch (error) {
      console.warn(`${method}压缩失败，使用原始数据`, error);
      return { compressedData: data, originalSize, method: 'none' };
    }
  }

  // 不支持压缩
  return { compressedData: data, originalSize, method: 'none' };
}

/**
 * 解压缩Blob数据
 * @param compressedData 压缩的数据
 * @param method 使用的压缩方法
 * @returns 解压后的数据
 */
export async function decompressData(
  compressedData: Blob,
  method: string,
  customDecompressor?: (data: Blob) => Promise<Blob>,
): Promise<Blob> {
  // 输入类型验证
  if (!(compressedData instanceof Blob)) {
    throw new Error('解压数据必须是Blob类型');
  }

  // 如果未压缩，直接返回
  if (method === 'none') {
    return compressedData;
  }

  // 使用自定义解压缩器
  if (method === 'custom' && customDecompressor) {
    try {
      return await customDecompressor(compressedData);
    } catch (error) {
      console.error('自定义解压失败', error);
      throw new Error('解压失败: 自定义解压错误');
    }
  }

  // 使用 DecompressionStream API
  if (typeof DecompressionStream !== 'undefined' && (method === 'gzip' || method === 'deflate')) {
    try {
      const blob = new Blob([await compressedData.arrayBuffer()]);
      const stream = blob.stream();
      const decompressedStream = stream.pipeThrough(new DecompressionStream(method as any));
      return await new Response(decompressedStream).blob();
    } catch (error) {
      console.error(`${method}解压失败`, error);
      throw new Error(`解压失败: ${method}解压错误`);
    }
  }

  // 不支持的压缩方法
  throw new Error(`解压失败: 不支持的压缩方法 ${method}`);
}

/**
 * 检查浏览器是否支持压缩API
 * @returns 是否支持压缩
 */
export function isCompressionSupported(): boolean {
  return typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
}
