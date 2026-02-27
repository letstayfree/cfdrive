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
 * 获取驱动器配额信息
 * GET /drive/quota
 */
files.get('/drive/quota', async (c) => {
    try {
        const onedrive = getOneDriveService(c.env);
        const driveInfo = await onedrive.getDriveInfo();

        return c.json({
            success: true,
            data: {
                total: driveInfo.quota.total,
                used: driveInfo.quota.used,
                remaining: driveInfo.quota.remaining,
                state: driveInfo.quota.state,
                driveType: driveInfo.driveType,
                owner: driveInfo.owner,
            },
        });
    } catch (error) {
        console.error('Get drive quota error:', error);
        return c.json({
            success: false,
            error: { code: 'DRIVE_QUOTA_ERROR', message: 'Failed to get drive quota' },
        }, 500);
    }
});

/**
 * 更新文件内容
 * PUT /:id/content
 */
files.put('/:id/content', async (c) => {
    try {
        const itemId = c.req.param('id');
        const onedrive = getOneDriveService(c.env);
        const body = await c.req.arrayBuffer();

        const result = await onedrive.updateFileContent(itemId, body);

        return c.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('Update file content error:', error);
        return c.json({
            success: false,
            error: { code: 'UPDATE_CONTENT_ERROR', message: 'Failed to update file content' },
        }, 500);
    }
});

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
 * 获取回收站内容
 * GET /api/files/trash
 * 注意：此路由必须在 /:id 之前定义，否则会被匹配为 id 参数
 */
files.get('/trash', async (c) => {
    try {
        const user = c.get('user') as User;

        // 只有管理员可以查看回收站
        if (user.role !== 'superadmin') {
            return c.json(
                {
                    success: false,
                    error: { code: 'FORBIDDEN', message: '权限不足' },
                },
                403
            );
        }

        // 从本地数据库读取已删除文件（回收站数据保留30天）
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const result = await c.env.DB.prepare(`
            SELECT id, file_id, file_name, file_path, file_type, file_size, deleted_at, parent_id, metadata
            FROM deleted_items
            WHERE deleted_at > ?
            ORDER BY deleted_at DESC
        `).bind(thirtyDaysAgo).all();

        const items = (result.results || []).map((row: Record<string, unknown>) => ({
            id: row.id as string,
            fileId: row.file_id as string,
            name: row.file_name as string,
            path: row.file_path as string,
            folder: (row.file_type as string) === 'folder' ? {} : undefined,
            size: row.file_size as number,
            deletedAt: row.deleted_at as string,
            parentId: row.parent_id as string | null,
            metadata: row.metadata ? JSON.parse(row.metadata as string) : null,
        }));

        return c.json({
            success: true,
            data: { items },
        });
    } catch (error) {
        console.error('Get trash error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'TRASH_ERROR', message: '获取回收站失败' },
            },
            500
        );
    }
});

/**
 * 搜索文件
 * GET /api/files/search
 * 注意：此路由必须在 /:id 之前定义，否则会被匹配为 id 参数
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
 * 批量删除文件/文件夹
 * POST /api/files/batch/delete
 */
files.post('/batch/delete', async (c) => {
    try {
        const user = c.get('user') as User;
        const body = await c.req.json<{ itemIds: string[] }>();

        if (!body.itemIds || body.itemIds.length === 0) {
            return c.json(
                {
                    success: false,
                    error: { code: 'INVALID_INPUT', message: '文件 ID 列表为空' },
                },
                400
            );
        }

        const onedrive = getOneDriveService(c.env);
        const results = {
            success: [] as string[],
            failed: [] as Array<{ id: string; reason: string }>,
        };

        for (const itemId of body.itemIds) {
            try {
                // 权限检查
                if (user.role !== 'superadmin') {
                    const permCheck = await checkPathPermission(user, itemId, 'delete', c.env.DB);
                    if (!permCheck.allowed) {
                        results.failed.push({ id: itemId, reason: permCheck.reason || '权限不足' });
                        continue;
                    }
                }

                // 先获取项目信息
                let itemInfo: DriveItem | null = null;
                try {
                    itemInfo = await onedrive.getItem(itemId);
                } catch {
                    // 忽略错误
                }

                // 记录到已删除文件表
                if (itemInfo) {
                    const deletedId = generateId();
                    const now = new Date().toISOString();
                    await c.env.DB.prepare(`
                        INSERT INTO deleted_items (id, user_id, file_id, file_name, file_path, file_type, file_size, deleted_at, parent_id, metadata)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `).bind(
                        deletedId,
                        user.id,
                        itemId,
                        itemInfo.name,
                        itemInfo.parentReference?.path?.replace('/drive/root:', '') || '/',
                        itemInfo.folder ? 'folder' : 'file',
                        itemInfo.size || 0,
                        now,
                        itemInfo.parentReference?.id || null,
                        JSON.stringify({
                            mimeType: itemInfo.file?.mimeType,
                            webUrl: itemInfo.webUrl,
                            createdDateTime: itemInfo.createdDateTime,
                            lastModifiedDateTime: itemInfo.lastModifiedDateTime,
                        })
                    ).run();
                }

                await onedrive.deleteItem(itemId);
                await logAccess(
                    c.env.DB,
                    user.id,
                    'delete',
                    itemInfo?.folder ? 'folder' : 'file',
                    itemId,
                    itemInfo?.name || null,
                    c.req.raw
                );

                results.success.push(itemId);
            } catch (error) {
                console.error(`Failed to delete item ${itemId}:`, error);
                results.failed.push({
                    id: itemId,
                    reason: error instanceof Error ? error.message : '删除失败',
                });
            }
        }

        return c.json({
            success: results.failed.length === 0,
            data: results,
        });
    } catch (error) {
        console.error('Batch delete error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'DELETE_ERROR', message: '批量删除失败' },
            },
            500
        );
    }
});

