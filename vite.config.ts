/// <reference types="vitest" />

import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    include: ['test/*.test.{ts,tsx}'],
    testTimeout: 2_000,
  },
})
