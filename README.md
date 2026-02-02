# CFDrive - 基于 Cloudflare 的云盘应用

> 基于 Cloudflare Workers & Pages 的现代云盘应用，后端使用 OneDrive (Microsoft Graph API) 存储

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare)](https://workers.cloudflare.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)

## ✨ 功能特性

### 核心功能
- 📁 文件夹创建、删除、重命名
- 📄 文件上传、下载、复制、移动、删除
- 🔍 文件搜索和排序
- 👁️ 多格式文件预览 (Office/PDF/图片/视频/音频/代码)
- 🔗 文件分享 (支持密码保护和有效期设置)

### 用户权限
- 👑 **超级管理员**: 完全控制所有文件和用户
- 👥 **协作者**: 指定文件夹的增删改查权限
- 📖 **顾客**: 查看和下载指定文件夹
- 👤 **访客**: 仅能访问公开分享的内容

### 高级特性
- 🌓 深色/浅色主题切换
- 📱 响应式设计，支持移动端
- 🏷️ 文件标签和收藏
- 🗑️ 回收站功能
- 📊 访问日志记录
- 🔐 两步验证 (TOTP)
- 🛡️ IP 白名单

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
│   │   │   ├── pages/          # 页面组件
│   │   │   ├── hooks/          # 自定义 Hooks
│   │   │   ├── stores/         # Zustand 状态
│   │   │   └── services/       # API 服务
│   │   └── ...
│   │
│   └── worker/                 # Cloudflare Workers 后端
│       ├── src/
│       │   ├── handlers/       # API 处理器
│       │   ├── middleware/     # 中间件
│       │   ├── services/       # 业务服务
│       │   └── ...
│       └── migrations/         # D1 数据库迁移
│
├── doc/                        # 项目文档
├── .wrangler/                  # Wrangler 本地数据 (git ignored)
└── README.md
```

## 🚀 快速开始

### 前置条件

- Node.js 18+
- pnpm 8+
- Cloudflare 账户
- Microsoft Azure AD 应用 (用于 OneDrive API)

### 安装

```bash
# 克隆项目
git clone <repository-url>
cd cfdrive

# 安装依赖
pnpm install

# 配置环境变量
cp packages/worker/.dev.vars.example packages/worker/.dev.vars
# 编辑 .dev.vars 填入 Azure AD 配置

# 初始化本地数据库
pnpm db:migrate

# 启动开发服务器
pnpm dev
```

### 环境变量

在 `packages/worker/.dev.vars` 中配置：

```env
# Microsoft Azure AD
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
AZURE_TENANT_ID=your-tenant-id

# 应用配置
APP_URL=http://localhost:5173
JWT_SECRET=your-jwt-secret
```

## 📖 文档

- [实现计划](./doc/implementation_plan.md) - 详细的技术设计和实现计划
- [数据库设计](./doc/implementation_plan.md#数据库设计-cloudflare-d1) - D1 数据库表结构
- [API 文档](./doc/api.md) - API 接口说明 (待完善)

## 🛠️ 开发命令

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动前端和后端开发服务器 |
| `pnpm dev:web` | 仅启动前端开发服务器 |
| `pnpm dev:worker` | 仅启动后端开发服务器 |
| `pnpm build` | 构建生产版本 |
| `pnpm test` | 运行测试 |
| `pnpm db:migrate` | 应用数据库迁移 |
| `pnpm db:reset` | 重置本地数据库 |

## 🔧 部署

### 部署到 Cloudflare

```bash
# 部署 Worker
pnpm --filter @cfdrive/worker deploy

# 部署前端到 Pages
pnpm --filter @cfdrive/web build
# 然后在 Cloudflare Dashboard 中配置 Pages
```

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！
