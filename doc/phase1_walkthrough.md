# CFDrive 开发进度报告

## 项目概述
CFDrive 是一个基于 Cloudflare 生态系统的企业级网盘应用，使用 OneDrive 作为存储后端。

## 技术栈
- **后端**: Cloudflare Workers + Hono.js
- **前端**: React + Vite + Tailwind CSS
- **数据库**: Cloudflare D1 (SQLite)
- **缓存**: Cloudflare KV
- **存储**: OneDrive (通过 Microsoft Graph API)

---

## ✅ 已完成功能

### 后端 API (Worker)

| 模块 | 功能 | 状态 |
|-----|------|-----|
| **认证系统** | 登录/登出、JWT Token、会话管理 | ✅ |
| **初始设置** | 创建首个超级管理员 | ✅ |
| **OAuth** | Azure AD 授权连接 OneDrive | ✅ |
| **用户管理** | CRUD、角色分配、权限设置 | ✅ |
| **文件列表** | 获取文件夹内容 | ✅ |
| **文件操作** | 创建/重命名/删除/复制/移动 | ✅ |
| **文件下载** | 获取下载链接 | ✅ |
| **文件上传** | 小文件 + 大文件分片上传 | ✅ |
| **文件搜索** | 按关键词搜索 | ✅ |
| **文件预览** | Office 在线预览 URL | ✅ |
| **缩略图** | 获取图片缩略图 | ✅ |
| **版本历史** | 获取文件历史版本 | ✅ |
| **分享系统** | 创建分享链接、密码保护 | ✅ |
| **访问日志** | 记录用户操作 | ✅ |
| **存储配额** | 获取 OneDrive 存储空间使用情况 | ✅ |

### 前端界面 (Web)

| 模块 | 功能 | 状态 |
|-----|------|-----|
| **登录页** | 用户登录界面 | ✅ |
| **初始设置页** | 创建管理员账户 | ✅ |
| **主布局** | 侧边栏 + 顶部导航 | ✅ |
| **搜索功能** | 实时搜索文件 + 结果导航 | ✅ |
| **文件浏览器** | 列表视图 + 小图视图 + 网格视图 | ✅ |
| **右键菜单** | 文件操作上下文菜单 + 多选支持 | ✅ |
| **文件上传** | 拖拽上传 + 进度显示 | ✅ |
| **文件预览** | 图片/视频/音频/Office/PDF预览 | ✅ |
| **重命名弹窗** | 文件/文件夹重命名 | ✅ |
| **删除确认** | 删除确认弹窗 | ✅ |
| **新建文件夹** | 新建文件夹弹窗 | ✅ |
| **移动/复制** | 选择目标文件夹对话框 | ✅ |
| **分享弹窗** | 创建分享链接 + 设置选项 | ✅ |
| **属性弹窗** | 查看文件详细信息 | ✅ |
| **分享页面** | 公开分享访问 + 密码验证 | ✅ |
| **分享管理** | 查看和管理我的分享链接 | ✅ |
| **设置页面** | OneDrive 连接 + 主题切换 | ✅ |
| **用户管理** | 用户列表 + 添加/删除用户 | ✅ |
| **深色模式** | 主题切换 | ✅ |
| **多选操作** | 批量文件选择 + 批量删除/移动/复制 | ✅ |
| **排序功能** | 按名称/时间/大小/类型排序，点击列头切换 | ✅ |
| **小图视图** | 列表中显示文件缩略图预览 | ✅ |
| **存储空间** | 侧边栏实时显示 OneDrive 配额使用情况 | ✅ |

### 前端组件

