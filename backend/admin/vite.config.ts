// backend/admin/vite.config.ts

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/admin/',  // ← 加这一行！打包后的资源路径变成 /admin/assets/...
})