# 智能小助手桌面应用

基于Electron和React的桌面看板娘应用，支持Live2D模型展示、实时互动和热重载开发。

## 🚀 项目特点

- 🎭 **Live2D模型支持** - 完整的Live2D Cubism SDK集成，支持模型动画和互动
- 🪟 **透明无边框窗口** - 现代化的桌面应用界面设计
- 🎯 **窗口置顶功能** - 可切换的窗口置顶状态
- 🖱️ **拖拽移动** - 支持窗口拖拽移动
- 🔄 **热重载开发** - 开发模式下支持代码热重载
- 💬 **消息气泡** - 模型互动和消息显示
- 🎨 **模型换装** - 支持模型服装和配饰切换
- 📦 **工程化管理** - 使用pnpm workspace + Turborepo

## 📁 项目结构

```
ig-live-monorepo/
├── packages/
│   ├── electron/           # Electron主进程和预加载脚本
│   │   ├── src/
│   │   │   ├── main.ts    # 主进程入口
│   │   │   └── preload.ts # 预加载脚本
│   │   └── package.json
│   ├── renderer/          # React前端渲染器
│   │   ├── src/
│   │   │   ├── App.tsx    # 应用主组件
│   │   │   ├── components/ # React组件
│   │   │   └── live2d/    # Live2D相关代码
│   │   └── package.json
│   └── types/             # 共享类型定义
│       └── index.ts
├── scripts/               # 构建和工具脚本
├── tasks/                 # 开发任务记录
├── design/                # 设计资源
├── pnpm-workspace.yaml    # 工作区配置
├── turbo.json            # Turborepo配置
└── package.json          # 根配置文件
```

## 🛠️ 开发环境设置

### 系统要求

- Node.js >= 16.0.0
- pnpm >= 8.0.0

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
pnpm dev
```

这将同时启动：
- React开发服务器 (Vite)
- Electron应用
- TypeScript编译监听

开发模式下支持热重载，修改代码后应用会自动更新。

### 构建项目

```bash
# 构建所有包
pnpm build

# 单独构建渲染器
pnpm build:renderer

# 单独构建Electron
pnpm build:electron
```

### 打包应用

```bash
# 生产环境打包
pnpm package:prod

# macOS打包
pnpm package:prod:mac

# Windows打包
pnpm package:prod:win

# 调试模式打包
pnpm package:debug
```

## ⌨️ 快捷键

- `Alt+P`: 切换窗口置顶状态
- `Alt+Q`: 退出应用

## 🎮 功能特点

### 核心功能

- **透明无边框窗口** - 现代化的桌面应用界面
- **窗口拖拽** - 支持鼠标拖拽移动窗口位置
- **窗口置顶切换** - 可通过快捷键或界面切换置顶状态
- **Live2D模型展示** - 完整的Live2D Cubism SDK集成
- **模型互动** - 支持鼠标点击和触摸互动
- **消息气泡** - 模型消息显示和互动反馈

### Live2D功能

- **模型加载** - 支持本地和远程模型加载
- **动画播放** - 支持待机、触摸等各种动画
- **换装系统** - 支持模型服装和配饰切换
- **物理效果** - 支持Live2D物理引擎
- **表情控制** - 支持表情参数调节

### 开发功能

- **热重载** - 开发模式下代码修改实时生效
- **TypeScript支持** - 完整的类型安全
- **模块化架构** - 清晰的包结构和依赖管理
- **构建优化** - 使用Turborepo进行高效构建

## 🎨 模型仓库

本项目并不包含任何模型，需要单独配置模型仓库来显示Live2D模型。

### 模型结构

模型仓库应该具有以下结构：

```
models/
├── model_list.json        # 模型列表配置
├── [模型名称1]/
│   ├── index.json        # 模型配置文件
│   ├── model.json        # Live2D模型定义
│   ├── model.moc         # 模型数据文件
│   ├── textures/         # 纹理文件夹
│   │   ├── texture_00.png
│   │   └── ...
│   ├── physics.json      # 物理配置
│   ├── motions/          # 动作文件夹
│   │   ├── idle/
│   │   ├── tap_body/
│   │   └── ...
│   └── expressions/      # 表情文件夹
└── [模型名称2]/
    └── ...
