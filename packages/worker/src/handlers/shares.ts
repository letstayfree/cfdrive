import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env, User, Share } from '../types';
import { OneDriveService } from '../services/onedrive';
import { generateId, generateShortCode, hashPassword, verifyPassword } from '../utils';

const shares = new Hono<{ Bindings: Env }>();

/**
 * 获取分享列表
 * GET /api/shares
 */
shares.get('/', async (c) => {
    try {
        const user = c.get('user') as User;

        let query = 'SELECT * FROM shares WHERE 1=1';
        const params: unknown[] = [];

        // 非管理员只能看到自己创建的分享
        if (user.role !== 'superadmin') {
            query += ' AND created_by = ?';
            params.push(user.id);
        }

        query += ' ORDER BY created_at DESC';

        const result = await c.env.DB.prepare(query).bind(...params).all<Share>();

        return c.json({
            success: true,
            data: {
                items: result.results.map((share) => ({
                    ...share,
                    password_hash: undefined, // 不返回密码哈希
                    hasPassword: !!share.password_hash,
                })),
            },
        });
    } catch (error) {
        console.error('Get shares error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'GET_SHARES_ERROR', message: '获取分享列表失败' },
            },
            500
        );
    }
});

/**
 * 创建分享
 * POST /api/shares
 */
