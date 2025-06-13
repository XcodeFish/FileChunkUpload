/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path');

module.exports = {
  mode: 'development',
  entry: path.resolve(__dirname, './basic-resume-upload.ts'),
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, '.'),
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      '@file-chunk-uploader/core': path.resolve(__dirname, '../../core'),
      '@file-chunk-uploader/types': path.resolve(__dirname, '../../types'),
    },
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: 'ts-loader',
          options: {
            configFile: path.resolve(__dirname, './tsconfig.json'),
            transpileOnly: true,
          },
        },
        exclude: /node_modules/,
      },
    ],
  },
  devtool: 'source-map',
  stats: {
    warningsFilter: [/export .* was not found/, /Module not found/],
  },
};
