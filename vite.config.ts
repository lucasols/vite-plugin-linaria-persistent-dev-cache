/// <reference types="vitest" />

import path from 'path'
import { defineConfig, Plugin } from 'vite'
import typescript from '@rollup/plugin-typescript'

const resolvePath = (str: string) => path.resolve(__dirname, str)

export default defineConfig({
  build: {
    lib: {
      formats: ['es'],
      entry: resolvePath('src/file-dep-hash.ts'),
      name: 'file-dep-hash',
      fileName: (format) => `file-dep-hash.${format}.js`,
    },
    rollupOptions: {
      external: ['fs', 'path', 'crypto'],
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
