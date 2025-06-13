import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';

/** @type {import('rollup').RollupOptions} */
export default {
  input: 'src/index.ts',
  output: [
    {
      dir: 'dist',
      format: 'cjs',
      entryFileNames: 'index.js',
      chunkFileNames: '[name]-[hash].js',
      sourcemap: true,
      inlineDynamicImports: true,
    },
    {
      dir: 'dist',
      format: 'esm',
      entryFileNames: 'index.esm.js',
      chunkFileNames: '[name]-[hash].esm.js',
      sourcemap: true,
      inlineDynamicImports: true,
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
  ],
};
