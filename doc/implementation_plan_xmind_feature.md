# XMind 文件预览与编辑功能

## Context

用户希望在 cfdrive 网盘中支持预览和编辑 `.xmind` 文件。参考项目 `cxmind` 中已有成熟的 XMind 解析、渲染、编辑实现，基于 `jszip`（解压 xmind ZIP 文件）+ `simple-mind-map`（思维导图渲染库）。需要将相关功能移植到 cfdrive 中。

## 实现方案

### 1. 安装依赖
**文件:** `packages/web/package.json`

新增依赖：
- `jszip` ^3.10.1 — 解析 xmind ZIP 包
- `simple-mind-map` ^0.10.2 — 思维导图渲染与交互

### 2. 移植 XMind 解析器
**新建文件:** `packages/web/src/utils/xmindParser.ts`

从 cxmind 移植并转为 TypeScript：
- `parseXMind(arrayBuffer)` — 主入口，支持新格式(JSON)和旧格式(XML)
- `transformToSimpleMindMap(topic)` — 转换为 simple-mind-map 数据格式
- `repackXMind(originalBuffer, mindMapData, sheetIndex)` — 将编辑后数据回写 xmind
- `getSheetData(parsedData, sheetIndex)` — 获取指定画布数据
- `exportToMarkdown(data)` — 导出 Markdown
- 内部辅助函数保持不变

### 3. 创建 XMindViewer 组件
**新建文件:** `packages/web/src/components/files/XMindViewer.tsx`

基于 cxmind 的 MindMapViewer 简化移植，保留核心功能：

**Props:**
```typescript
interface XMindViewerProps {
    item: DriveItem;        // 当前文件信息
    onClose: () => void;    // 关闭回调
}
```

**核心功能（保留）：**
- 只读预览模式（默认）
- 编辑模式切换（`setMode('edit'|'readonly')`）
- 主题切换（8 种主题配色）
- 布局切换（逻辑图、组织结构、鱼骨图等 6 种）
- 多画布(Sheet)支持 — 底部 tab 切换
- 保存 — `getData() → repackXMind() → PUT 更新文件`
- 导出 PNG/SVG
- 缩放与适应屏幕

**数据流：**
1. `fileService.getDownloadUrl(item.id)` → 获取 OneDrive 下载链接
2. `fetch(downloadUrl)` → 获取 ArrayBuffer
3. `parseXMind(arrayBuffer)` → 解析为 simple-mind-map 格式
4. `new MindMap({el, data, ...})` → 渲染思维导图
5. 编辑保存：`getData() → repackXMind() → fileService.updateContent(item.id, buffer)`

**简化（不移植）：**
- 图标选择器（节点图标功能复杂，暂不需要）
- 搜索功能（Ctrl+F）
- 节点图片粘贴
- 创建新 xmind 文件
- 复杂的右键上下文菜单（仅保留基础操作）

### 4. 后端：新增文件内容更新接口
**文件:** `packages/worker/src/handlers/files.ts`

新增 `PUT /api/files/:id/content` 端点：
- 接收 ArrayBuffer 请求体
- 调用 Graph API `PUT /drive/items/{id}/content` 上传内容
- 用于 xmind 编辑后保存

**文件:** `packages/worker/src/services/onedrive.ts`

新增 `updateFileContent(itemId, buffer)` 方法：
- 调用 Graph API 上传接口更新文件内容

### 5. 前端 API 新增
**文件:** `packages/web/src/services/api.ts`

`fileService` 新增：
- `updateContent(itemId: string, buffer: ArrayBuffer)` — 上传更新文件内容

### 6. 集成到 FilePreview
**文件:** `packages/web/src/components/files/FilePreview.tsx`

- `getFileType()` 添加 xmind 类型检测：`if (ext === 'xmind') return 'xmind'`
- `previewType` 类型扩展：加入 `'xmind'`
- `renderPreview()` switch 新增 `case 'xmind'`：渲染 `<XMindViewer item={item} onClose={onClose} />`
- xmind 预览时隐藏 FilePreview 自带的顶部工具栏和导航按钮（XMindViewer 自带工具栏）

### 7. 添加思维导图相关 CSS
**文件:** `packages/web/src/index.css`

添加 simple-mind-map 编辑态所需的 contenteditable 样式覆盖。

## 关键文件清单

| 文件 | 操作 | 说明 |
|-----|------|------|
| `packages/web/package.json` | 修改 | 添加 jszip、simple-mind-map 依赖 |
| `packages/web/src/utils/xmindParser.ts` | 新建 | XMind 解析器（从 cxmind 移植转 TS） |
| `packages/web/src/components/files/XMindViewer.tsx` | 新建 | 思维导图查看/编辑组件 |
| `packages/web/src/components/files/FilePreview.tsx` | 修改 | 添加 xmind 类型和渲染分支 |
| `packages/web/src/services/api.ts` | 修改 | 添加 updateContent API |
| `packages/web/src/index.css` | 修改 | 添加思维导图编辑样式 |
| `packages/worker/src/handlers/files.ts` | 修改 | 添加 PUT content 端点 |
| `packages/worker/src/services/onedrive.ts` | 修改 | 添加 updateFileContent 方法 |

## 验证方法

1. 启动 `npm run dev`
2. 上传一个 `.xmind` 文件到网盘
3. 点击该文件，应打开全屏思维导图预览
4. 验证只读模式下可正常查看、缩放、切换画布
5. 点击"编辑"按钮进入编辑模式，修改节点文字
6. 点击"保存"，验证文件已更新
7. 刷新页面重新打开，确认修改已持久化
