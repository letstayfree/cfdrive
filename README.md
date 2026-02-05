# CFDrive - 基于 Cloudflare 的云盘应用

> 基于 Cloudflare Workers & Pages 的现代云盘应用，后端使用 OneDrive (Microsoft Graph API) 存储

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare)](https://workers.cloudflare.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)

## ✨ 功能特性

### 核心功能
- 📁 **文件管理**: 文件夹创建、删除、重命名、复制、移动
- 📄 **文件上传**: 支持拖拽上传，大文件自动分片上传（>4MB）
- ⬇️ **文件下载**: 获取下载链接直接下载
- 🔍 **实时搜索**: 顶部搜索栏，实时搜索文件和文件夹
- 👁️ **文件预览**: 图片/视频/音频/Office/PDF 在线预览
- 🔗 **文件分享**: 生成分享链接，支持密码保护、有效期、下载次数限制
- 📋 **分享管理**: 查看和管理所有已创建的分享链接
- ℹ️ **文件属性**: 查看文件详细信息（大小、创建时间、修改时间等）
- ⭐ **收藏功能**: 收藏常用文件和文件夹，快速访问
- 🗑️ **回收站**: 查看已删除文件（本地记录），支持恢复和永久删除（保留30天）
- 🏷️ **标签系统**: 自定义标签，为文件添加标签，按标签筛选文件

### 界面功能
- 🌓 **主题切换**: 深色/浅色主题，跟随系统
- 📊 **多视图**: 列表视图 / 网格视图 切换
- 🖱️ **右键菜单**: 文件操作上下文菜单
- 📱 **响应式设计**: 支持桌面端和移动端

### 用户权限
- 👑 **超级管理员**: 完全控制所有文件和用户
- 👥 **协作者**: 指定文件夹的增删改查权限
- 📖 **顾客**: 查看和下载指定文件夹
- 👤 **访客**: 仅能访问公开分享的内容

### 管理功能
- 👤 **用户管理**: 添加、禁用、删除用户
- ⚙️ **设置页面**: OneDrive 连接状态、主题切换

### 待实现功能
- 🔐 两步验证 (TOTP)
- 🛡️ IP 白名单
- 📊 访问日志查看


## 🏗️ 技术架构

```
┌─────────────────────────────────────────────────────────┐
│                    用户浏览器                            │
│              React + Tailwind 前端                       │
└─────────────────────┬───────────────────────────────────┘
                      │ HTTPS
┌─────────────────────▼───────────────────────────────────┐
│              Cloudflare Pages (前端托管)                 │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│              Cloudflare Workers (API 后端)               │
│  • 用户认证       • 文件操作                             │
│  • 权限验证       • 分享管理                             │
└─────────────────────┬───────────────────────────────────┘
                      │ Microsoft Graph API
┌─────────────────────▼───────────────────────────────────┐
│                   OneDrive                               │
│            (Microsoft 365 E3 存储)                       │
└─────────────────────────────────────────────────────────┘
```

## 📂 项目结构

```
cfdrive/
├── packages/
│   ├── web/                    # React 前端应用
│   │   ├── src/
│   │   │   ├── components/     # UI 组件
│   │   │   │   ├── files/      # 文件相关组件
│   │   │   │   └── layout/     # 布局组件
│   │   │   ├── pages/          # 页面组件
│   │   │   ├── stores/         # Zustand 状态管理
│   │   │   ├── services/       # API 服务
│   │   │   └── utils/          # 工具函数
│   │   └── ...
│   │
│   └── worker/                 # Cloudflare Workers 后端
│       ├── src/
│       │   ├── handlers/       # API 处理器
│       │   ├── middleware/     # 中间件
│       │   ├── services/       # 业务服务 (OneDrive)
│       │   └── types/          # 类型定义
│       └── migrations/         # D1 数据库迁移
│
├── doc/                        # 项目文档
└── README.md
```

## 🚀 快速开始

### 前置条件

- Node.js 18+
- npm 9+
- Cloudflare 账户
- Microsoft Azure AD 应用 (用于 OneDrive API)

### 安装

```bash
# 克隆项目
git clone <repository-url>
cd cfdrive

# 安装依赖
npm install

# 配置环境变量
cp packages/worker/.dev.vars.example packages/worker/.dev.vars
# 编辑 .dev.vars 填入 Azure AD 配置

# 初始化本地数据库
cd packages/worker
npx wrangler d1 execute cfdrive-db --file=./migrations/0001_initial_schema.sql --local
cd ../..

# 启动开发服务器
npm run dev
```

### 环境变量

在 `packages/worker/.dev.vars` 中配置：

```env
# Microsoft Azure AD
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
AZURE_TENANT_ID=common

# 应用配置
APP_URL=http://localhost:5173
JWT_SECRET=your-jwt-secret-key
NODE_ENV=development
```

### Azure AD 应用配置

1. 访问 [Azure Portal](https://portal.azure.com)
2. 搜索 "Microsoft Entra ID" (原 Azure AD)
3. 创建新的应用注册
4. 添加重定向 URI: `http://localhost:5173/api/oauth/callback`
5. 添加 API 权限:
   - `Files.Read`
   - `Files.Read.All`
   - `Files.ReadWrite`
   - `Files.ReadWrite.All`
   - `offline_access`
   - `User.Read`
6. 创建客户端密钥，复制到 `.dev.vars`

## 📖 开发服务地址

启动开发服务器后：
- **前端**: http://localhost:5173
- **后端 API**: http://127.0.0.1:8787

首次访问会跳转到设置页面，创建超级管理员账户。

## 📚 功能使用

### 🏷️ 标签系统

标签功能让您可以用自定义标签组织文件，快速分类和查找。

#### 快速开始

1. **访问标签管理**
   - 点击左侧边栏的 **"标签"** 菜单（🏷️ 图标）
   - 或访问 `http://localhost:5173/tags`

2. **创建标签**
   ```
   点击"创建标签" → 输入名称 → 选择颜色 → 创建
   ```

3. **管理标签**
   - ✏️ 编辑：修改标签名称或颜色
   - 🗑️ 删除：移除标签（会从所有文件中移除）
   - 📊 统计：查看每个标签使用的文件数量

#### 使用场景示例

**项目管理**
```
📘 项目A（蓝色）、🟩 项目B（绿色）、🟧 项目C（橙色）
为不同项目的文件打标签，快速筛选项目相关文件
```

**优先级管理**
```
🔴 紧急（红色）、🟠 重要（橙色）、🟢 已完成（绿色）
标记文件的优先级和处理状态
```

**文件分类**
```
📄 文档（蓝色）、📊 表格（绿色）、📈 报告（紫色）
按内容类型组织文件
```

#### 可用颜色
- 🔵 蓝色 - 默认、常规分类
- 🟢 绿色 - 完成、成功
- 🟠 橙色 - 待办、提醒
- 🔴 红色 - 紧急、重要
- 🟣 紫色 - 特殊、收藏
- 🌸 粉色 - 个人、创意
- 🟦 靛蓝 - 项目分类
- 🟩 青色 - 进行中

#### 最佳实践
- ✅ 保持标签简洁（建议 10-20 个）
- ✅ 使用清晰的命名（如："工作"、"重要"）
- ✅ 用颜色区分标签类别
- ✅ 定期清理不再使用的标签

> 📖 详细使用指南请查看 [TAGS_GUIDE.md](./TAGS_GUIDE.md)

### ⭐ 收藏功能

快速访问常用文件和文件夹：
- 在文件列表中点击星标图标收藏
- 访问"收藏"页面查看所有收藏项
- 支持文件和文件夹收藏

### 🗑️ 回收站

安全管理已删除的文件：
- 删除的文件保留 30 天
- 支持单个或批量恢复
- 支持永久删除
- 查看删除时间和原始位置

### 🔗 分享管理

创建和管理文件分享链接：
- 生成分享链接（支持密码保护）
- 设置过期时间
- 查看分享统计
- 随时撤销分享

## 🛠️ 开发命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动前端和后端开发服务器 |
| `npm run dev:web` | 仅启动前端开发服务器 |
| `npm run dev:worker` | 仅启动后端开发服务器 |
| `npm run build` | 构建生产版本 |
| `npm run build:web` | 构建前端 |
| `npm run build:worker` | 构建后端 |

## 🔧 部署

### 部署到 Cloudflare

```bash
# 部署 Worker
cd packages/worker
npx wrangler deploy

# 部署前端到 Pages
cd ../web
npm run build
# 然后在 Cloudflare Dashboard 中配置 Pages，指向 dist 目录
```

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！
