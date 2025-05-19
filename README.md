# Electron + React + TypeScript 项目

## 目录结构

```
├── main.ts              # Electron 主进程入口
├── preload.ts           # Electron 预加载脚本
├── src/
│   ├── App.tsx          # React 主组件
│   └── index.tsx        # React 入口文件
├── index.html           # Vite HTML 模板
├── package.json         # 项目配置
├── tsconfig.json        # TypeScript 配置
├── vite.config.ts       # Vite 配置
```

## 启动方式

1. 安装依赖（请使用 pnpm）：
   ```sh
   pnpm install
   ```

2. 开发模式：
   ```sh
   pnpm electron:dev
   ```
   这会同时启动 Vite 开发服务器和 Electron

3. 构建并启动：
   ```sh
   pnpm build
   pnpm build:electron
   pnpm start
   ```

4. 打包应用：
   ```sh
   pnpm package
   ``` 