import { defineConfig } from 'vite'
import { react } from '@lucasols/vite-plugin-swc-react'
import { linaria } from 'vite-plugin-linaria-persistent-dev-cache'
import reactBabel from '@vitejs/plugin-react'
// import swcReact from 'vite-plugin-swc-react'
import Inspect from 'vite-plugin-inspect'

export default defineConfig({
  plugins: [
    linaria({
      sourceMap: true,
      include: [],
      lockFilePath: '../pnpm-lock.yaml',
    }),
    react(),
    // reactBabel(),
    Inspect(),
  ],
  resolve: {
    alias: [{ find: '@components', replacement: '/src/components' }],
  },
  build: {
    sourcemap: true,
  },
})
