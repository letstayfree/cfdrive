import { Hono } from 'hono';
import type { Env, User } from '../types';
import { generateId } from '../utils';

interface IpWhitelistEntry {
    id: string;
    ip_pattern: string;
    description: string | null;
    created_by: string;
    is_active: number;
    created_at: string;
}

const security = new Hono<{ Bindings: Env }>();

/**
 * 获取 IP 白名单列表（仅管理员）
 * GET /api/security/ip-whitelist
 */
security.get('/ip-whitelist', async (c) => {
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
            'SELECT * FROM ip_whitelist ORDER BY created_at DESC'
        ).all<IpWhitelistEntry>();

        // 获取 IP 白名单开关状态
        const config = await c.env.DB.prepare(
            "SELECT value FROM system_config WHERE key = 'ip_whitelist_enabled'"
        ).first<{ value: string }>();

        const isEnabled = config?.value === 'true';

        return c.json({
            success: true,
            data: {
                enabled: isEnabled,
                items: result.results,
            },
        });
    } catch (error) {
        console.error('Get IP whitelist error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'INTERNAL_ERROR', message: '获取 IP 白名单失败' },
            },
            500
        );
    }
});

/**
 * 添加 IP 白名单规则（仅管理员）
 * POST /api/security/ip-whitelist
 */
security.post('/ip-whitelist', async (c) => {
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
        const body = await c.req.json<{
            ip_pattern: string;
            description?: string;
        }>();

        if (!body.ip_pattern) {
            return c.json(
                {
                    success: false,
                    error: { code: 'INVALID_INPUT', message: 'IP 地址为必填项' },
                },
                400
            );
        }

        // 验证 IP 格式（支持单 IP、CIDR、通配符）
        const ipPattern = body.ip_pattern.trim();
        if (!isValidIpPattern(ipPattern)) {
            return c.json(
                {
                    success: false,
                    error: { code: 'INVALID_IP', message: 'IP 格式无效，支持单IP、CIDR(如192.168.1.0/24)或通配符(如192.168.*)' },
                },
                400
            );
        }

        // 检查是否已存在
        const existing = await c.env.DB.prepare(
            'SELECT id FROM ip_whitelist WHERE ip_pattern = ?'
        )
            .bind(ipPattern)
            .first();

        if (existing) {
            return c.json(
                {
                    success: false,
                    error: { code: 'DUPLICATE', message: '该 IP 规则已存在' },
                },
                400
            );
        }

        const id = generateId();
        await c.env.DB.prepare(
            `INSERT INTO ip_whitelist (id, ip_pattern, description, created_by, is_active, created_at)
             VALUES (?, ?, ?, ?, 1, ?)`
        )
            .bind(id, ipPattern, body.description || null, user.id, new Date().toISOString())
            .run();

        return c.json({
            success: true,
            data: {
                id,
                ip_pattern: ipPattern,
                description: body.description || null,
                is_active: 1,
            },
        });
    } catch (error) {
        console.error('Add IP whitelist error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'INTERNAL_ERROR', message: '添加 IP 白名单失败' },
            },
            500
        );
    }
});

/**
 * 删除 IP 白名单规则（仅管理员）
 * DELETE /api/security/ip-whitelist/:id
 */
security.delete('/ip-whitelist/:id', async (c) => {
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
        const id = c.req.param('id');

        const existing = await c.env.DB.prepare('SELECT id FROM ip_whitelist WHERE id = ?')
            .bind(id)
            .first();

        if (!existing) {
            return c.json(
                {
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'IP 规则不存在' },
                },
                404
            );
        }

        await c.env.DB.prepare('DELETE FROM ip_whitelist WHERE id = ?').bind(id).run();

        return c.json({
            success: true,
            data: { message: 'IP 规则已删除' },
        });
    } catch (error) {
        console.error('Delete IP whitelist error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'INTERNAL_ERROR', message: '删除 IP 白名单失败' },
            },
            500
        );
    }
});

