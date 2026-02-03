import { Hono } from 'hono';
import type { Env, User, DriveItem } from '../types';
import { OneDriveService } from '../services/onedrive';
import { checkPathPermission } from '../middleware/permission';
import { generateId } from '../utils';

const files = new Hono<{ Bindings: Env }>();

/**
 * 获取 OneDrive 服务实例
 */
function getOneDriveService(env: Env): OneDriveService {
    return new OneDriveService(env);
}

/**
 * 记录访问日志
 */
async function logAccess(
    db: D1Database,
    userId: string | null,
    action: string,
    resourceType: 'file' | 'folder',
    resourceId: string,
    resourcePath: string | null,
    request: Request,
    details?: Record<string, unknown>
) {
    try {
        const id = generateId();
        const ipAddress =
            request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || null;
        const userAgent = request.headers.get('User-Agent') || null;

        await db
            .prepare(
                `INSERT INTO access_logs (id, user_id, action, resource_type, resource_id, resource_path, ip_address, user_agent, details, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
                id,
                userId,
                action,
                resourceType,
                resourceId,
                resourcePath,
                ipAddress,
                userAgent,
                details ? JSON.stringify(details) : null,
                new Date().toISOString()
            )
            .run();
    } catch (error) {
        console.error('Failed to log access:', error);
    }
}

/**
 * 列出文件夹内容
 * GET /api/files
 */
files.get('/', async (c) => {
    try {
        const user = c.get('user') as User;
        const folderId = c.req.query('folderId') || 'root';
        const top = parseInt(c.req.query('top') || '50');
        const skip = parseInt(c.req.query('skip') || '0');
        const orderby = c.req.query('orderby') || 'name asc';

        // 权限检查
        if (user.role !== 'superadmin') {
            const permCheck = await checkPathPermission(user, folderId, 'read', c.env.DB);
            if (!permCheck.allowed) {
                return c.json(
                    {
                        success: false,
                        error: { code: 'FORBIDDEN', message: permCheck.reason || '权限不足' },
                    },
                    403
                );
            }
        }

        const onedrive = getOneDriveService(c.env);
        const result = await onedrive.listFolder(folderId, { top, skip, orderby });

        // 记录访问日志
        await logAccess(c.env.DB, user.id, 'list', 'folder', folderId, null, c.req.raw);

        return c.json({
            success: true,
            data: {
                items: result.items,
                hasMore: !!result.nextLink,
            },
        });
    } catch (error) {
        console.error('List files error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'LIST_ERROR', message: '获取文件列表失败' },
            },
            500
        );
    }
});

/**
 * 获取文件/文件夹详情
 * GET /api/files/:id
 */
files.get('/:id', async (c) => {
    try {
        const user = c.get('user') as User;
        const itemId = c.req.param('id');

        const onedrive = getOneDriveService(c.env);
        const item = await onedrive.getItem(itemId);

        // 记录访问日志
        await logAccess(
            c.env.DB,
            user.id,
            'view',
            item.folder ? 'folder' : 'file',
            itemId,
            item.name,
            c.req.raw
        );

        return c.json({
            success: true,
            data: item,
        });
    } catch (error) {
        console.error('Get file error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'GET_ERROR', message: '获取文件信息失败' },
            },
            500
        );
    }
});

/**
 * 创建文件夹
 * POST /api/files/folder
 */
files.post('/folder', async (c) => {
    try {
        const user = c.get('user') as User;
        const body = await c.req.json<{
            parentId: string;
            name: string;
        }>();

        if (!body.name) {
            return c.json(
                {
                    success: false,
                    error: { code: 'INVALID_INPUT', message: '文件夹名称为必填项' },
                },
                400
            );
        }

        // 权限检查
        if (user.role !== 'superadmin') {
            const permCheck = await checkPathPermission(user, body.parentId || 'root', 'create', c.env.DB);
            if (!permCheck.allowed) {
                return c.json(
                    {
                        success: false,
                        error: { code: 'FORBIDDEN', message: permCheck.reason || '权限不足' },
                    },
                    403
                );
            }
        }

        const onedrive = getOneDriveService(c.env);
        const folder = await onedrive.createFolder(body.parentId || 'root', body.name);

        // 记录访问日志
        await logAccess(c.env.DB, user.id, 'create', 'folder', folder.id, folder.name, c.req.raw);

        return c.json({
            success: true,
            data: folder,
        });
    } catch (error) {
        console.error('Create folder error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'CREATE_ERROR', message: '创建文件夹失败' },
            },
            500
        );
    }
});

/**
 * 重命名文件/文件夹
 * PUT /api/files/:id/rename
 */
files.put('/:id/rename', async (c) => {
    try {
        const user = c.get('user') as User;
        const itemId = c.req.param('id');
        const body = await c.req.json<{ name: string }>();

        if (!body.name) {
            return c.json(
                {
                    success: false,
                    error: { code: 'INVALID_INPUT', message: '新名称为必填项' },
                },
                400
            );
        }

        // 权限检查
        if (user.role !== 'superadmin') {
            const permCheck = await checkPathPermission(user, itemId, 'update', c.env.DB);
            if (!permCheck.allowed) {
                return c.json(
                    {
                        success: false,
                        error: { code: 'FORBIDDEN', message: permCheck.reason || '权限不足' },
                    },
                    403
                );
            }
        }

        const onedrive = getOneDriveService(c.env);
        const item = await onedrive.renameItem(itemId, body.name);

        // 记录访问日志
        await logAccess(
            c.env.DB,
            user.id,
            'rename',
            item.folder ? 'folder' : 'file',
            itemId,
            item.name,
            c.req.raw,
            { newName: body.name }
        );

        return c.json({
            success: true,
            data: item,
        });
    } catch (error) {
        console.error('Rename error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'RENAME_ERROR', message: '重命名失败' },
            },
            500
        );
    }
});

/**
 * 删除文件/文件夹
 * DELETE /api/files/:id
 */
files.delete('/:id', async (c) => {
    try {
        const user = c.get('user') as User;
        const itemId = c.req.param('id');

        // 权限检查
        if (user.role !== 'superadmin') {
            const permCheck = await checkPathPermission(user, itemId, 'delete', c.env.DB);
            if (!permCheck.allowed) {
                return c.json(
                    {
                        success: false,
                        error: { code: 'FORBIDDEN', message: permCheck.reason || '权限不足' },
                    },
                    403
                );
            }
        }

        const onedrive = getOneDriveService(c.env);

        // 先获取项目信息用于日志
        let itemInfo: DriveItem | null = null;
        try {
            itemInfo = await onedrive.getItem(itemId);
        } catch {
            // 忽略错误
        }

        await onedrive.deleteItem(itemId);

        // 记录访问日志
        await logAccess(
            c.env.DB,
            user.id,
            'delete',
            itemInfo?.folder ? 'folder' : 'file',
            itemId,
            itemInfo?.name || null,
            c.req.raw
        );

        return c.json({
            success: true,
            data: { message: '删除成功' },
        });
    } catch (error) {
        console.error('Delete error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'DELETE_ERROR', message: '删除失败' },
            },
            500
        );
    }
});

/**
 * 复制文件/文件夹
 * POST /api/files/:id/copy
 */
files.post('/:id/copy', async (c) => {
    try {
        const user = c.get('user') as User;
        const itemId = c.req.param('id');
        const body = await c.req.json<{
            targetParentId: string;
            newName?: string;
        }>();

        if (!body.targetParentId) {
            return c.json(
                {
                    success: false,
                    error: { code: 'INVALID_INPUT', message: '目标文件夹为必填项' },
                },
                400
            );
        }

        // 权限检查 - 需要源文件夹的读权限和目标文件夹的创建权限
        if (user.role !== 'superadmin') {
            const sourceCheck = await checkPathPermission(user, itemId, 'read', c.env.DB);
            if (!sourceCheck.allowed) {
                return c.json(
                    {
                        success: false,
                        error: { code: 'FORBIDDEN', message: '没有源文件的读取权限' },
                    },
                    403
                );
            }

            const targetCheck = await checkPathPermission(user, body.targetParentId, 'create', c.env.DB);
            if (!targetCheck.allowed) {
                return c.json(
                    {
                        success: false,
                        error: { code: 'FORBIDDEN', message: '没有目标文件夹的写入权限' },
                    },
                    403
                );
            }
        }

        const onedrive = getOneDriveService(c.env);
        const result = await onedrive.copyItem(itemId, body.targetParentId, body.newName);

        // 记录访问日志
        await logAccess(c.env.DB, user.id, 'copy', 'file', itemId, null, c.req.raw, {
            targetParentId: body.targetParentId,
            newName: body.newName,
        });

        return c.json({
            success: true,
            data: {
                message: '复制操作已开始',
                monitorUrl: result.monitorUrl,
            },
        });
    } catch (error) {
        console.error('Copy error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'COPY_ERROR', message: '复制失败' },
            },
            500
        );
    }
});

/**
 * 移动文件/文件夹
 * POST /api/files/:id/move
 */
files.post('/:id/move', async (c) => {
    try {
        const user = c.get('user') as User;
        const itemId = c.req.param('id');
        const body = await c.req.json<{
            targetParentId: string;
            newName?: string;
        }>();

        if (!body.targetParentId) {
            return c.json(
                {
                    success: false,
                    error: { code: 'INVALID_INPUT', message: '目标文件夹为必填项' },
                },
                400
            );
        }

        // 权限检查 - 需要源位置的删除权限和目标位置的创建权限
        if (user.role !== 'superadmin') {
            const sourceCheck = await checkPathPermission(user, itemId, 'delete', c.env.DB);
            if (!sourceCheck.allowed) {
                return c.json(
                    {
                        success: false,
                        error: { code: 'FORBIDDEN', message: '没有源文件的修改权限' },
                    },
                    403
                );
            }

            const targetCheck = await checkPathPermission(user, body.targetParentId, 'create', c.env.DB);
            if (!targetCheck.allowed) {
                return c.json(
                    {
                        success: false,
                        error: { code: 'FORBIDDEN', message: '没有目标文件夹的写入权限' },
                    },
                    403
                );
            }
        }

        const onedrive = getOneDriveService(c.env);
        const item = await onedrive.moveItem(itemId, body.targetParentId, body.newName);

        // 记录访问日志
        await logAccess(
            c.env.DB,
            user.id,
            'move',
            item.folder ? 'folder' : 'file',
            itemId,
            item.name,
            c.req.raw,
            { targetParentId: body.targetParentId }
        );

        return c.json({
            success: true,
            data: item,
        });
    } catch (error) {
        console.error('Move error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'MOVE_ERROR', message: '移动失败' },
            },
            500
        );
    }
});

/**
 * 获取文件下载链接
 * GET /api/files/:id/download
 */
files.get('/:id/download', async (c) => {
    try {
        const user = c.get('user') as User;
        const itemId = c.req.param('id');

        // 权限检查
        if (user.role !== 'superadmin') {
            const permCheck = await checkPathPermission(user, itemId, 'read', c.env.DB);
            if (!permCheck.allowed) {
                return c.json(
                    {
                        success: false,
                        error: { code: 'FORBIDDEN', message: permCheck.reason || '权限不足' },
                    },
                    403
                );
            }
        }

        const onedrive = getOneDriveService(c.env);
        const downloadUrl = await onedrive.getDownloadUrl(itemId);

        // 记录访问日志
        await logAccess(c.env.DB, user.id, 'download', 'file', itemId, null, c.req.raw);

        return c.json({
            success: true,
            data: { downloadUrl },
        });
    } catch (error) {
        console.error('Download error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'DOWNLOAD_ERROR', message: '获取下载链接失败' },
            },
            500
        );
    }
});

/**
 * 搜索文件
 * GET /api/files/search
 */
files.get('/search', async (c) => {
    try {
        const user = c.get('user') as User;
        const query = c.req.query('q');
        const folderId = c.req.query('folderId');

        if (!query) {
            return c.json(
                {
                    success: false,
                    error: { code: 'INVALID_INPUT', message: '搜索关键词为必填项' },
                },
                400
            );
        }

        const onedrive = getOneDriveService(c.env);
        const items = await onedrive.search(query, folderId);

        // 如果不是管理员，需要过滤掉没有权限的文件
        // TODO: 实现更精细的权限过滤

        return c.json({
            success: true,
            data: { items },
        });
    } catch (error) {
        console.error('Search error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'SEARCH_ERROR', message: '搜索失败' },
            },
            500
        );
    }
});

/**
 * 获取文件预览 URL
 * GET /api/files/:id/preview
 */
files.get('/:id/preview', async (c) => {
    try {
        const user = c.get('user') as User;
        const itemId = c.req.param('id');

        // 权限检查
        if (user.role !== 'superadmin') {
            const permCheck = await checkPathPermission(user, itemId, 'read', c.env.DB);
            if (!permCheck.allowed) {
                return c.json(
                    {
                        success: false,
                        error: { code: 'FORBIDDEN', message: permCheck.reason || '权限不足' },
                    },
                    403
                );
            }
        }

        const onedrive = getOneDriveService(c.env);
        const preview = await onedrive.getPreviewUrl(itemId);

        return c.json({
            success: true,
            data: {
                previewUrl: preview.getUrl || preview.postUrl,
                ...preview
            },
        });
    } catch (error) {
        console.error('Preview error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'PREVIEW_ERROR', message: '获取预览链接失败' },
            },
            500
        );
    }
});

/**
 * 获取缩略图
 * GET /api/files/:id/thumbnail
 */
files.get('/:id/thumbnail', async (c) => {
    try {
        const itemId = c.req.param('id');
        const size = (c.req.query('size') || 'medium') as 'small' | 'medium' | 'large';

        const onedrive = getOneDriveService(c.env);
        const thumbnailUrl = await onedrive.getThumbnails(itemId, size);

        if (!thumbnailUrl) {
            return c.json(
                {
                    success: false,
                    error: { code: 'NO_THUMBNAIL', message: '没有缩略图' },
                },
                404
            );
        }

        return c.json({
            success: true,
            data: { url: thumbnailUrl },
        });
    } catch (error) {
        console.error('Thumbnail error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'THUMBNAIL_ERROR', message: '获取缩略图失败' },
            },
            500
        );
    }
});

/**
 * 获取文件版本历史
 * GET /api/files/:id/versions
 */
files.get('/:id/versions', async (c) => {
    try {
        const user = c.get('user') as User;
        const itemId = c.req.param('id');

        // 权限检查
        if (user.role !== 'superadmin') {
            const permCheck = await checkPathPermission(user, itemId, 'read', c.env.DB);
            if (!permCheck.allowed) {
                return c.json(
                    {
                        success: false,
                        error: { code: 'FORBIDDEN', message: permCheck.reason || '权限不足' },
                    },
                    403
                );
            }
        }

        const onedrive = getOneDriveService(c.env);
        const versions = await onedrive.getVersions(itemId);

        return c.json({
            success: true,
            data: { versions },
        });
    } catch (error) {
        console.error('Versions error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'VERSIONS_ERROR', message: '获取版本历史失败' },
            },
            500
        );
    }
});

/**
 * 小文件上传 (<4MB)
 * POST /api/files/upload
 */
files.post('/upload', async (c) => {
    try {
        const user = c.get('user') as User;
        const formData = await c.req.formData();
        const fileData = formData.get('file');
        const parentId = (formData.get('parentId') as string) || 'root';

        if (!fileData || typeof fileData === 'string') {
            return c.json(
                {
                    success: false,
                    error: { code: 'INVALID_INPUT', message: '请选择要上传的文件' },
                },
                400
            );
        }

        const file = fileData as globalThis.File;

        // 检查文件大小 (4MB 限制)
        if (file.size > 4 * 1024 * 1024) {
            return c.json(
                {
                    success: false,
                    error: { code: 'FILE_TOO_LARGE', message: '文件超过 4MB，请使用分片上传' },
                },
                400
            );
        }

        // 权限检查
        if (user.role !== 'superadmin') {
            const permCheck = await checkPathPermission(user, parentId, 'create', c.env.DB);
            if (!permCheck.allowed) {
                return c.json(
                    {
                        success: false,
                        error: { code: 'FORBIDDEN', message: permCheck.reason || '权限不足' },
                    },
                    403
                );
            }
        }

        const onedrive = getOneDriveService(c.env);
        const content = await file.arrayBuffer();
        const item = await onedrive.uploadSmall(parentId, file.name, content, file.type);

        // 记录访问日志
        await logAccess(c.env.DB, user.id, 'upload', 'file', item.id, item.name, c.req.raw, {
            size: file.size,
        });

        return c.json({
            success: true,
            data: item,
        });
    } catch (error) {
        console.error('Upload error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'UPLOAD_ERROR', message: '上传失败' },
            },
            500
        );
    }
});

/**
 * 创建大文件上传会话
 * POST /api/files/upload/session
 */
files.post('/upload/session', async (c) => {
    try {
        const user = c.get('user') as User;
        const body = await c.req.json<{
            parentId: string;
            fileName: string;
            fileSize: number;
        }>();

        if (!body.fileName) {
            return c.json(
                {
                    success: false,
                    error: { code: 'INVALID_INPUT', message: '文件名为必填项' },
                },
                400
            );
        }

        // 权限检查
        const parentId = body.parentId || 'root';
        if (user.role !== 'superadmin') {
            const permCheck = await checkPathPermission(user, parentId, 'create', c.env.DB);
            if (!permCheck.allowed) {
                return c.json(
                    {
                        success: false,
                        error: { code: 'FORBIDDEN', message: permCheck.reason || '权限不足' },
                    },
                    403
                );
            }
        }

        const onedrive = getOneDriveService(c.env);
        const session = await onedrive.createUploadSession(parentId, body.fileName);

        return c.json({
            success: true,
            data: session,
        });
    } catch (error) {
        console.error('Create upload session error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'UPLOAD_SESSION_ERROR', message: '创建上传会话失败' },
            },
            500
        );
    }
});

export const fileRoutes = files;
