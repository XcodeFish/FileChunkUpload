module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  testMatch: ['**/__tests__/**/*.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '../../tsconfig.json',
        isolatedModules: true,
      },
    ],
  },
  moduleNameMapper: {
    '^@file-chunk-uploader/(.*)$': '<rootDir>/../../packages/$1/src',
  },
  transformIgnorePatterns: ['/node_modules/(?!(@file-chunk-uploader)/)'],
};
