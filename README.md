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
- 👁️ **文件预览**: 图片/视频/音频/Office/PDF/XMind 在线预览
- 🧠 **XMind 思维导图**: 在线预览和编辑 XMind 文件，支持主题/布局切换、多画布、导出为 PNG/SVG/Markdown
- 🔗 **文件分享**: 生成分享链接，支持密码保护、有效期、下载次数限制
- 📋 **分享管理**: 查看和管理所有已创建的分享链接
- ℹ️ **文件属性**: 查看文件详细信息（大小、创建时间、修改时间等）
- ⭐ **收藏功能**: 收藏常用文件和文件夹，快速访问
- 🗑️ **回收站**: 查看已删除文件（本地记录），支持恢复和永久删除（保留30天）
- 🏷️ **标签系统**: 自定义标签，为文件添加标签，按标签筛选文件
- ✅ **多选操作**: 支持批量选择文件，批量删除/移动/复制操作
- 🔀 **文件排序**: 按名称、修改时间、大小、类型排序，支持升序/降序

### 界面功能
- 🌓 **主题切换**: 深色/浅色主题，跟随系统
- 📊 **多视图**: 列表视图 / 小图视图 / 网格视图 三种切换
- 🖼️ **小图模式**: 文件名前显示缩略图预览，快速识别文件内容
- 🖱️ **右键菜单**: 文件操作上下文菜单，支持多选操作
- 📱 **响应式设计**: 支持桌面端和移动端
- 💾 **存储空间**: 侧边栏实时显示 OneDrive 存储空间使用情况
- 🔃 **列头排序**: 点击列标题即可切换排序字段和方向

### 用户权限
- 👑 **超级管理员**: 完全控制所有文件和用户
- 👥 **协作者**: 指定文件夹的增删改查权限
- 📖 **顾客**: 查看和下载指定文件夹
- 👤 **访客**: 仅能访问公开分享的内容

### 管理功能
- 👤 **用户管理**: 添加、禁用、删除用户
- ⚙️ **设置页面**: Azure AD 配置、OneDrive 连接管理、主题切换
- 📊 **访问日志**: 查看用户操作历史，支持筛选和统计
- 🛡️ **IP 白名单**: 限制允许访问的 IP 地址


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
│   │   │   │   ├── files/      # 文件相关组件（含 XMindViewer）
│   │   │   │   └── layout/     # 布局组件
│   │   │   ├── pages/          # 页面组件
│   │   │   ├── stores/         # Zustand 状态管理
│   │   │   ├── services/       # API 服务
│   │   │   └── utils/          # 工具函数（含 xmindParser）
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
# 编辑 .dev.vars 填入 JWT_SECRET 和 APP_URL

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
# 应用配置
APP_URL=http://localhost:5173
JWT_SECRET=your-jwt-secret-key
NODE_ENV=development
```

> **注意**: Azure AD 配置已迁移到系统设置页面管理，无需在环境变量中配置。如需通过环境变量配置（如 CI/CD 场景），仍可在 `.dev.vars` 或 Cloudflare 环境变量中设置 `AZURE_CLIENT_ID`、`AZURE_CLIENT_SECRET`、`AZURE_TENANT_ID`，系统会优先使用数据库中的配置，环境变量作为回退。

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
6. 创建客户端密钥，记录 Client ID、Client Secret 和 Tenant ID

### 配置 Azure AD 凭据

有两种方式配置 Azure AD 凭据：

**方式一：通过系统设置页面配置（推荐）**

1. 启动应用并登录超级管理员账户
2. 进入 **设置** 页面
3. 在 **Azure AD 配置** 区域填写 Client ID、Client Secret、Tenant ID
4. 点击 **保存配置**
5. 回到 **我的网盘** 页面，点击 **连接 OneDrive**

**方式二：通过环境变量配置**

在 `packages/worker/.dev.vars` 中添加：

```env
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
AZURE_TENANT_ID=your-tenant-id
```

> 系统优先读取数据库中的配置（方式一），如果数据库中未配置则回退到环境变量（方式二）。

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

### 🧠 XMind 思维导图

在线预览和编辑 `.xmind` 文件，无需安装 XMind 客户端：

- **预览模式**: 点击 xmind 文件即可全屏查看思维导图
- **编辑模式**: 点击"编辑"按钮进入编辑，双击节点修改文字，支持添加/删除节点
- **主题切换**: 8 种配色主题（默认、清爽、蓝调、绿色、紫色、橙色、红色、黑白）
- **布局切换**: 4 种布局方式（逻辑图、组织结构图、鱼骨图、时间线）
- **多画布**: 支持 xmind 多 Sheet 切换
- **保存**: 编辑后保存回 OneDrive（Ctrl+S 快捷键）
- **导出**: 支持导出为 PNG、SVG、JSON、Markdown 格式
- **缩放**: 滚轮缩放，适应屏幕按钮

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
