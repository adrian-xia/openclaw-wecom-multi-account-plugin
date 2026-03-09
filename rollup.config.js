import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';
import dts from 'rollup-plugin-dts';

export default [
  {
    input: 'index.ts',
    output: [
      { file: 'dist/index.esm.js', format: 'esm', sourcemap: true },
      { file: 'dist/index.cjs.js', format: 'cjs', sourcemap: true, exports: 'named' },
    ],
    external: ['openclaw/plugin-sdk'],
    plugins: [resolve({ preferBuiltins: true }), commonjs(), json(), typescript({ tsconfig: './tsconfig.json' })],
  },
  {
    input: 'index.ts',
    output: [{ file: 'dist/index.d.ts', format: 'esm' }],
    external: ['openclaw/plugin-sdk'],
    plugins: [dts()],
  },
];
