import { Hono } from 'hono';
import type { Env, User, FolderPermission } from '../types';
import { generateId, hashPassword, isPasswordValid } from '../utils';
import { requireAdmin } from '../middleware/permission';

const users = new Hono<{ Bindings: Env }>();

/**
 * 获取用户列表 (仅管理员)
 * GET /api/users
 */
users.get('/', requireAdmin, async (c) => {
    try {
        const page = parseInt(c.req.query('page') || '1');
        const limit = parseInt(c.req.query('limit') || '20');
        const offset = (page - 1) * limit;
        const role = c.req.query('role');
        const status = c.req.query('status');
        const search = c.req.query('search');

        let query = 'SELECT id, email, username, display_name, role, status, avatar_url, last_login_at, created_at, updated_at FROM users WHERE 1=1';
        let countQuery = 'SELECT COUNT(*) as total FROM users WHERE 1=1';
        const params: unknown[] = [];
        const countParams: unknown[] = [];

        if (role) {
            query += ' AND role = ?';
            countQuery += ' AND role = ?';
            params.push(role);
            countParams.push(role);
        }

        if (status) {
            query += ' AND status = ?';
            countQuery += ' AND status = ?';
            params.push(status);
            countParams.push(status);
        }

        if (search) {
            query += ' AND (username LIKE ? OR email LIKE ? OR display_name LIKE ?)';
            countQuery += ' AND (username LIKE ? OR email LIKE ? OR display_name LIKE ?)';
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern, searchPattern);
            countParams.push(searchPattern, searchPattern, searchPattern);
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const [usersResult, countResult] = await Promise.all([
            c.env.DB.prepare(query).bind(...params).all(),
            c.env.DB.prepare(countQuery).bind(...countParams).first<{ total: number }>(),
        ]);

        const total = countResult?.total || 0;

        return c.json({
            success: true,
            data: {
                items: usersResult.results,
                total,
                page,
                limit,
                hasMore: offset + limit < total,
            },
        });
    } catch (error) {
        console.error('Get users error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'GET_USERS_ERROR', message: '获取用户列表失败' },
            },
            500
        );
    }
});

/**
 * 获取单个用户详情 (仅管理员)
 * GET /api/users/:id
 */
users.get('/:id', requireAdmin, async (c) => {
    try {
        const userId = c.req.param('id');

        const user = await c.env.DB.prepare(
            'SELECT id, email, username, display_name, role, status, avatar_url, last_login_at, created_at, updated_at FROM users WHERE id = ?'
        )
            .bind(userId)
            .first();

        if (!user) {
            return c.json(
                {
                    success: false,
                    error: { code: 'USER_NOT_FOUND', message: '用户不存在' },
                },
                404
            );
        }

        // 获取用户权限
        const permissions = await c.env.DB.prepare(
            'SELECT * FROM folder_permissions WHERE user_id = ?'
        )
            .bind(userId)
            .all<FolderPermission>();

        return c.json({
            success: true,
            data: {
                ...user,
                permissions: permissions.results,
            },
        });
    } catch (error) {
        console.error('Get user error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'GET_USER_ERROR', message: '获取用户信息失败' },
            },
            500
        );
    }
});

/**
 * 创建用户 (仅管理员)
 * POST /api/users
 */
