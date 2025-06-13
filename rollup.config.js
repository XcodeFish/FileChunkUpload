import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';

/** @type {import('rollup').RollupOptions} */
export default {
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/index.js',
      format: 'cjs',
      sourcemap: true,
    },
    {
      file: 'dist/index.esm.js',
      format: 'esm',
      sourcemap: true,
    },
  ],
  plugins: [
    // 解析node_modules
    resolve(),
    // 转换CommonJS模块为ES6
    commonjs(),
    // 编译TypeScript
    typescript({
      tsconfig: './tsconfig.json',
      declaration: true,
      declarationDir: './dist',
    }),
    // 生产环境压缩
    terser(),
  ],
  // 将依赖声明为外部依赖，避免打包它们
  external: [
    '@file-chunk-uploader/types',
    '@file-chunk-uploader/core',
    '@file-chunk-uploader/utils',
  ],
};