| 组件 | 文件 | 说明 |
|-----|------|-----|
| FileList | `components/files/FileList.tsx` | 文件列表视图 |
| FileGrid | `components/files/FileGrid.tsx` | 文件网格视图 |
| FileUpload | `components/files/FileUpload.tsx` | 文件上传组件 |
| FilePreview | `components/files/FilePreview.tsx` | 文件预览组件 |
| ContextMenu | `components/files/ContextMenu.tsx` | 右键菜单 |
| RenameModal | `components/files/RenameModal.tsx` | 重命名弹窗 |
| DeleteModal | `components/files/DeleteModal.tsx` | 删除确认弹窗 |
| NewFolderModal | `components/files/NewFolderModal.tsx` | 新建文件夹弹窗 |
| MoveCopyModal | `components/files/MoveCopyModal.tsx` | 移动/复制对话框 |
| ShareModal | `components/files/ShareModal.tsx` | 分享弹窗 |
| FileInfoModal | `components/files/FileInfoModal.tsx` | 文件属性弹窗 |
| SortDropdown | `components/files/SortDropdown.tsx` | 排序下拉菜单 |
| BatchActionsBar | `components/files/BatchActionsBar.tsx` | 批量操作工具栏 |
| SearchBar | `components/layout/SearchBar.tsx` | 搜索栏 |
| Header | `components/layout/Header.tsx` | 顶部导航 |
| Sidebar | `components/layout/Sidebar.tsx` | 侧边栏 |
| Breadcrumb | `components/layout/Breadcrumb.tsx` | 面包屑导航 |

### 数据库表

| 表名 | 用途 | 状态 |
|-----|------|-----|
| `system_config` | 系统配置 | ✅ |
| `users` | 用户账户 | ✅ |
| `sessions` | 会话管理 | ✅ |
| `folder_permissions` | 文件夹权限 | ✅ |
| `shares` | 分享链接 | ✅ |
| `access_logs` | 访问日志 | ✅ |
| `favorites` | 收藏 | ✅ |
| `tags` / `file_tags` | 标签系统 | ✅ |
| `ip_whitelist` | IP 白名单 | ✅ |
| `two_factor_auth` | 两步验证 | ✅ |

---

## 🔧 配置说明

### 环境变量 (.dev.vars)

```
# Azure AD 配置
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
AZURE_TENANT_ID=common

# 应用配置
JWT_SECRET=your-jwt-secret-key
APP_URL=http://localhost:5173
NODE_ENV=development
```

### Azure AD 应用注册

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
6. 创建客户端密钥

---

## 🚀 运行项目

```bash
# 安装依赖
npm install

# 初始化数据库
cd packages/worker
npx wrangler d1 execute cfdrive-db --file=./migrations/0001_initial_schema.sql --local

# 启动开发服务器
cd ../..
npm run dev
```

访问:
- 前端: http://localhost:5173
- 后端 API: http://127.0.0.1:8787

---

## 📋 待完成功能

| 功能 | 优先级 | 说明 |
|-----|-------|-----|
| 两步验证 | 低 | TOTP 认证 |
| 通知系统 | 低 | 操作提醒 |
| 文件评论 | 低 | 协作评论功能 |

---

## 📁 项目结构

```
cfdrive/
├── packages/
│   ├── worker/              # Cloudflare Worker 后端
│   │   ├── src/
│   │   │   ├── handlers/    # API 处理器
│   │   │   ├── middleware/  # 中间件
│   │   │   ├── services/    # 业务服务
│   │   │   ├── types/       # 类型定义
│   │   │   └── utils/       # 工具函数
│   │   ├── migrations/      # 数据库迁移
│   │   └── wrangler.toml    # Wrangler 配置
│   │
│   └── web/                 # React 前端
│       └── src/
│           ├── components/  # UI 组件
│           │   ├── files/   # 文件相关组件
│           │   └── layout/  # 布局组件
│           ├── pages/       # 页面组件
│           ├── stores/      # Zustand 状态
│           ├── services/    # API 服务
│           ├── styles/      # CSS 样式
│           └── utils/       # 工具函数
│
├── doc/                     # 项目文档
└── package.json            # 根配置
```

---

*最后更新: 2026-02-26*