users.post('/', requireAdmin, async (c) => {
    try {
        const body = await c.req.json<{
            username: string;
            email: string;
            password: string;
            display_name?: string;
            role: 'collaborator' | 'customer' | 'guest';
        }>();

        // 验证必填字段
        if (!body.username || !body.email || !body.password || !body.role) {
            return c.json(
                {
                    success: false,
                    error: { code: 'INVALID_INPUT', message: '用户名、邮箱、密码和角色为必填项' },
                },
                400
            );
        }

        // 验证角色 (不能创建 superadmin)
        if (!['collaborator', 'customer', 'guest'].includes(body.role)) {
            return c.json(
                {
                    success: false,
                    error: { code: 'INVALID_ROLE', message: '无效的角色' },
                },
                400
            );
        }

        // 验证用户名格式
        if (!/^[a-zA-Z0-9_]{3,20}$/.test(body.username)) {
            return c.json(
                {
                    success: false,
                    error: { code: 'INVALID_USERNAME', message: '用户名只能包含字母、数字和下划线，长度3-20' },
                },
                400
            );
        }

        // 验证邮箱格式
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
            return c.json(
                {
                    success: false,
                    error: { code: 'INVALID_EMAIL', message: '邮箱格式不正确' },
                },
                400
            );
        }

        // 验证密码强度
        const passwordCheck = isPasswordValid(body.password);
        if (!passwordCheck.valid) {
            return c.json(
                {
                    success: false,
                    error: { code: 'WEAK_PASSWORD', message: '密码强度不足' },
                    data: { feedback: passwordCheck.feedback },
                },
                400
            );
        }

        // 检查用户名和邮箱是否已存在
        const existing = await c.env.DB.prepare(
            'SELECT id FROM users WHERE username = ? OR email = ?'
        )
            .bind(body.username, body.email)
            .first();

        if (existing) {
            return c.json(
                {
                    success: false,
                    error: { code: 'USER_EXISTS', message: '用户名或邮箱已被使用' },
                },
                400
            );
        }

        // 创建用户
        const userId = generateId();
        const passwordHash = await hashPassword(body.password);
        const now = new Date().toISOString();

        await c.env.DB.prepare(
            `INSERT INTO users (id, email, username, password_hash, display_name, role, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`
        )
            .bind(userId, body.email, body.username, passwordHash, body.display_name || body.username, body.role, now, now)
            .run();

        return c.json({
            success: true,
            data: {
                id: userId,
                username: body.username,
                email: body.email,
                display_name: body.display_name || body.username,
                role: body.role,
                status: 'active',
                created_at: now,
            },
        });
    } catch (error) {
        console.error('Create user error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'CREATE_USER_ERROR', message: '创建用户失败' },
            },
            500
        );
    }
});

/**
 * 更新用户 (仅管理员)
 * PUT /api/users/:id
 */
