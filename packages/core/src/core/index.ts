/**
 * 核心模块入口
 * 导出核心功能组件
 */
import { getDefaultConfig } from './config';
import { FileUploader } from './file-uploader';
import { UploaderTask } from './uploader-task';

export { FileUploader, UploaderTask, getDefaultConfig };

// 默认导出FileUploader类
export default FileUploader;
