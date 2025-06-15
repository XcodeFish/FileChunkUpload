/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFiles: ['./jest.setup.js'],
  setupFilesAfterEnv: ['./jest.setup.ts'],
  moduleNameMapper: {
    '^@file-chunk-uploader/types$': '<rootDir>/../types/src',
    '^@file-chunk-uploader/utils$': '<rootDir>/../utils/src',
  },
  testMatch: ['<rootDir>/**/*.test.ts'],
  transform: {
    '^.+\\.[tj]sx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json',
      },
    ],
  },
  globals: {
    'ts-jest': {
      isolatedModules: true,
    },
  },
  testTimeout: 60000,
};
