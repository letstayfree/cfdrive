import { Hono } from 'hono';
import type { Env, User } from '../types';

const logs = new Hono<{ Bindings: Env }>();

interface AccessLog {
    id: string;
    user_id: string | null;
    action: string;
    resource_type: string;
    resource_id: string;
    resource_path: string | null;
    ip_address: string | null;
    user_agent: string | null;
    details: string | null;
    created_at: string;
}

interface UserInfo {
    username: string;
    email: string;
}

/**
 * 获取访问日志列表（仅管理员）
 * GET /api/logs?page=1&limit=50&user_id=xxx&action=xxx&resource_type=xxx&start_date=xxx&end_date=xxx
 */
logs.get('/', async (c) => {
    const user = c.get('user') as User;

    // 仅管理员可以查看日志
    if (user.role !== 'superadmin') {
        return c.json(
            {
                success: false,
                error: { code: 'FORBIDDEN', message: '权限不足' },
            },
            403
        );
    }

    // 获取查询参数
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100); // 最多100条
    const userId = c.req.query('user_id');
    const action = c.req.query('action');
    const resourceType = c.req.query('resource_type');
    const startDate = c.req.query('start_date');
    const endDate = c.req.query('end_date');

    const offset = (page - 1) * limit;

    try {
        // 构建查询条件
        const conditions: string[] = [];
        const params: any[] = [];

        if (userId) {
            conditions.push('user_id = ?');
            params.push(userId);
        }

        if (action) {
            conditions.push('action = ?');
            params.push(action);
        }

        if (resourceType) {
            conditions.push('resource_type = ?');
            params.push(resourceType);
        }

        if (startDate) {
            conditions.push("created_at >= ?");
            params.push(startDate);
        }

        if (endDate) {
            conditions.push("created_at <= ?");
            params.push(endDate);
        }

        const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

        // 查询日志
        const logsQuery = `
            SELECT * FROM access_logs 
            ${whereClause}
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        `;
        params.push(limit, offset);

        const logsResult = await c.env.DB.prepare(logsQuery)
            .bind(...params)
            .all<AccessLog>();

        // 查询总数
        const countQuery = `SELECT COUNT(*) as total FROM access_logs ${whereClause}`;
        const countResult = await c.env.DB.prepare(countQuery)
            .bind(...params.slice(0, -2)) // 移除 limit 和 offset
            .first<{ total: number }>();

        const total = countResult?.total || 0;

        // 获取关联的用户信息
        const userIds = [...new Set(logsResult.results.map(log => log.user_id).filter(Boolean))];
        const users = new Map<string, UserInfo>();

        if (userIds.length > 0) {
            const placeholders = userIds.map(() => '?').join(',');
            const usersResult = await c.env.DB.prepare(
                `SELECT id, username, email FROM users WHERE id IN (${placeholders})`
            )
                .bind(...userIds)
                .all<{ id: string; username: string; email: string }>();

            usersResult.results.forEach(u => {
                users.set(u.id, { username: u.username, email: u.email });
            });
        }

        // 组装日志数据，包含用户信息
        const logsWithUser = logsResult.results.map(log => ({
            ...log,
            user: log.user_id ? users.get(log.user_id) : null,
        }));

        return c.json({
            success: true,
            data: {
                logs: logsWithUser,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit),
                },
            },
        });
    } catch (error) {
        console.error('Get logs error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'INTERNAL_ERROR', message: '获取日志失败' },
            },
            500
        );
    }
});

/**
 * 获取日志统计信息（仅管理员）
 * GET /api/logs/stats?start_date=xxx&end_date=xxx
 */
logs.get('/stats', async (c) => {
    const user = c.get('user') as User;

    if (user.role !== 'superadmin') {
        return c.json(
            {
                success: false,
                error: { code: 'FORBIDDEN', message: '权限不足' },
            },
            403
        );
    }

    const startDate = c.req.query('start_date');
    const endDate = c.req.query('end_date');

    try {
        const conditions: string[] = [];
        const params: any[] = [];

        if (startDate) {
            conditions.push("created_at >= ?");
            params.push(startDate);
        }

        if (endDate) {
            conditions.push("created_at <= ?");
            params.push(endDate);
        }

        const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

        // 按操作类型统计
        const actionStats = await c.env.DB.prepare(`
            SELECT action, COUNT(*) as count 
            FROM access_logs 
            ${whereClause}
            GROUP BY action 
            ORDER BY count DESC
        `)
            .bind(...params)
            .all<{ action: string; count: number }>();

        // 按资源类型统计
        const resourceStats = await c.env.DB.prepare(`
            SELECT resource_type, COUNT(*) as count 
            FROM access_logs 
            ${whereClause}
            GROUP BY resource_type 
            ORDER BY count DESC
        `)
            .bind(...params)
            .all<{ resource_type: string; count: number }>();

        // 按用户统计
        const userStats = await c.env.DB.prepare(`
            SELECT user_id, COUNT(*) as count 
            FROM access_logs 
            ${whereClause}
            AND user_id IS NOT NULL
            GROUP BY user_id 
            ORDER BY count DESC 
            LIMIT 10
        `)
            .bind(...params)
            .all<{ user_id: string; count: number }>();

        // 获取用户信息
        const userIds = userStats.results.map(s => s.user_id);
        const users = new Map<string, UserInfo>();

        if (userIds.length > 0) {
            const placeholders = userIds.map(() => '?').join(',');
            const usersResult = await c.env.DB.prepare(
                `SELECT id, username, email FROM users WHERE id IN (${placeholders})`
            )
                .bind(...userIds)
                .all<{ id: string; username: string; email: string }>();

            usersResult.results.forEach(u => {
                users.set(u.id, { username: u.username, email: u.email });
            });
        }

        const userStatsWithInfo = userStats.results.map(s => ({
            user_id: s.user_id,
            user: users.get(s.user_id),
            count: s.count,
        }));

        return c.json({
            success: true,
            data: {
                by_action: actionStats.results,
                by_resource: resourceStats.results,
                by_user: userStatsWithInfo,
            },
        });
    } catch (error) {
        console.error('Get stats error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'INTERNAL_ERROR', message: '获取统计失败' },
            },
            500
        );
    }
});

/**
 * 清理旧日志（仅管理员）
 * DELETE /api/logs/cleanup?days=90
 */
logs.delete('/cleanup', async (c) => {
    const user = c.get('user') as User;

    if (user.role !== 'superadmin') {
        return c.json(
            {
                success: false,
                error: { code: 'FORBIDDEN', message: '权限不足' },
            },
            403
        );
    }

    const days = parseInt(c.req.query('days') || '90');

    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        const result = await c.env.DB.prepare(
            'DELETE FROM access_logs WHERE created_at < ?'
        )
            .bind(cutoffDate.toISOString())
            .run();

        return c.json({
            success: true,
            message: `已清理 ${days} 天前的日志`,
            data: {
                deleted: result.meta.changes || 0,
            },
        });
    } catch (error) {
        console.error('Cleanup logs error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'INTERNAL_ERROR', message: '清理日志失败' },
            },
            500
        );
    }
});

export default logs;
