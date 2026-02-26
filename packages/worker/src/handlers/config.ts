import { Hono } from 'hono';
import type { Env, User } from '../types';
import { getAzureConfig } from '../services/azure-config';

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

// 敏感配置项（不会在 GET /api/config 列表中返回）
const SENSITIVE_KEYS = [
    'azure_client_id',
    'azure_client_secret',
    'azure_tenant_id',
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
 * 注意：必须在 /:key 路由之前定义
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
        // 从 DB + 环境变量获取 Azure 配置
        const azure = await getAzureConfig(c.env);
        const hasClientId = !!azure.clientId;
        const hasClientSecret = !!azure.clientSecret;
        const hasTenantId = !!azure.tenantId;

        // 检查 KV 中是否有有效的 token
        const tokenInfo = await c.env.CACHE.get('onedrive_token');
        let hasToken = false;
        let isTokenValid = false;

        if (tokenInfo) {
            hasToken = true;
            const token = JSON.parse(tokenInfo) as { expires_at: number };
            isTokenValid = Date.now() < token.expires_at;
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

/**
 * 获取 Azure AD 配置状态
 * GET /api/config/azure
 * 注意：必须在 /:key 路由之前定义
 */
config.get('/azure', async (c) => {
    const user = c.get('user') as User;

    if (user.role !== 'superadmin') {
        return c.json(
            { success: false, error: { code: 'FORBIDDEN', message: '权限不足' } },
            403
        );
    }

    try {
        const azure = await getAzureConfig(c.env);

        return c.json({
            success: true,
            data: {
                clientId: azure.clientId || '',
                // 只返回 secret 的掩码
                clientSecret: azure.clientSecret ? '••••••' + azure.clientSecret.slice(-4) : '',
                tenantId: azure.tenantId || '',
                configured: !!(azure.clientId && azure.clientSecret && azure.tenantId),
            },
        });
    } catch (error) {
        console.error('Get Azure config error:', error);
        return c.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: '获取配置失败' } },
            500
        );
    }
});

/**
 * 保存 Azure AD 配置
 * PUT /api/config/azure
 * 注意：必须在 /:key 路由之前定义
 */
config.put('/azure', async (c) => {
    const user = c.get('user') as User;

    if (user.role !== 'superadmin') {
        return c.json(
            { success: false, error: { code: 'FORBIDDEN', message: '权限不足' } },
            403
        );
    }

    const body = await c.req.json<{
        clientId: string;
        clientSecret: string;
        tenantId: string;
    }>();

    if (!body.clientId || !body.clientSecret || !body.tenantId) {
        return c.json(
            { success: false, error: { code: 'INVALID_INPUT', message: '请填写所有必填项' } },
            400
        );
    }

    try {
        const now = new Date().toISOString();
        const entries: Array<[string, string]> = [
            ['azure_client_id', body.clientId],
            ['azure_tenant_id', body.tenantId],
        ];
        // 仅当 secret 不是占位符时才更新
        if (body.clientSecret !== '__UNCHANGED__') {
            entries.push(['azure_client_secret', body.clientSecret]);
        }

        for (const [key, value] of entries) {
            await c.env.DB.prepare(
                `INSERT INTO system_config (key, value, created_at, updated_at)
                 VALUES (?, ?, ?, ?)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
            ).bind(key, value, now, now).run();
        }

        return c.json({
            success: true,
            data: { message: 'Azure AD 配置已保存', updated_at: now },
        });
    } catch (error) {
        console.error('Update Azure config error:', error);
        return c.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: '保存配置失败' } },
            500
        );
    }
});

/**
 * 获取单个配置项
 * GET /api/config/:key
 * 注意：参数路由必须放在所有具体路由之后
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
 * 注意：参数路由必须放在所有具体路由之后
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

export default config;
