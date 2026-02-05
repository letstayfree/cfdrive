import { Hono } from 'hono';
import type { Env, User } from '../types';
import { generateId } from '../utils';

interface Favorite {
    id: string;
    user_id: string;
    file_id: string;
    file_name: string;
    file_path: string;
    file_type: 'file' | 'folder';
    created_at: string;
}

const favorites = new Hono<{ Bindings: Env }>();

/**
 * 获取收藏列表
 * GET /api/favorites
 */
favorites.get('/', async (c) => {
    try {
        const user = c.get('user') as User;

        const result = await c.env.DB.prepare(
            `SELECT * FROM favorites WHERE user_id = ? ORDER BY created_at DESC`
        )
            .bind(user.id)
            .all<Favorite>();

        return c.json({
            success: true,
            data: {
                items: result.results || [],
            },
        });
    } catch (error) {
        console.error('List favorites error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'LIST_ERROR', message: '获取收藏列表失败' },
            },
            500
        );
    }
});

/**
 * 添加收藏
 * POST /api/favorites
 */
favorites.post('/', async (c) => {
    try {
        const user = c.get('user') as User;
        const body = await c.req.json<{
            file_id: string;
            file_name: string;
            file_path: string;
            file_type: 'file' | 'folder';
        }>();

        if (!body.file_id || !body.file_name) {
            return c.json(
                {
                    success: false,
                    error: { code: 'INVALID_INPUT', message: '文件信息不完整' },
                },
                400
            );
        }

        // 检查是否已收藏
        const existing = await c.env.DB.prepare(
            `SELECT id FROM favorites WHERE user_id = ? AND file_id = ?`
        )
            .bind(user.id, body.file_id)
            .first();

        if (existing) {
            return c.json(
                {
                    success: false,
                    error: { code: 'ALREADY_EXISTS', message: '已在收藏列表中' },
                },
                400
            );
        }

        const id = generateId();
        const now = new Date().toISOString();

        await c.env.DB.prepare(
            `INSERT INTO favorites (id, user_id, file_id, file_name, file_path, file_type, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
            .bind(id, user.id, body.file_id, body.file_name, body.file_path || '', body.file_type || 'file', now)
            .run();

        return c.json({
            success: true,
            data: {
                id,
                file_id: body.file_id,
                file_name: body.file_name,
                message: '添加收藏成功',
            },
        });
    } catch (error) {
        console.error('Add favorite error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'ADD_ERROR', message: '添加收藏失败' },
            },
            500
        );
    }
});

/**
 * 检查文件是否已收藏
 * GET /api/favorites/check/:fileId
 */
favorites.get('/check/:fileId', async (c) => {
    try {
        const user = c.get('user') as User;
        const fileId = c.req.param('fileId');

        const existing = await c.env.DB.prepare(
            `SELECT id FROM favorites WHERE user_id = ? AND file_id = ?`
        )
            .bind(user.id, fileId)
            .first();

        return c.json({
            success: true,
            data: {
                isFavorite: !!existing,
                favoriteId: existing?.id || null,
            },
        });
    } catch (error) {
        console.error('Check favorite error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'CHECK_ERROR', message: '检查收藏状态失败' },
            },
            500
        );
    }
});

/**
 * 批量检查收藏状态
 * POST /api/favorites/check-batch
 */
favorites.post('/check-batch', async (c) => {
    try {
        const user = c.get('user') as User;
        const body = await c.req.json<{ fileIds: string[] }>();

        if (!body.fileIds || !Array.isArray(body.fileIds)) {
            return c.json(
                {
                    success: false,
                    error: { code: 'INVALID_INPUT', message: '文件ID列表无效' },
                },
                400
            );
        }

        const placeholders = body.fileIds.map(() => '?').join(',');
        const result = await c.env.DB.prepare(
            `SELECT file_id FROM favorites WHERE user_id = ? AND file_id IN (${placeholders})`
        )
            .bind(user.id, ...body.fileIds)
            .all<{ file_id: string }>();

        const favoriteIds = new Set((result.results || []).map(r => r.file_id));
        const statusMap: Record<string, boolean> = {};
        body.fileIds.forEach(id => {
            statusMap[id] = favoriteIds.has(id);
        });

        return c.json({
            success: true,
            data: statusMap,
        });
    } catch (error) {
        console.error('Batch check favorites error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'CHECK_ERROR', message: '批量检查收藏状态失败' },
            },
            500
        );
    }
});

/**
 * 取消收藏
 * DELETE /api/favorites/:fileId
 */
favorites.delete('/:fileId', async (c) => {
    try {
        const user = c.get('user') as User;
        const fileId = c.req.param('fileId');

        await c.env.DB.prepare(
            `DELETE FROM favorites WHERE user_id = ? AND file_id = ?`
        )
            .bind(user.id, fileId)
            .run();

        return c.json({
            success: true,
            data: { message: '取消收藏成功' },
        });
    } catch (error) {
        console.error('Remove favorite error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'REMOVE_ERROR', message: '取消收藏失败' },
            },
            500
        );
    }
});

export const favoriteRoutes = favorites;
