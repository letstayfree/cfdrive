import { Hono } from 'hono';
import type { Env, User } from '../types';

interface SystemConfig {
    key: string;
    value: string;
    created_at: string;
    updated_at: string;
}

// 可配置的系统设置项（白名单）
const CONFIGURABLE_KEYS = [
    'site_name',
    'site_description',
    'max_upload_size',
    'allowed_file_types',
    'default_share_expiry_days',
    'ip_whitelist_enabled',
] as const;

// 敏感配置项（只能通过环境变量设置）
const SENSITIVE_KEYS = [
    'MS_CLIENT_ID',
    'MS_CLIENT_SECRET',
    'MS_TENANT_ID',
    'JWT_SECRET',
];

const config = new Hono<{ Bindings: Env }>();

/**
 * 获取所有系统配置（仅管理员）
 * GET /api/config
 */
config.get('/', async (c) => {
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

    try {
        const result = await c.env.DB.prepare(
            'SELECT key, value, created_at, updated_at FROM system_config ORDER BY key'
        ).all<SystemConfig>();

        // 过滤掉敏感配置
        const safeConfigs = result.results.filter(
            (cfg) => !SENSITIVE_KEYS.includes(cfg.key)
        );

        return c.json({
            success: true,
            data: {
                items: safeConfigs,
                configurableKeys: CONFIGURABLE_KEYS,
            },
        });
    } catch (error) {
        console.error('Get config error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'INTERNAL_ERROR', message: '获取配置失败' },
            },
            500
        );
    }
});

/**
 * 获取单个配置项
 * GET /api/config/:key
 */
config.get('/:key', async (c) => {
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

    const key = c.req.param('key');

    // 检查是否为敏感配置
    if (SENSITIVE_KEYS.includes(key)) {
        return c.json(
            {
                success: false,
                error: { code: 'FORBIDDEN', message: '无法访问敏感配置' },
            },
            403
        );
    }

    try {
        const result = await c.env.DB.prepare(
            'SELECT key, value, created_at, updated_at FROM system_config WHERE key = ?'
        )
            .bind(key)
            .first<SystemConfig>();

        if (!result) {
            return c.json(
                {
                    success: false,
                    error: { code: 'NOT_FOUND', message: '配置项不存在' },
                },
                404
            );
        }

        return c.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('Get config error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'INTERNAL_ERROR', message: '获取配置失败' },
            },
            500
        );
    }
});

/**
 * 更新配置项（仅管理员）
 * PUT /api/config/:key
 */
config.put('/:key', async (c) => {
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

    const key = c.req.param('key');
    const body = await c.req.json<{ value: string }>();

    // 检查是否为敏感配置
    if (SENSITIVE_KEYS.includes(key)) {
        return c.json(
            {
                success: false,
                error: { code: 'FORBIDDEN', message: '无法修改敏感配置，请通过环境变量设置' },
            },
            403
        );
    }

    // 检查是否为可配置项
    if (!CONFIGURABLE_KEYS.includes(key as any)) {
        return c.json(
            {
                success: false,
                error: { code: 'INVALID_KEY', message: '此配置项不可修改' },
            },
            400
        );
    }

    if (body.value === undefined) {
        return c.json(
            {
                success: false,
                error: { code: 'INVALID_INPUT', message: '请提供配置值' },
            },
            400
        );
    }

    try {
        const now = new Date().toISOString();

        await c.env.DB.prepare(
            `INSERT INTO system_config (key, value, created_at, updated_at)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
        )
            .bind(key, body.value, now, now)
            .run();

        return c.json({
            success: true,
            data: { key, value: body.value, updated_at: now },
        });
    } catch (error) {
        console.error('Update config error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'INTERNAL_ERROR', message: '更新配置失败' },
            },
            500
        );
    }
});

/**
 * 批量更新配置（仅管理员）
 * PUT /api/config
 */
config.put('/', async (c) => {
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

    const body = await c.req.json<Record<string, string>>();

    // 验证所有 key 都是可配置的
    const invalidKeys = Object.keys(body).filter(
        (key) => !CONFIGURABLE_KEYS.includes(key as any) || SENSITIVE_KEYS.includes(key)
    );

    if (invalidKeys.length > 0) {
        return c.json(
            {
                success: false,
                error: { code: 'INVALID_KEYS', message: `以下配置项不可修改: ${invalidKeys.join(', ')}` },
            },
            400
        );
    }

    try {
        const now = new Date().toISOString();
        const updates: { key: string; value: string }[] = [];

        for (const [key, value] of Object.entries(body)) {
            await c.env.DB.prepare(
                `INSERT INTO system_config (key, value, created_at, updated_at)
                 VALUES (?, ?, ?, ?)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
            )
                .bind(key, value, now, now)
                .run();

            updates.push({ key, value });
        }

        return c.json({
            success: true,
            data: { updates, updated_at: now },
        });
    } catch (error) {
        console.error('Batch update config error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'INTERNAL_ERROR', message: '批量更新配置失败' },
            },
            500
        );
    }
});

/**
 * 获取 OneDrive 连接状态
 * GET /api/config/onedrive/status
 */
config.get('/onedrive/status', async (c) => {
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

    try {
        // 检查是否配置了必要的环境变量
        const hasClientId = !!c.env.AZURE_CLIENT_ID;
        const hasClientSecret = !!c.env.AZURE_CLIENT_SECRET;
        const hasTenantId = !!c.env.AZURE_TENANT_ID;

        // 检查是否有有效的 token
        const tokenConfig = await c.env.DB.prepare(
            "SELECT value FROM system_config WHERE key = 'ms_access_token'"
        ).first<{ value: string }>();

        const hasToken = !!tokenConfig?.value;

        // 检查 token 是否过期
        const expiresConfig = await c.env.DB.prepare(
            "SELECT value FROM system_config WHERE key = 'ms_token_expires_at'"
        ).first<{ value: string }>();

        let isTokenValid = false;
        if (expiresConfig?.value) {
            isTokenValid = new Date(expiresConfig.value) > new Date();
        }

        return c.json({
            success: true,
            data: {
                configured: hasClientId && hasClientSecret && hasTenantId,
                connected: hasToken && isTokenValid,
                details: {
                    hasClientId,
                    hasClientSecret,
                    hasTenantId,
                    hasToken,
                    isTokenValid,
                },
            },
        });
    } catch (error) {
        console.error('Get OneDrive status error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'INTERNAL_ERROR', message: '获取状态失败' },
            },
            500
        );
    }
});

export default config;
