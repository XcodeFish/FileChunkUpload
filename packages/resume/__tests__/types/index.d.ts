import 'jest';

declare module '@file-chunk-uploader/core' {
  export interface IEventEmitter {
    emit(event: string, data: any): void;
    on(event: string, callback: (data: any) => void): void;
    off(event: string, callback: (data: any) => void): void;
  }

  export interface ILogger {
    debug(message: string, ...args: any[]): void;
    info(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
    error(message: string, ...args: any[]): void;
  }
}

declare module '@file-chunk-uploader/types' {
  export interface IUploadState {
    fileId: string;
    fileName: string;
    fileSize: number;
    fileType?: string;
    chunkSize: number;
    totalChunks: number;
    uploadedChunks: number[];
    lastUpdated: number;
    metadata?: Record<string, any>;
  }

  export interface IFileInfo {
    fileId: string;
    fileName: string;
    fileSize: number;
    fileType?: string;
    chunkSize: number;
    totalChunks: number;
    chunks: Blob[];
    metadata?: Record<string, any>;
  }

  export interface IStorageOptions {
    dbName: string;
    storeName: string;
    version?: number;
    maxAge?: number;
    compressionThreshold?: number;
  }

  export interface IResumeUploadStrategyOptions {
    storage: {
      dbName: string;
      storeName: string;
      version?: number;
    };
    chunkSize?: number;
    maxConcurrentUploads?: number;
    eventEmitter: import('@file-chunk-uploader/core').IEventEmitter;
    logger?: import('@file-chunk-uploader/core').ILogger;
  }
}

// 为测试目的声明模块接口
declare module '../../src/storage/storage-manager' {
  import { IStorageOptions, IUploadState } from '@file-chunk-uploader/types';

  export class MockStorageManager {
    constructor(options: IStorageOptions);
    init(): Promise<void>;
    isInitialized(): boolean;
    saveUploadState(state: IUploadState): Promise<boolean>;
    getUploadState(fileId: string): Promise<IUploadState | null>;
    removeUploadState(fileId: string): Promise<boolean>;
    getAllUploadStates(): Promise<IUploadState[]>;
    clear(): Promise<void>;
    close(): Promise<void>;
  }
}

declare module '../../src/storage/indexed-db-adapter' {
  import { IUploadState } from '@file-chunk-uploader/types';

  export class MockIndexedDBAdapter {
    constructor(dbName: string, storeName: string, version?: number);
    init(): Promise<void>;
    saveUploadState(state: IUploadState): Promise<boolean>;
    getUploadState(fileId: string): Promise<IUploadState | null>;
    removeUploadState(fileId: string): Promise<boolean>;
    getAllUploadStates(): Promise<IUploadState[]>;
    clear(): Promise<void>;
    close(): Promise<void>;
  }
}

declare module '../../src/resume-strategy/resume-upload-strategy' {
  import {
    IFileInfo,
    IResumeUploadStrategyOptions,
    IUploadState,
  } from '@file-chunk-uploader/types';

  export class MockResumeUploadStrategy {
    constructor(options: IResumeUploadStrategyOptions);
    init(): Promise<void>;
    generateFileId(file: File): string;
    processFile(file: File): Promise<IFileInfo>;
    hasUploadState(fileId: string): Promise<boolean>;
    resumeUpload(fileId: string): Promise<IUploadState>;
    saveProgress(fileId: string, chunkIndex: number): Promise<void>;
    completeUpload(fileId: string): Promise<void>;
    handleUploadFailure(fileId: string, error: Error): Promise<void>;
    close(): Promise<void>;
  }
}
