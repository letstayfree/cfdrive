import { Hono } from 'hono';
import type { Env, User } from '../types';
import { generateId } from '../utils';

const tags = new Hono<{ Bindings: Env }>();

/**
 * 获取用户的所有标签
 * GET /api/tags
 */
tags.get('/', async (c) => {
    try {
        const user = c.get('user') as User;

        const results = await c.env.DB.prepare(`
            SELECT id, name, color, created_at,
                   (SELECT COUNT(*) FROM file_tags WHERE tag_id = tags.id) as file_count
            FROM tags
            WHERE user_id = ?
            ORDER BY created_at DESC
        `).bind(user.id).all();

        return c.json({
            success: true,
            data: { tags: results.results },
        });
    } catch (error) {
        console.error('Get tags error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'GET_TAGS_ERROR', message: '获取标签失败' },
            },
            500
        );
    }
});

/**
 * 创建标签
 * POST /api/tags
 */
tags.post('/', async (c) => {
    try {
        const user = c.get('user') as User;
        const { name, color } = await c.req.json<{ name: string; color?: string }>();

        if (!name || !name.trim()) {
            return c.json(
                {
                    success: false,
                    error: { code: 'INVALID_INPUT', message: '标签名称不能为空' },
                },
                400
            );
        }

        // 验证颜色格式（HEX）
        const finalColor = color || '#3B82F6';
        if (!/^#[0-9A-Fa-f]{6}$/.test(finalColor)) {
            return c.json(
                {
                    success: false,
                    error: { code: 'INVALID_COLOR', message: '颜色格式无效，请使用 HEX 格式（如 #3B82F6）' },
                },
                400
            );
        }

        // 检查同名标签
        const existing = await c.env.DB.prepare(
            'SELECT id FROM tags WHERE user_id = ? AND name = ?'
        ).bind(user.id, name.trim()).first();

        if (existing) {
            return c.json(
                {
                    success: false,
                    error: { code: 'TAG_EXISTS', message: '标签名称已存在' },
                },
                409
            );
        }

        const tagId = generateId();
        await c.env.DB.prepare(`
            INSERT INTO tags (id, user_id, name, color)
            VALUES (?, ?, ?, ?)
        `).bind(tagId, user.id, name.trim(), finalColor).run();

        const tag = await c.env.DB.prepare(
            'SELECT id, name, color, created_at FROM tags WHERE id = ?'
        ).bind(tagId).first();

        return c.json({
            success: true,
            data: tag,
        });
    } catch (error) {
        console.error('Create tag error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'CREATE_TAG_ERROR', message: '创建标签失败' },
            },
            500
        );
    }
});

/**
 * 更新标签
 * PUT /api/tags/:id
 */
tags.put('/:id', async (c) => {
    try {
        const user = c.get('user') as User;
        const tagId = c.req.param('id');
        const { name, color } = await c.req.json<{ name?: string; color?: string }>();

        // 验证标签所有权
        const tag = await c.env.DB.prepare(
            'SELECT id FROM tags WHERE id = ? AND user_id = ?'
        ).bind(tagId, user.id).first();

        if (!tag) {
            return c.json(
                {
                    success: false,
                    error: { code: 'TAG_NOT_FOUND', message: '标签不存在或无权限' },
                },
                404
            );
        }

        const updates: string[] = [];
        const bindings: string[] = [];

        if (name && name.trim()) {
            // 检查新名称是否与其他标签冲突
            const existing = await c.env.DB.prepare(
                'SELECT id FROM tags WHERE user_id = ? AND name = ? AND id != ?'
            ).bind(user.id, name.trim(), tagId).first();

            if (existing) {
                return c.json(
                    {
                        success: false,
                        error: { code: 'TAG_EXISTS', message: '标签名称已存在' },
                    },
                    409
                );
            }

            updates.push('name = ?');
            bindings.push(name.trim());
        }

        if (color) {
            if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
                return c.json(
                    {
                        success: false,
                        error: { code: 'INVALID_COLOR', message: '颜色格式无效' },
                    },
                    400
                );
            }
            updates.push('color = ?');
            bindings.push(color);
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

        await c.env.DB.prepare(`
            UPDATE tags SET ${updates.join(', ')} WHERE id = ?
        `).bind(...bindings, tagId).run();

        const updated = await c.env.DB.prepare(
            'SELECT id, name, color, created_at FROM tags WHERE id = ?'
        ).bind(tagId).first();

        return c.json({
            success: true,
            data: updated,
        });
    } catch (error) {
        console.error('Update tag error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'UPDATE_TAG_ERROR', message: '更新标签失败' },
            },
            500
        );
    }
});

/**
 * 删除标签
 * DELETE /api/tags/:id
 */
