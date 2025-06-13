import { readFileSync } from 'fs';

import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';

// 使用Node.js的fs模块读取package.json
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

/** @type {import('rollup').RollupOptions} */
export default {
  input: 'src/index.ts',
  output: [
    {
      file: pkg.main,
      format: 'cjs',
      sourcemap: true,
    },
    {
      file: pkg.module,
      format: 'esm',
      sourcemap: true,
    },
  ],
  plugins: [
    // Resolve node_modules
    resolve(),
    // Convert CommonJS modules to ES6
    commonjs(),
    // Compile TypeScript
    typescript({
      tsconfig: './tsconfig.json',
      declaration: true,
      declarationDir: './dist',
    }),
    // Minify for production
    terser(),
  ],
  external: [
    '@file-chunk-uploader/types',
    '@file-chunk-uploader/core',
    '@file-chunk-uploader/utils',
  ], // 添加所有外部依赖
};
