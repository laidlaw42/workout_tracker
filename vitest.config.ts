import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))

// Standalone from vite.config.ts (which carries the PWA/mkcert plugins we don't
// want in unit tests). Only the `@` alias is needed to resolve `@/…` imports.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(root, 'src') },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
