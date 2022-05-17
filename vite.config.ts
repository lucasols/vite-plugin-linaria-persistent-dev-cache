/// <reference types="vitest" />

import path from 'path'
import { defineConfig, Plugin } from 'vite'
import typescript from '@rollup/plugin-typescript'
import dts from 'rollup-plugin-dts'

const resolvePath = (str: string) => path.resolve(__dirname, str)

export default defineConfig({
  build: {
    target: 'esnext',
    lib: {
      entry: resolvePath('src/vite-plugin-linaria.ts'),
      name: 'vite-plugin-linaria',
      fileName: (format) => `vite-plugin-linaria.${format}.js`,
    },
    rollupOptions: {
      external: ['fs', 'path', 'crypto', 'vite', '@linaria/babel-preset'],
      plugins: [
        removeTestExports(),
        typescript({
          target: 'es2020',
          rootDir: resolvePath('src'),
          declaration: true,
          tsconfig: resolvePath('tsconfig.prod.json'),
          declarationDir: resolvePath('dist'),
          exclude: resolvePath('node_modules/**'),
          allowSyntheticDefaultImports: true,
        }),
      ],
    },
  },
  test: {
    include: ['test/*.test.{ts,tsx}'],
    testTimeout: 2_000,
  },
})

function removeTestExports(): Plugin {
  return {
    name: 'remove-test-exports',
    transform(code, id) {
      if (!id.endsWith('.ts')) {
        return
      }

      return code.replace(/export +?const +?testOnly *?= *?{[^]+?};?/, '')
    },
  }
}