/**
 * 批量移动文件/文件夹
 * POST /api/files/batch/move
 */
files.post('/batch/move', async (c) => {
    try {
        const user = c.get('user') as User;
        const body = await c.req.json<{ itemIds: string[]; targetParentId: string }>();

        if (!body.itemIds || body.itemIds.length === 0) {
            return c.json(
                {
                    success: false,
                    error: { code: 'INVALID_INPUT', message: '文件 ID 列表为空' },
                },
                400
            );
        }

        if (!body.targetParentId) {
            return c.json(
                {
                    success: false,
                    error: { code: 'INVALID_INPUT', message: '目标文件夹为必填项' },
                },
                400
            );
        }

        const onedrive = getOneDriveService(c.env);
        const results = {
            success: [] as string[],
            failed: [] as Array<{ id: string; reason: string }>,
        };

        for (const itemId of body.itemIds) {
            try {
                // 权限检查
                if (user.role !== 'superadmin') {
                    const sourceCheck = await checkPathPermission(user, itemId, 'delete', c.env.DB);
                    if (!sourceCheck.allowed) {
                        results.failed.push({ id: itemId, reason: '没有源文件的修改权限' });
                        continue;
                    }

                    const targetCheck = await checkPathPermission(user, body.targetParentId, 'create', c.env.DB);
                    if (!targetCheck.allowed) {
                        results.failed.push({ id: itemId, reason: '没有目标文件夹的写入权限' });
                        continue;
                    }
                }

                const item = await onedrive.moveItem(itemId, body.targetParentId);
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
                results.success.push(itemId);
            } catch (error) {
                console.error(`Failed to move item ${itemId}:`, error);
                results.failed.push({
                    id: itemId,
                    reason: error instanceof Error ? error.message : '移动失败',
                });
            }
        }

        return c.json({
            success: results.failed.length === 0,
            data: results,
        });
    } catch (error) {
        console.error('Batch move error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'MOVE_ERROR', message: '批量移动失败' },
            },
            500
        );
    }
});

/**
 * 批量复制文件/文件夹
 * POST /api/files/batch/copy
 */
