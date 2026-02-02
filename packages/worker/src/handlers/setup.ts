import { Hono } from 'hono';
import type { Env } from '../types';
import { generateId, hashPassword, isPasswordValid } from '../utils';

const setup = new Hono<{ Bindings: Env }>();

/**
 * 初始设置 - 创建超级管理员账户
 * POST /api/setup/init
 */
setup.post('/init', async (c) => {
    try {
        // 检查是否已初始化
        const initialized = await c.env.DB.prepare(
            "SELECT value FROM system_config WHERE key = 'initialized'"
        ).first<{ value: string }>();

        if (initialized?.value === 'true') {
            return c.json(
                {
                    success: false,
                    error: { code: 'ALREADY_INITIALIZED', message: '系统已完成初始化' },
                },
                400
            );
        }

        // 解析请求体
        const body = await c.req.json<{
            username: string;
            email: string;
            password: string;
            display_name?: string;
        }>();

        // 验证必填字段
        if (!body.username || !body.email || !body.password) {
            return c.json(
                {
                    success: false,
                    error: { code: 'INVALID_INPUT', message: '用户名、邮箱和密码为必填项' },
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
                    error: {
                        code: 'WEAK_PASSWORD',
                        message: '密码强度不足',
                    },
                    data: { feedback: passwordCheck.feedback },
                },
                400
            );
        }

        // 哈希密码
        const passwordHash = await hashPassword(body.password);

        // 创建管理员用户
        const userId = generateId();
        const now = new Date().toISOString();

        await c.env.DB.prepare(
            `INSERT INTO users (id, email, username, password_hash, display_name, role, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'superadmin', 'active', ?, ?)`
        )
            .bind(userId, body.email, body.username, passwordHash, body.display_name || body.username, now, now)
            .run();

        // 设置系统已初始化
        await c.env.DB.prepare(
            `INSERT OR REPLACE INTO system_config (key, value, created_at, updated_at)
       VALUES ('initialized', 'true', ?, ?)`
        )
            .bind(now, now)
            .run();

        return c.json({
            success: true,
            data: {
                message: '系统初始化成功',
                user: {
                    id: userId,
                    username: body.username,
                    email: body.email,
                    role: 'superadmin',
                },
            },
        });
    } catch (error) {
        console.error('Setup error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'SETUP_ERROR', message: '初始化失败' },
            },
            500
        );
    }
});

/**
 * 检查密码强度
 * POST /api/setup/check-password
 */
setup.post('/check-password', async (c) => {
    const body = await c.req.json<{ password: string }>();

    if (!body.password) {
        return c.json(
            {
                success: false,
                error: { code: 'INVALID_INPUT', message: '请提供密码' },
            },
            400
        );
    }

    // 使用更详细的检查
    const { checkPasswordStrength } = await import('../utils');
    const result = checkPasswordStrength(body.password);

    return c.json({
        success: true,
        data: result,
    });
});

export const setupRoutes = setup;