```

### 模型配置

`model_list.json` 示例：

```json
{
  "models": [
    {
      "name": "模型名称",
      "path": "模型文件夹名",
      "preview": "预览图片路径",
      "description": "模型描述"
    }
  ]
}
```

### 推荐的模型资源

出于研究和学习目的，您可以参考以下模型仓库：

- [live2d-model-assets](https://github.com/zenghongtu/live2d-model-assets)
- [live2d_api](https://github.com/fghrsh/live2d_api)
- [Live2D官方示例](https://www.live2d.com/download/sample-data/)

**请确保您遵守所使用模型的许可条款。**

## 🔧 配置说明

### 环境变量

- `NODE_ENV` - 运行环境 (development/production)
- `DEBUG` - 调试模式开关

### 构建配置

项目使用以下工具进行构建和打包：

- **Vite** - 前端构建工具，支持快速热重载
- **TypeScript** - 类型安全的JavaScript超集
- **Electron Builder** - Electron应用打包工具
- **Turborepo** - 高性能的monorepo构建系统

## 📝 开发指南

### 添加新功能

1. 在对应的包中添加代码
2. 更新类型定义 (`packages/types`)
3. 添加必要的测试
4. 更新文档

### 调试技巧

- 使用 `pnpm package:debug` 构建调试版本
- 开发模式下可以使用浏览器开发者工具
- 查看 `tasks/` 目录中的开发记录

### 代码规范

- 使用TypeScript进行类型安全开发
- 遵循React最佳实践
- 保持代码模块化和可维护性

## 🙏 致谢

本项目基于多个开源项目和技术构建，特别感谢：

### 核心技术与框架

- [Live2D Widget](https://github.com/stevenjoezhang/live2d-widget) - 提供了Web端Live2D模型展示的核心实现
- [Electron](https://www.electronjs.org/) - 跨平台桌面应用开发框架
- [React](https://reactjs.org/) - 用户界面库
- [TypeScript](https://www.typescriptlang.org/) - 类型安全的JavaScript超集
- [Turborepo](https://turbo.build/) - 高性能构建系统
- [Vite](https://vitejs.dev/) - 现代化的前端构建工具

### 开发工具与依赖

- [electron-reload](https://github.com/yan-foto/electron-reload) - 提供Electron应用的热重载功能
- [concurrently](https://github.com/open-cli-tools/concurrently) - 同时运行多个命令的工具
- [pnpm](https://pnpm.io/) - 快速、节省磁盘空间的包管理器
- [cross-env](https://github.com/kentcdodds/cross-env) - 跨平台设置环境变量
- [wait-on](https://github.com/jeffbski/wait-on) - 等待资源可用的工具
- [electron-builder](https://www.electron.build/) - 打包和分发Electron应用

### 特别致谢

- [stevenjoezhang (Mimi)](https://github.com/stevenjoezhang) - Live2D Widget的原作者，提供了优秀的Web端实现
- [fghrsh](https://www.fghrsh.net/post/123.html) - 提供了最初的Live2D实现思路和API服务
- [一言](https://hitokoto.cn) - 提供了句子API服务
- [Live2D Inc.](https://www.live2d.com/) - 开发了Live2D技术和Cubism SDK

感谢所有开源社区的贡献者，他们的工作使本项目成为可能。本项目站在巨人的肩膀上，没有这些优秀的开源项目和社区支持，将无法实现。

## 📄 许可证

本仓库并不包含任何模型，用作展示的所有 Live2D 模型、图片、动作数据等版权均属于其原作者，仅供研究学习，不得用于商业用途。

本仓库的代码（不包括受 Live2D Proprietary Software License 和 Live2D Open Software License 约束的部分）基于 MIT 协议开源。

Live2D 相关代码的使用请遵守对应的许可：

**Live2D Cubism SDK 2.1 的许可证：**  
[Live2D SDK License Agreement (Public)](https://docs.google.com/document/d/10tz1WrycskzGGBOhrAfGiTSsgmyFy8D9yHx9r_PsN8I/)

**Live2D Cubism SDK 5 的许可证：**  
Live2D Cubism Core は Live2D Proprietary Software License で提供しています。  
https://www.live2d.com/eula/live2d-proprietary-software-license-agreement_cn.html  
Live2D Cubism Components は Live2D Open Software License で提供しています。  
https://www.live2d.com/eula/live2d-open-software-license-agreement_cn.html

---

## 🔗 相关链接

- [项目仓库](https://github.com/your-username/ig-live-monorepo)
- [问题反馈](https://github.com/your-username/ig-live-monorepo/issues)
- [开发文档](./docs/)
- [更新日志](./CHANGELOG.md)