tags.delete('/:id', async (c) => {
    try {
        const user = c.get('user') as User;
        const tagId = c.req.param('id');

        // 验证标签所有权
        const tag = await c.env.DB.prepare(
            'SELECT id FROM tags WHERE id = ? AND user_id = ?'
        ).bind(tagId, user.id).first();

        if (!tag) {
            return c.json(
                {
                    success: false,
                    error: { code: 'TAG_NOT_FOUND', message: '标签不存在或无权限' },
                },
                404
            );
        }

        // 删除标签（级联删除 file_tags）
        await c.env.DB.prepare('DELETE FROM tags WHERE id = ?').bind(tagId).run();

        return c.json({
            success: true,
            message: '标签已删除',
        });
    } catch (error) {
        console.error('Delete tag error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'DELETE_TAG_ERROR', message: '删除标签失败' },
            },
            500
        );
    }
});

/**
 * 为文件添加标签
 * POST /api/files/:fileId/tags
 */
tags.post('/files/:fileId', async (c) => {
    try {
        const user = c.get('user') as User;
        const fileId = c.req.param('fileId');
        const { tagIds } = await c.req.json<{ tagIds: string[] }>();

        if (!Array.isArray(tagIds) || tagIds.length === 0) {
            return c.json(
                {
                    success: false,
                    error: { code: 'INVALID_INPUT', message: '请选择至少一个标签' },
                },
                400
            );
        }

        // 验证所有标签都属于当前用户
        const tags = await c.env.DB.prepare(`
            SELECT id FROM tags WHERE user_id = ? AND id IN (${tagIds.map(() => '?').join(',')})
        `).bind(user.id, ...tagIds).all();

        if (tags.results.length !== tagIds.length) {
            return c.json(
                {
                    success: false,
                    error: { code: 'INVALID_TAGS', message: '部分标签不存在或无权限' },
                },
                400
            );
        }

        // 批量插入（忽略已存在的）
        for (const tagId of tagIds) {
            const id = generateId();
            try {
                await c.env.DB.prepare(`
                    INSERT INTO file_tags (id, file_id, tag_id, user_id)
                    VALUES (?, ?, ?, ?)
                `).bind(id, fileId, tagId, user.id).run();
            } catch (error) {
                // 忽略重复插入错误
                continue;
            }
        }

        return c.json({
            success: true,
            message: '标签已添加',
        });
    } catch (error) {
        console.error('Add file tags error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'ADD_TAGS_ERROR', message: '添加标签失败' },
            },
            500
        );
    }
});

/**
 * 移除文件标签
 * DELETE /api/files/:fileId/tags/:tagId
 */
tags.delete('/files/:fileId/tags/:tagId', async (c) => {
    try {
        const user = c.get('user') as User;
        const fileId = c.req.param('fileId');
        const tagId = c.req.param('tagId');

        await c.env.DB.prepare(`
            DELETE FROM file_tags 
            WHERE file_id = ? AND tag_id = ? AND user_id = ?
        `).bind(fileId, tagId, user.id).run();

        return c.json({
            success: true,
            message: '标签已移除',
        });
    } catch (error) {
        console.error('Remove file tag error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'REMOVE_TAG_ERROR', message: '移除标签失败' },
            },
            500
        );
    }
});

/**
 * 获取文件的标签
 * GET /api/files/:fileId/tags
 */
tags.get('/files/:fileId', async (c) => {
    try {
        const user = c.get('user') as User;
        const fileId = c.req.param('fileId');

        const results = await c.env.DB.prepare(`
            SELECT t.id, t.name, t.color
            FROM tags t
            JOIN file_tags ft ON t.id = ft.tag_id
            WHERE ft.file_id = ? AND ft.user_id = ?
        `).bind(fileId, user.id).all();

        return c.json({
            success: true,
            data: { tags: results.results },
        });
    } catch (error) {
        console.error('Get file tags error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'GET_FILE_TAGS_ERROR', message: '获取文件标签失败' },
            },
            500
        );
    }
});

/**
 * 按标签筛选文件
 * GET /api/tags/:id/files
 */
tags.get('/:id/files', async (c) => {
    try {
        const user = c.get('user') as User;
        const tagId = c.req.param('id');

        // 验证标签所有权
        const tag = await c.env.DB.prepare(
            'SELECT id, name FROM tags WHERE id = ? AND user_id = ?'
        ).bind(tagId, user.id).first();

        if (!tag) {
            return c.json(
                {
                    success: false,
                    error: { code: 'TAG_NOT_FOUND', message: '标签不存在或无权限' },
                },
                404
            );
        }

        const results = await c.env.DB.prepare(`
            SELECT file_id, created_at
            FROM file_tags
            WHERE tag_id = ? AND user_id = ?
            ORDER BY created_at DESC
        `).bind(tagId, user.id).all();

        return c.json({
            success: true,
            data: {
                tag,
                fileIds: results.results.map(r => r.file_id),
            },
        });
    } catch (error) {
        console.error('Get tagged files error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'GET_TAGGED_FILES_ERROR', message: '获取标签文件失败' },
            },
            500
        );
    }
});

export default tags;