files.post('/batch/copy', async (c) => {
    try {
        const user = c.get('user') as User;
        const body = await c.req.json<{ itemIds: string[]; targetParentId: string }>();

        if (!body.itemIds || body.itemIds.length === 0) {
            return c.json(
                {
                    success: false,
                    error: { code: 'INVALID_INPUT', message: '文件 ID 列表为空' },
                },
                400
            );
        }

        if (!body.targetParentId) {
            return c.json(
                {
                    success: false,
                    error: { code: 'INVALID_INPUT', message: '目标文件夹为必填项' },
                },
                400
            );
        }

        const onedrive = getOneDriveService(c.env);
        const results = {
            success: [] as string[],
            failed: [] as Array<{ id: string; reason: string }>,
        };

        for (const itemId of body.itemIds) {
            try {
                // 权限检查
                if (user.role !== 'superadmin') {
                    const sourceCheck = await checkPathPermission(user, itemId, 'read', c.env.DB);
                    if (!sourceCheck.allowed) {
                        results.failed.push({ id: itemId, reason: '没有源文件的读取权限' });
                        continue;
                    }

                    const targetCheck = await checkPathPermission(user, body.targetParentId, 'create', c.env.DB);
                    if (!targetCheck.allowed) {
                        results.failed.push({ id: itemId, reason: '没有目标文件夹的写入权限' });
                        continue;
                    }
                }

                await onedrive.copyItem(itemId, body.targetParentId);
                await logAccess(c.env.DB, user.id, 'copy', 'file', itemId, null, c.req.raw, {
                    targetParentId: body.targetParentId,
                });
                results.success.push(itemId);
            } catch (error) {
                console.error(`Failed to copy item ${itemId}:`, error);
                results.failed.push({
                    id: itemId,
                    reason: error instanceof Error ? error.message : '复制失败',
                });
            }
        }

        return c.json({
            success: results.failed.length === 0,
            data: results,
        });
    } catch (error) {
        console.error('Batch copy error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'COPY_ERROR', message: '批量复制失败' },
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

        // 先获取项目信息用于日志和回收站记录
        let itemInfo: DriveItem | null = null;
        try {
            itemInfo = await onedrive.getItem(itemId);
        } catch {
            // 忽略错误
        }

        // 记录到已删除文件表（用于回收站功能）
        if (itemInfo) {
            const deletedId = generateId();
            const now = new Date().toISOString();
            await c.env.DB.prepare(`
                INSERT INTO deleted_items (id, user_id, file_id, file_name, file_path, file_type, file_size, deleted_at, parent_id, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                deletedId,
                user.id,
                itemId,
                itemInfo.name,
                itemInfo.parentReference?.path?.replace('/drive/root:', '') || '/',
                itemInfo.folder ? 'folder' : 'file',
                itemInfo.size || 0,
                now,
                itemInfo.parentReference?.id || null,
                JSON.stringify({
                    mimeType: itemInfo.file?.mimeType,
                    webUrl: itemInfo.webUrl,
                    createdDateTime: itemInfo.createdDateTime,
                    lastModifiedDateTime: itemInfo.lastModifiedDateTime,
                })
            ).run();
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

            // 只有非root时才检查目标权限
            if (body.targetParentId !== 'root') {
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
        }

        const onedrive = getOneDriveService(c.env);
        console.log(`[copy] Copying item ${itemId} to ${body.targetParentId}`);
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

            // 只有非root时才检查目标权限
            if (body.targetParentId !== 'root') {
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
        }

        const onedrive = getOneDriveService(c.env);
        console.log(`[move] Moving item ${itemId} to ${body.targetParentId}`);
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

/**
 * 恢复回收站项目
 * POST /api/files/:id/restore
 * 注意：id 是 deleted_items 表中的记录 ID
 * 策略：先从 OneDrive 回收站查找文件，获取正确的 item ID 后再恢复
 */
files.post('/:id/restore', async (c) => {
    try {
        const user = c.get('user') as User;
        const deletedItemId = c.req.param('id');

        // 只有管理员可以恢复
        if (user.role !== 'superadmin') {
            return c.json(
                {
                    success: false,
                    error: { code: 'FORBIDDEN', message: '权限不足' },
                },
                403
            );
        }

        // 从数据库获取删除记录
        const record = await c.env.DB.prepare(`
            SELECT file_id, file_name, parent_id, deleted_at FROM deleted_items WHERE id = ?
        `).bind(deletedItemId).first();

        if (!record) {
            return c.json(
                {
                    success: false,
                    error: { code: 'NOT_FOUND', message: '找不到该删除记录' },
                },
                404
            );
        }

        const originalFileId = record.file_id as string;
        const fileName = record.file_name as string;
        const deletedAt = record.deleted_at as string;

        const onedrive = getOneDriveService(c.env);
        let restoredItem: DriveItem | null = null;
        let restoreSuccess = false;
        let errorMessage = '';

        try {
            // 策略1：尝试直接用原始 ID 恢复
            console.log(`Attempting to restore file with original ID: ${originalFileId} (${fileName})`);
            try {
                restoredItem = await onedrive.restoreFromTrash(originalFileId);
                restoreSuccess = true;
                console.log(`Successfully restored file with original ID: ${originalFileId}`);
            } catch (directRestoreError) {
                console.log('Direct restore failed, trying to find file in recycle bin...');

                // 策略2：从回收站查找文件
                try {
                    const deletedItems = await onedrive.getDeletedItems();

                    // 根据文件名和删除时间查找匹配的文件
                    const matchedItem = deletedItems.find(item => {
                        const nameMatch = item.name === fileName;
                        // 允许时间有一定误差（5分钟内）
                        const timeMatch = item.deletedDateTime &&
                            Math.abs(new Date(item.deletedDateTime).getTime() - new Date(deletedAt).getTime()) < 5 * 60 * 1000;
                        return nameMatch && (timeMatch || !item.deletedDateTime);
                    });

                    if (matchedItem && matchedItem.id) {
                        console.log(`Found file in recycle bin with ID: ${matchedItem.id}`);
                        restoredItem = await onedrive.restoreFromTrash(matchedItem.id);
                        restoreSuccess = true;
                        console.log(`Successfully restored file using recycle bin ID: ${matchedItem.id}`);
                    } else {
                        throw new Error('File not found in recycle bin');
                    }
                } catch (recycleBinError) {
                    console.error('Failed to find/restore from recycle bin:', recycleBinError);
                    throw recycleBinError;
                }
            }
        } catch (error) {
            console.error('Restore failed:', error);
            errorMessage = error instanceof Error ? error.message : String(error);

            // 检查错误类型
            if (errorMessage.includes('itemNotFound') || errorMessage.includes('404') || errorMessage.includes('not found')) {
                errorMessage = '文件可能已被永久删除或已过期';
            } else if (errorMessage.includes('accessDenied') || errorMessage.includes('403')) {
                errorMessage = 'OneDrive for Business 可能需要额外权限才能恢复文件';
            } else if (errorMessage.includes('TRASH_NOT_SUPPORTED')) {
                errorMessage = 'OneDrive API 不支持访问回收站';
            }
        }

        if (restoreSuccess && restoredItem) {
            // 从删除记录表中移除
            await c.env.DB.prepare('DELETE FROM deleted_items WHERE id = ?').bind(deletedItemId).run();

            // 记录访问日志
            await logAccess(c.env.DB, user.id, 'restore', restoredItem.folder ? 'folder' : 'file', originalFileId, restoredItem.name, c.req.raw);

            return c.json({
                success: true,
                data: restoredItem,
                message: '文件已成功恢复'
            });
        } else {
            // 恢复失败，但仍从本地记录中移除
            await c.env.DB.prepare('DELETE FROM deleted_items WHERE id = ?').bind(deletedItemId).run();

            return c.json({
                success: true,
                data: {
                    message: '已从回收站记录中移除',
                    note: `无法通过 API 自动恢复：${errorMessage}。请在 OneDrive 网页版手动恢复。`,
                    fileId: originalFileId,
                    fileName,
                    oneDriveUrl: 'https://onedrive.live.com/?id=root&cid=recycleBin'
                },
            });
        }
    } catch (error) {
        console.error('Restore error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'RESTORE_ERROR', message: '恢复失败' },
            },
            500
        );
    }
});

/**
 * 永久删除项目（从回收站记录中移除）
 * DELETE /api/files/:id/permanent
 * 注意：id 是 deleted_items 表中的记录 ID
 */
files.delete('/:id/permanent', async (c) => {
    try {
        const user = c.get('user') as User;
        const deletedItemId = c.req.param('id');

        // 只有管理员可以永久删除
        if (user.role !== 'superadmin') {
            return c.json(
                {
                    success: false,
                    error: { code: 'FORBIDDEN', message: '权限不足' },
                },
                403
            );
        }

        // 从数据库获取删除记录
        const record = await c.env.DB.prepare(`
            SELECT file_id, file_name FROM deleted_items WHERE id = ?
        `).bind(deletedItemId).first();

        if (!record) {
            return c.json(
                {
                    success: false,
                    error: { code: 'NOT_FOUND', message: '找不到该删除记录' },
                },
                404
            );
        }

        const fileId = record.file_id as string;
        const fileName = record.file_name as string;

        // 尝试通过 Graph API 永久删除（如果还在回收站中）
        try {
            const onedrive = getOneDriveService(c.env);
            await onedrive.permanentlyDelete(fileId);
        } catch {
            // 忽略错误，可能文件已经被永久删除
            console.log('Graph permanent delete failed, file may already be permanently deleted');
        }

        // 从删除记录表中移除
        await c.env.DB.prepare('DELETE FROM deleted_items WHERE id = ?').bind(deletedItemId).run();

        // 记录访问日志
        await logAccess(c.env.DB, user.id, 'permanent_delete', 'file', fileId, fileName, c.req.raw);

        return c.json({
            success: true,
            data: { message: '已永久删除' },
        });
    } catch (error) {
        console.error('Permanent delete error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'DELETE_ERROR', message: '永久删除失败' },
            },
            500
        );
    }
});

export const fileRoutes = files;

