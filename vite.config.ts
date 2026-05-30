import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: './',  // dist/ を file:// で開いても動くよう相対パス
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
})
