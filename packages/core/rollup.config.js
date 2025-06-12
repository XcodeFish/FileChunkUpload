import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';

import pkg from './package.json' assert { type: 'json' };

/** @type {import('rollup').RollupOptions[]} */
export default [
  // CommonJS (for Node) and ES module (for bundlers) build
  {
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
        declaration: false,
      }),
      // Minify for production
      terser(),
    ],
    external: [],
  },
  // TypeScript declaration files
  {
    input: 'src/index.ts',
    output: {
      file: pkg.types,
      format: 'esm',
    },
    plugins: [dts()],
  },
];
