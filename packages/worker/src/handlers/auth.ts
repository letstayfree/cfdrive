import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env, User, Session } from '../types';
import { generateId, generateToken, hashPassword, hashToken, verifyPassword, verifyToken } from '../utils';
import { logAccess } from '../services/audit';

const auth = new Hono<{ Bindings: Env }>();

// 辅助函数：验证 token 并获取用户
async function authenticateRequest(c: Context<{ Bindings: Env }>): Promise<User | null> {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.slice(7);
    try {
        const payload = await verifyToken(token, c.env.JWT_SECRET);
        if (!payload || !payload.userId) {
            return null;
        }

        // 验证会话是否存在
        const tokenHash = await hashToken(token);
        const session = await c.env.DB.prepare(
            'SELECT * FROM sessions WHERE token_hash = ? AND expires_at > ?'
        )
            .bind(tokenHash, new Date().toISOString())
            .first<Session>();

        if (!session) {
            return null;
        }

        // 获取用户
        const user = await c.env.DB.prepare(
            'SELECT * FROM users WHERE id = ? AND status = ?'
        )
            .bind(payload.userId, 'active')
            .first<User>();

        return user || null;
    } catch {
        return null;
    }
}

/**
 * 用户登录
 * POST /api/auth/login
 */
auth.post('/login', async (c) => {
    try {
        const body = await c.req.json<{
            username: string;
            password: string;
        }>();

        if (!body.username || !body.password) {
            return c.json(
                {
                    success: false,
                    error: { code: 'INVALID_INPUT', message: '用户名和密码为必填项' },
                },
                400
            );
        }

        // 查找用户 (支持用户名或邮箱登录)
        const user = await c.env.DB.prepare(
            'SELECT * FROM users WHERE (username = ? OR email = ?) AND status = ?'
        )
            .bind(body.username, body.username, 'active')
            .first<User>();

        if (!user) {
            return c.json(
                {
                    success: false,
                    error: { code: 'INVALID_CREDENTIALS', message: '用户名或密码错误' },
                },
                401
            );
        }

        // 验证密码
        const passwordValid = await verifyPassword(body.password, user.password_hash);
        if (!passwordValid) {
            return c.json(
                {
                    success: false,
                    error: { code: 'INVALID_CREDENTIALS', message: '用户名或密码错误' },
                },
                401
            );
        }

        // 生成访问令牌
        const token = await generateToken(
            { userId: user.id, role: user.role },
            c.env.JWT_SECRET,
            7 * 24 * 60 * 60 // 7 天
        );

        // 创建会话记录
        const sessionId = generateId();
        const tokenHash = await hashToken(token);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const ipAddress = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || null;
        const userAgent = c.req.header('User-Agent') || null;

        await c.env.DB.prepare(
            `INSERT INTO sessions (id, user_id, token_hash, ip_address, user_agent, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
            .bind(sessionId, user.id, tokenHash, ipAddress, userAgent, expiresAt, new Date().toISOString())
            .run();

        // 更新最后登录时间
        await c.env.DB.prepare('UPDATE users SET last_login_at = ? WHERE id = ?')
            .bind(new Date().toISOString(), user.id)
            .run();

        // 记录登录日志
        await logAccess(c.env.DB, user.id, 'login', 'user', user.id, null, c.req.raw);

        return c.json({
            success: true,
            data: {
                token,
                expiresAt,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    display_name: user.display_name,
                    role: user.role,
                    avatar_url: user.avatar_url,
                },
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'LOGIN_ERROR', message: '登录失败' },
            },
            500
        );
    }
});

/**
 * 用户登出
 * POST /api/auth/logout
 */
auth.post('/logout', async (c) => {
    try {
        const authHeader = c.req.header('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.slice(7);
            const tokenHash = await hashToken(token);

            // 删除会话
            await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();

            // 记录登出日志（需要先解码 token 获取用户 ID，但这里简化处理，如果需要精确的用户ID，需要在 session 表被删除前查询）
            // 尝试获取当前用户
            const payload = await verifyToken(token, c.env.JWT_SECRET);
            if (payload && payload.userId) {
                await logAccess(c.env.DB, payload.userId as string, 'logout', 'user', payload.userId as string, null, c.req.raw);
            }
        }

        return c.json({
            success: true,
            data: { message: '已登出' },
        });
    } catch (error) {
        console.error('Logout error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'LOGOUT_ERROR', message: '登出失败' },
            },
            500
        );
    }
});

/**
 * 刷新令牌
 * POST /api/auth/refresh
 */
auth.post('/refresh', async (c) => {
    try {
        const authHeader = c.req.header('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return c.json(
                {
                    success: false,
                    error: { code: 'NO_TOKEN', message: '未提供令牌' },
                },
                401
            );
        }

        const oldToken = authHeader.slice(7);
        const { verifyToken } = await import('../utils');
        const payload = await verifyToken(oldToken, c.env.JWT_SECRET);

        if (!payload || !payload.userId) {
            return c.json(
                {
                    success: false,
                    error: { code: 'INVALID_TOKEN', message: '无效的令牌' },
                },
                401
            );
        }

        // 获取用户
        const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ? AND status = ?')
            .bind(payload.userId, 'active')
            .first<User>();

        if (!user) {
            return c.json(
                {
                    success: false,
                    error: { code: 'USER_NOT_FOUND', message: '用户不存在' },
                },
                401
            );
        }

        // 生成新令牌
        const newToken = await generateToken(
            { userId: user.id, role: user.role },
            c.env.JWT_SECRET,
            7 * 24 * 60 * 60
        );

        // 更新会话
        const oldTokenHash = await hashToken(oldToken);
        const newTokenHash = await hashToken(newToken);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        await c.env.DB.prepare('UPDATE sessions SET token_hash = ?, expires_at = ? WHERE token_hash = ?')
            .bind(newTokenHash, expiresAt, oldTokenHash)
            .run();

        return c.json({
            success: true,
            data: {
                token: newToken,
                expiresAt,
            },
        });
    } catch (error) {
        console.error('Refresh error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'REFRESH_ERROR', message: '刷新令牌失败' },
            },
            500
        );
    }
});

/**
 * 获取当前用户信息
 * GET /api/auth/me
 */
auth.get('/me', async (c) => {
    // 手动验证认证（因为此路由在认证中间件之前注册）
    const user = await authenticateRequest(c);

    if (!user) {
        return c.json(
            {
                success: false,
                error: { code: 'UNAUTHORIZED', message: '未认证' },
            },
            401
        );
    }

    return c.json({
        success: true,
        data: {
            id: user.id,
            username: user.username,
            email: user.email,
            display_name: user.display_name,
            role: user.role,
            avatar_url: user.avatar_url,
            last_login_at: user.last_login_at,
            created_at: user.created_at,
        },
    });
});

/**
 * 修改密码
 * PUT /api/auth/password
 */
auth.put('/password', async (c) => {
    const user = await authenticateRequest(c);

    if (!user) {
        return c.json(
            {
                success: false,
                error: { code: 'UNAUTHORIZED', message: '未认证' },
            },
            401
        );
    }

    try {
        const body = await c.req.json<{
            current_password: string;
            new_password: string;
        }>();

        if (!body.current_password || !body.new_password) {
            return c.json(
                {
                    success: false,
                    error: { code: 'INVALID_INPUT', message: '请提供当前密码和新密码' },
                },
                400
            );
        }

        // 验证当前密码
        const passwordValid = await verifyPassword(body.current_password, user.password_hash);
        if (!passwordValid) {
            return c.json(
                {
                    success: false,
                    error: { code: 'INVALID_PASSWORD', message: '当前密码错误' },
                },
                400
            );
        }

        // 验证新密码强度
        const { isPasswordValid: checkPassword } = await import('../utils');
        const passwordCheck = checkPassword(body.new_password);
        if (!passwordCheck.valid) {
            return c.json(
                {
                    success: false,
                    error: { code: 'WEAK_PASSWORD', message: '新密码强度不足' },
                    data: { feedback: passwordCheck.feedback },
                },
                400
            );
        }

        // 更新密码
        const newPasswordHash = await hashPassword(body.new_password);
        await c.env.DB.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
            .bind(newPasswordHash, new Date().toISOString(), user.id)
            .run();

        // 清除其他会话
        const authHeader = c.req.header('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const currentToken = authHeader.slice(7);
            const currentTokenHash = await hashToken(currentToken);
            await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?')
                .bind(user.id, currentTokenHash)
                .run();
        }

        return c.json({
            success: true,
            data: { message: '密码修改成功' },
        });
    } catch (error) {
        console.error('Change password error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'PASSWORD_ERROR', message: '修改密码失败' },
            },
            500
        );
    }
});

export const authRoutes = auth;