users.put('/:id', requireAdmin, async (c) => {
    try {
        const userId = c.req.param('id');
        const currentUser = c.get('user') as User;

        // 不能修改自己的角色
        if (userId === currentUser.id) {
            const body = await c.req.json<{ role?: string }>();
            if (body.role && body.role !== currentUser.role) {
                return c.json(
                    {
                        success: false,
                        error: { code: 'CANNOT_CHANGE_OWN_ROLE', message: '不能修改自己的角色' },
                    },
                    400
                );
            }
        }

        const body = await c.req.json<{
            display_name?: string;
            role?: 'superadmin' | 'collaborator' | 'customer' | 'guest';
            status?: 'active' | 'disabled';
        }>();

        // 检查用户是否存在
        const existingUser = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
            .bind(userId)
            .first<User>();

        if (!existingUser) {
            return c.json(
                {
                    success: false,
                    error: { code: 'USER_NOT_FOUND', message: '用户不存在' },
                },
                404
            );
        }

        // 构建更新语句
        const updates: string[] = [];
        const params: unknown[] = [];

        if (body.display_name !== undefined) {
            updates.push('display_name = ?');
            params.push(body.display_name);
        }

        if (body.role !== undefined) {
            updates.push('role = ?');
            params.push(body.role);
        }

        if (body.status !== undefined) {
            updates.push('status = ?');
            params.push(body.status);
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

        updates.push('updated_at = ?');
        params.push(new Date().toISOString());
        params.push(userId);

        await c.env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`)
            .bind(...params)
            .run();

        // 如果禁用用户，删除其所有会话
        if (body.status === 'disabled') {
            await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run();
        }

        return c.json({
            success: true,
            data: { message: '用户更新成功' },
        });
    } catch (error) {
        console.error('Update user error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'UPDATE_USER_ERROR', message: '更新用户失败' },
            },
            500
        );
    }
});

/**
 * 删除用户 (仅管理员)
 * DELETE /api/users/:id
 */
users.delete('/:id', requireAdmin, async (c) => {
    try {
        const userId = c.req.param('id');
        const currentUser = c.get('user') as User;

        // 不能删除自己
        if (userId === currentUser.id) {
            return c.json(
                {
                    success: false,
                    error: { code: 'CANNOT_DELETE_SELF', message: '不能删除自己' },
                },
                400
            );
        }

        // 检查用户是否存在
        const existingUser = await c.env.DB.prepare('SELECT id, role FROM users WHERE id = ?')
            .bind(userId)
            .first<User>();

        if (!existingUser) {
            return c.json(
                {
                    success: false,
                    error: { code: 'USER_NOT_FOUND', message: '用户不存在' },
                },
                404
            );
        }

        // 不能删除其他超级管理员
        if (existingUser.role === 'superadmin') {
            return c.json(
                {
                    success: false,
                    error: { code: 'CANNOT_DELETE_SUPERADMIN', message: '不能删除超级管理员' },
                },
                400
            );
        }

        // 删除用户 (级联删除会话和权限)
        await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();

        return c.json({
            success: true,
            data: { message: '用户删除成功' },
        });
    } catch (error) {
        console.error('Delete user error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'DELETE_USER_ERROR', message: '删除用户失败' },
            },
            500
        );
    }
});

/**
 * 设置用户权限 (仅管理员)
 * PUT /api/users/:id/permissions
 */
users.put('/:id/permissions', requireAdmin, async (c) => {
    try {
        const userId = c.req.param('id');
        const currentUser = c.get('user') as User;

        const body = await c.req.json<{
            permissions: Array<{
                folder_id: string;
                folder_path: string;
                permission: 'crud' | 'rd' | 'r';
            }>;
        }>();

        // 检查用户是否存在
        const existingUser = await c.env.DB.prepare('SELECT id, role FROM users WHERE id = ?')
            .bind(userId)
            .first<User>();

        if (!existingUser) {
            return c.json(
                {
                    success: false,
                    error: { code: 'USER_NOT_FOUND', message: '用户不存在' },
                },
                404
            );
        }

        // 超级管理员不需要设置权限
        if (existingUser.role === 'superadmin') {
            return c.json(
                {
                    success: false,
                    error: { code: 'SUPERADMIN_NO_NEED', message: '超级管理员拥有所有权限' },
                },
                400
            );
        }

        // 删除现有权限
        await c.env.DB.prepare('DELETE FROM folder_permissions WHERE user_id = ?').bind(userId).run();

        // 添加新权限
        const now = new Date().toISOString();
        for (const perm of body.permissions || []) {
            const permId = generateId();
            await c.env.DB.prepare(
                `INSERT INTO folder_permissions (id, user_id, folder_id, folder_path, permission, granted_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
            )
                .bind(permId, userId, perm.folder_id, perm.folder_path, perm.permission, currentUser.id, now)
                .run();
        }

        return c.json({
            success: true,
            data: { message: '权限设置成功' },
        });
    } catch (error) {
        console.error('Set permissions error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'SET_PERMISSIONS_ERROR', message: '设置权限失败' },
            },
            500
        );
    }
});

/**
 * 重置用户密码 (仅管理员)
 * POST /api/users/:id/reset-password
 */
users.post('/:id/reset-password', requireAdmin, async (c) => {
    try {
        const userId = c.req.param('id');

        const body = await c.req.json<{ new_password: string }>();

        if (!body.new_password) {
            return c.json(
                {
                    success: false,
                    error: { code: 'INVALID_INPUT', message: '请提供新密码' },
                },
                400
            );
        }

        // 验证密码强度
        const passwordCheck = isPasswordValid(body.new_password);
        if (!passwordCheck.valid) {
            return c.json(
                {
                    success: false,
                    error: { code: 'WEAK_PASSWORD', message: '密码强度不足' },
                    data: { feedback: passwordCheck.feedback },
                },
                400
            );
        }

        // 检查用户是否存在
        const existingUser = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?')
            .bind(userId)
            .first();

        if (!existingUser) {
            return c.json(
                {
                    success: false,
                    error: { code: 'USER_NOT_FOUND', message: '用户不存在' },
                },
                404
            );
        }

        // 更新密码
        const passwordHash = await hashPassword(body.new_password);
        await c.env.DB.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
            .bind(passwordHash, new Date().toISOString(), userId)
            .run();

        // 清除该用户所有会话
        await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run();

        return c.json({
            success: true,
            data: { message: '密码重置成功' },
        });
    } catch (error) {
        console.error('Reset password error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'RESET_PASSWORD_ERROR', message: '重置密码失败' },
            },
            500
        );
    }
});

export const userRoutes = users;
