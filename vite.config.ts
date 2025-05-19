import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default defineConfig({
  // 插件配置
  plugins: [react()],

  // 基础公共路径
  base: './',

  // 项目根目录
  root: '.',

  // 静态资源目录
  publicDir: 'public',

  // 开发服务器配置
  server: {
    port: 3000,
    open: false,
  },

  // 构建配置
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsDir: 'assets',
    minify: 'terser',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'public/index.html')
      },
      output: {
        dir: 'dist'
      }
    }
  },

  // 解析配置
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json']
  }
}); 