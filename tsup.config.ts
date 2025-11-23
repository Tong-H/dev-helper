import { defineConfig } from 'tsup'
import { cpSync, existsSync } from 'fs'
import { join } from 'path'

export default defineConfig({
  entry: ['src/index.ts', 'src/monitor.ts', 'src/server.ts', 'src/processImage.ts'],
  splitting: false,
  clean: true,
  format: ['esm', 'cjs'],
  legacyOutput: true,
  outDir: 'build',
  // publicDir: './src/public',
  dts: {
    entry: ['src/index.ts', 'src/monitor.ts'],
  },
  onSuccess: async () => {
    // Copy public directory recursively
    cpSync('src/public', 'build/public', { recursive: true })
    console.log('✓ Copied src/public to build/public')
  },
})