shares.post('/', async (c) => {
    try {
        const user = c.get('user') as User;
        const body = await c.req.json<{
            fileId: string;
            filePath: string;
            fileType: 'file' | 'folder';
            password?: string;
            expiresIn?: number; // 过期时间（秒）
            maxDownloads?: number;
        }>();

        if (!body.fileId || !body.filePath || !body.fileType) {
            return c.json(
                {
                    success: false,
                    error: { code: 'INVALID_INPUT', message: '文件信息为必填项' },
                },
                400
            );
        }

        const shareId = generateId();
        const code = generateShortCode(8);
        const now = new Date().toISOString();

        let expiresAt: string | null = null;
        if (body.expiresIn) {
            expiresAt = new Date(Date.now() + body.expiresIn * 1000).toISOString();
        }

        let passwordHash: string | null = null;
        if (body.password) {
            passwordHash = await hashPassword(body.password);
        }

        await c.env.DB.prepare(
            `INSERT INTO shares (id, code, file_id, file_path, file_type, created_by, password_hash, expires_at, max_downloads, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
            .bind(
                shareId,
                code,
                body.fileId,
                body.filePath,
                body.fileType,
                user.id,
                passwordHash,
                expiresAt,
                body.maxDownloads || null,
                now
            )
            .run();

        const shareUrl = `${c.env.APP_URL}/s/${code}`;

        return c.json({
            success: true,
            data: {
                id: shareId,
                code,
                url: shareUrl,
                expiresAt,
                hasPassword: !!passwordHash,
                maxDownloads: body.maxDownloads,
            },
        });
    } catch (error) {
        console.error('Create share error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'CREATE_SHARE_ERROR', message: '创建分享失败' },
            },
            500
        );
    }
});

/**
 * 获取分享详情
 * GET /api/shares/:id
 */
shares.get('/:id', async (c) => {
    try {
        const user = c.get('user') as User;
        const shareId = c.req.param('id');

        const share = await c.env.DB.prepare('SELECT * FROM shares WHERE id = ?')
            .bind(shareId)
            .first<Share>();

        if (!share) {
            return c.json(
                {
                    success: false,
                    error: { code: 'SHARE_NOT_FOUND', message: '分享不存在' },
                },
                404
            );
        }

        // 权限检查
        if (user.role !== 'superadmin' && share.created_by !== user.id) {
            return c.json(
                {
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权访问此分享' },
                },
                403
            );
        }

        return c.json({
            success: true,
            data: {
                ...share,
                password_hash: undefined,
                hasPassword: !!share.password_hash,
            },
        });
    } catch (error) {
        console.error('Get share error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'GET_SHARE_ERROR', message: '获取分享详情失败' },
            },
            500
        );
    }
});

/**
 * 更新分享
 * PUT /api/shares/:id
 */
shares.put('/:id', async (c) => {
    try {
        const user = c.get('user') as User;
        const shareId = c.req.param('id');
        const body = await c.req.json<{
            password?: string | null;
            expiresIn?: number | null;
            maxDownloads?: number | null;
            isActive?: boolean;
        }>();

        const share = await c.env.DB.prepare('SELECT * FROM shares WHERE id = ?')
            .bind(shareId)
            .first<Share>();

        if (!share) {
            return c.json(
                {
                    success: false,
                    error: { code: 'SHARE_NOT_FOUND', message: '分享不存在' },
                },
                404
            );
        }

        // 权限检查
        if (user.role !== 'superadmin' && share.created_by !== user.id) {
            return c.json(
                {
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权修改此分享' },
                },
                403
            );
        }

        const updates: string[] = [];
        const params: unknown[] = [];

        if (body.password !== undefined) {
            updates.push('password_hash = ?');
            params.push(body.password ? await hashPassword(body.password) : null);
        }

        if (body.expiresIn !== undefined) {
            updates.push('expires_at = ?');
            params.push(body.expiresIn ? new Date(Date.now() + body.expiresIn * 1000).toISOString() : null);
        }

        if (body.maxDownloads !== undefined) {
            updates.push('max_downloads = ?');
            params.push(body.maxDownloads);
        }

        if (body.isActive !== undefined) {
            updates.push('is_active = ?');
            params.push(body.isActive ? 1 : 0);
        }

        if (updates.length === 0) {
            return c.json(
                {
                    success: false,
                    error: { code: 'NO_UPDATES', message: '没有要更新的内容' },
                },
                400
            );
        }

        params.push(shareId);

        await c.env.DB.prepare(`UPDATE shares SET ${updates.join(', ')} WHERE id = ?`)
            .bind(...params)
            .run();

        return c.json({
            success: true,
            data: { message: '分享更新成功' },
        });
    } catch (error) {
        console.error('Update share error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'UPDATE_SHARE_ERROR', message: '更新分享失败' },
            },
            500
        );
    }
});

/**
 * 删除分享
 * DELETE /api/shares/:id
 */
shares.delete('/:id', async (c) => {
    try {
        const user = c.get('user') as User;
        const shareId = c.req.param('id');

        const share = await c.env.DB.prepare('SELECT * FROM shares WHERE id = ?')
            .bind(shareId)
            .first<Share>();

        if (!share) {
            return c.json(
                {
                    success: false,
                    error: { code: 'SHARE_NOT_FOUND', message: '分享不存在' },
                },
                404
            );
        }

        // 权限检查
        if (user.role !== 'superadmin' && share.created_by !== user.id) {
            return c.json(
                {
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权删除此分享' },
                },
                403
            );
        }

        await c.env.DB.prepare('DELETE FROM shares WHERE id = ?').bind(shareId).run();

        return c.json({
            success: true,
            data: { message: '分享删除成功' },
        });
    } catch (error) {
        console.error('Delete share error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'DELETE_SHARE_ERROR', message: '删除分享失败' },
            },
            500
        );
    }
});

/**
 * 获取分享统计
 * GET /api/shares/:id/stats
 */
shares.get('/:id/stats', async (c) => {
    try {
        const user = c.get('user') as User;
        const shareId = c.req.param('id');

        const share = await c.env.DB.prepare('SELECT * FROM shares WHERE id = ?')
            .bind(shareId)
            .first<Share>();

        if (!share) {
            return c.json(
                {
                    success: false,
                    error: { code: 'SHARE_NOT_FOUND', message: '分享不存在' },
                },
                404
            );
        }

        // 权限检查
        if (user.role !== 'superadmin' && share.created_by !== user.id) {
            return c.json(
                {
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权查看此分享统计' },
                },
                403
            );
        }

        // 获取访问日志统计
        const logs = await c.env.DB.prepare(
            `SELECT action, COUNT(*) as count FROM access_logs 
       WHERE resource_type = 'share' AND resource_id = ?
       GROUP BY action`
        )
            .bind(share.code)
            .all<{ action: string; count: number }>();

        return c.json({
            success: true,
            data: {
                viewCount: share.view_count,
                downloadCount: share.download_count,
                maxDownloads: share.max_downloads,
                actions: logs.results,
            },
        });
    } catch (error) {
        console.error('Get share stats error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'GET_STATS_ERROR', message: '获取统计失败' },
            },
            500
        );
    }
});

// ============================================
// 公开访问路由 (无需认证)
// ============================================

/**
 * 公开访问分享
 * GET /api/s/:code
 */
async function publicAccess(c: Context<{ Bindings: Env }>) {
    try {
        const code = c.req.param('code');

        const share = await c.env.DB.prepare(
            'SELECT * FROM shares WHERE code = ? AND is_active = 1'
        )
            .bind(code)
            .first<Share>();

        if (!share) {
            return c.json(
                {
                    success: false,
                    error: { code: 'SHARE_NOT_FOUND', message: '分享不存在或已失效' },
                },
                404
            );
        }

        // 检查是否过期
        if (share.expires_at && new Date(share.expires_at) < new Date()) {
            return c.json(
                {
                    success: false,
                    error: { code: 'SHARE_EXPIRED', message: '分享已过期' },
                },
                410
            );
        }

        // 检查下载次数限制
        if (share.max_downloads && share.download_count >= share.max_downloads) {
            return c.json(
                {
                    success: false,
                    error: { code: 'DOWNLOAD_LIMIT_REACHED', message: '下载次数已达上限' },
                },
                410
            );
        }

        // 更新访问次数
        await c.env.DB.prepare('UPDATE shares SET view_count = view_count + 1 WHERE id = ?')
            .bind(share.id)
            .run();

        // 记录访问日志
        const ipAddress =
            c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || null;
        const userAgent = c.req.header('User-Agent') || null;

        await c.env.DB.prepare(
            `INSERT INTO access_logs (id, user_id, action, resource_type, resource_id, resource_path, ip_address, user_agent, created_at)
       VALUES (?, NULL, 'view', 'share', ?, ?, ?, ?, ?)`
        )
            .bind(generateId(), code, share.file_path, ipAddress, userAgent, new Date().toISOString())
            .run();

        // 如果需要密码验证
        if (share.password_hash) {
            return c.json({
                success: true,
                data: {
                    requiresPassword: true,
                    fileType: share.file_type,
                    fileName: share.file_path.split('/').pop(),
                },
            });
        }

        // 获取文件信息
        const onedrive = new OneDriveService(c.env);
        const item = await onedrive.getItem(share.file_id);

        // 如果是文件夹，列出内容
        if (share.file_type === 'folder') {
            const contents = await onedrive.listFolder(share.file_id);
            return c.json({
                success: true,
                data: {
                    ...share,
                    password_hash: undefined,
                    item,
                    contents: contents.items,
                },
            });
        }

        return c.json({
            success: true,
            data: {
                ...share,
                password_hash: undefined,
                item,
            },
        });
    } catch (error) {
        console.error('Public access error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'ACCESS_ERROR', message: '访问分享失败' },
            },
            500
        );
    }
}

/**
 * 验证分享密码
 * POST /api/s/:code/verify
 */
async function verifySharePassword(c: Context<{ Bindings: Env }>) {
    try {
        const code = c.req.param('code');
        const body = await c.req.json<{ password: string }>();

        if (!body.password) {
            return c.json(
                {
                    success: false,
                    error: { code: 'INVALID_INPUT', message: '请输入密码' },
                },
                400
            );
        }

        const share = await c.env.DB.prepare(
            'SELECT * FROM shares WHERE code = ? AND is_active = 1'
        )
            .bind(code)
            .first<Share>();

        if (!share || !share.password_hash) {
            return c.json(
                {
                    success: false,
                    error: { code: 'SHARE_NOT_FOUND', message: '分享不存在' },
                },
                404
            );
        }

        // 验证密码
        const valid = await verifyPassword(body.password, share.password_hash);
        if (!valid) {
            return c.json(
                {
                    success: false,
                    error: { code: 'INVALID_PASSWORD', message: '密码错误' },
                },
                401
            );
        }

        // 获取文件信息
        const onedrive = new OneDriveService(c.env);
        const item = await onedrive.getItem(share.file_id);

        // 如果是文件夹，列出内容
        if (share.file_type === 'folder') {
            const contents = await onedrive.listFolder(share.file_id);
            return c.json({
                success: true,
                data: {
                    ...share,
                    password_hash: undefined,
                    item,
                    contents: contents.items,
                    verified: true,
                },
            });
        }

        return c.json({
            success: true,
            data: {
                ...share,
                password_hash: undefined,
                item,
                verified: true,
            },
        });
    } catch (error) {
        console.error('Verify password error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'VERIFY_ERROR', message: '验证失败' },
            },
            500
        );
    }
}

/**
 * 公开下载分享文件
 * GET /api/s/:code/download/:fileId
 */
async function publicDownload(c: Context<{ Bindings: Env }>) {
    try {
        const code = c.req.param('code');
        const fileId = c.req.param('fileId');

        const share = await c.env.DB.prepare(
            'SELECT * FROM shares WHERE code = ? AND is_active = 1'
        )
            .bind(code)
            .first<Share>();

        if (!share) {
            return c.json(
                {
                    success: false,
                    error: { code: 'SHARE_NOT_FOUND', message: '分享不存在' },
                },
                404
            );
        }

        // 检查是否过期
        if (share.expires_at && new Date(share.expires_at) < new Date()) {
            return c.json(
                {
                    success: false,
                    error: { code: 'SHARE_EXPIRED', message: '分享已过期' },
                },
                410
            );
        }

        // 检查下载次数限制
        if (share.max_downloads && share.download_count >= share.max_downloads) {
            return c.json(
                {
                    success: false,
                    error: { code: 'DOWNLOAD_LIMIT_REACHED', message: '下载次数已达上限' },
                },
                410
            );
        }

        // 验证文件ID是否属于此分享
        // 对于文件分享，fileId 必须等于 share.file_id
        // 对于文件夹分享，需要验证 fileId 是否在文件夹下
        if (share.file_type === 'file' && fileId !== share.file_id) {
            return c.json(
                {
                    success: false,
                    error: { code: 'FORBIDDEN', message: '无权下载此文件' },
                },
                403
            );
        }

        // 更新下载次数
        await c.env.DB.prepare('UPDATE shares SET download_count = download_count + 1 WHERE id = ?')
            .bind(share.id)
            .run();

        // 记录访问日志
        const ipAddress =
            c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || null;
        const userAgent = c.req.header('User-Agent') || null;

        await c.env.DB.prepare(
            `INSERT INTO access_logs (id, user_id, action, resource_type, resource_id, resource_path, ip_address, user_agent, created_at)
       VALUES (?, NULL, 'download', 'share', ?, ?, ?, ?, ?)`
        )
            .bind(generateId(), code, null, ipAddress, userAgent, new Date().toISOString())
            .run();

        // 获取下载链接
        const onedrive = new OneDriveService(c.env);
        const downloadUrl = await onedrive.getDownloadUrl(fileId);

        return c.json({
            success: true,
            data: { downloadUrl },
        });
    } catch (error) {
        console.error('Public download error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'DOWNLOAD_ERROR', message: '下载失败' },
            },
            500
        );
    }
}

export const shareRoutes = {
    authenticated: shares,
    publicAccess,
    verifyPassword: verifySharePassword,
    publicDownload,
};