/**
 * 切换 IP 白名单开关（仅管理员）
 * PUT /api/security/ip-whitelist/toggle
 */
security.put('/ip-whitelist/toggle', async (c) => {
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
        const body = await c.req.json<{ enabled: boolean }>();

        // 如果要启用白名单，确保至少有一条规则
        if (body.enabled) {
            const count = await c.env.DB.prepare(
                'SELECT COUNT(*) as count FROM ip_whitelist WHERE is_active = 1'
            ).first<{ count: number }>();

            if (!count || count.count === 0) {
                return c.json(
                    {
                        success: false,
                        error: { code: 'NO_RULES', message: '请先添加至少一条 IP 规则再启用白名单' },
                    },
                    400
                );
            }
        }

        // 更新或插入配置
        await c.env.DB.prepare(
            `INSERT INTO system_config (key, value, updated_at) 
             VALUES ('ip_whitelist_enabled', ?, ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
        )
            .bind(body.enabled ? 'true' : 'false', new Date().toISOString())
            .run();

        return c.json({
            success: true,
            data: { enabled: body.enabled },
        });
    } catch (error) {
        console.error('Toggle IP whitelist error:', error);
        return c.json(
            {
                success: false,
                error: { code: 'INTERNAL_ERROR', message: '切换 IP 白名单失败' },
            },
            500
        );
    }
});

/**
 * 验证 IP 模式是否有效
 */
function isValidIpPattern(pattern: string): boolean {
    // 单 IPv4 地址
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    // CIDR 格式
    const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
    // 通配符格式 (如 192.168.* 或 192.168.1.*)
    const wildcardRegex = /^(\d{1,3}\.){1,3}\*$/;

    if (ipv4Regex.test(pattern)) {
        // 验证每个数字范围
        const parts = pattern.split('.');
        return parts.every(part => {
            const num = parseInt(part, 10);
            return num >= 0 && num <= 255;
        });
    }

    if (cidrRegex.test(pattern)) {
        const [ip, prefix] = pattern.split('/');
        const prefixNum = parseInt(prefix, 10);
        if (prefixNum < 0 || prefixNum > 32) return false;

        const parts = ip.split('.');
        return parts.every(part => {
            const num = parseInt(part, 10);
            return num >= 0 && num <= 255;
        });
    }

    if (wildcardRegex.test(pattern)) {
        const parts = pattern.replace('*', '').split('.').filter(p => p);
        return parts.every(part => {
            const num = parseInt(part, 10);
            return num >= 0 && num <= 255;
        });
    }

    return false;
}

/**
 * 检查 IP 是否匹配白名单规则
 */
export function matchIpPattern(ip: string, pattern: string): boolean {
    // 单 IP 匹配
    if (ip === pattern) return true;

    // 通配符匹配
    if (pattern.endsWith('*')) {
        const prefix = pattern.slice(0, -1);
        return ip.startsWith(prefix);
    }

    // CIDR 匹配
    if (pattern.includes('/')) {
        return matchCidr(ip, pattern);
    }

    return false;
}

/**
 * CIDR 匹配
 */
function matchCidr(ip: string, cidr: string): boolean {
    const [range, prefixStr] = cidr.split('/');
    const prefix = parseInt(prefixStr, 10);

    const ipNum = ipToNumber(ip);
    const rangeNum = ipToNumber(range);

    if (ipNum === null || rangeNum === null) return false;

    const mask = ~(Math.pow(2, 32 - prefix) - 1);
    return (ipNum & mask) === (rangeNum & mask);
}

/**
 * IP 转数字
 */
function ipToNumber(ip: string): number | null {
    const parts = ip.split('.');
    if (parts.length !== 4) return null;

    let result = 0;
    for (const part of parts) {
        const num = parseInt(part, 10);
        if (isNaN(num) || num < 0 || num > 255) return null;
        result = (result << 8) + num;
    }
    return result >>> 0; // 转为无符号整数
}

export default security;
