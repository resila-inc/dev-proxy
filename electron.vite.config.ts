import { defineConfig } from 'electron-vite'
import { resolve } from 'node:path'

export default defineConfig({
  main: {
    build: {
      lib: {
        entry: resolve(__dirname, 'src/main/index.ts'),
        formats: ['cjs'],
      },
      rollupOptions: {
        external: ['electron'],
        output: {
          entryFileNames: '[name].cjs',
        },
      },
    },
  },
  preload: {
    build: {
      lib: {
        entry: resolve(__dirname, 'src/renderer/preload.ts'),
        formats: ['cjs'],
      },
      rollupOptions: {
        external: ['electron'],
        output: {
          entryFileNames: '[name].cjs',
        },
      },
    },
  },
  renderer: {
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
        },
      },
    },
  },
})
