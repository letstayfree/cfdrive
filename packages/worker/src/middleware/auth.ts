import type { Context, Next } from 'hono';
import type { Env, User } from '../types';
import { verifyToken } from '../utils';

// 扩展 Context 的类型以包含用户信息
declare module 'hono' {
    interface ContextVariableMap {
        user: User;
        userId: string;
    }
}

/**
 * 认证中间件
 * 验证 Authorization header 中的 Bearer token
 */
export async function authMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
    const authHeader = c.req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json(
            {
                success: false,
                error: { code: 'UNAUTHORIZED', message: '未提供认证令牌' },
            },
            401
        );
    }

    const token = authHeader.slice(7); // 移除 "Bearer " 前缀

    try {
        // 验证 JWT
        const payload = await verifyToken(token, c.env.JWT_SECRET);
        if (!payload || !payload.userId) {
            return c.json(
                {
                    success: false,
                    error: { code: 'INVALID_TOKEN', message: '无效的认证令牌' },
                },
                401
            );
        }

        // 从数据库获取用户信息
        const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ? AND status = ?')
            .bind(payload.userId, 'active')
            .first<User>();

        if (!user) {
            return c.json(
                {
                    success: false,
                    error: { code: 'USER_NOT_FOUND', message: '用户不存在或已被禁用' },
                },
                401
            );
        }

        // 将用户信息添加到上下文
        c.set('user', user);
        c.set('userId', user.id);

        await next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'AUTH_ERROR', message: '认证失败' },
            },
            401
        );
    }
}

/**
 * 可选认证中间件
 * 如果提供了 token 则验证，否则允许匿名访问
 */
export async function optionalAuthMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
    const authHeader = c.req.header('Authorization');

    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        try {
            const payload = await verifyToken(token, c.env.JWT_SECRET);
            if (payload && payload.userId) {
                const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ? AND status = ?')
                    .bind(payload.userId, 'active')
                    .first<User>();
                if (user) {
                    c.set('user', user);
                    c.set('userId', user.id);
                }
            }
        } catch {
            // 忽略错误，允许匿名访问
        }
    }

    await next();
}
