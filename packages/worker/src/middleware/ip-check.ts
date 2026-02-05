import type { Context, Next } from 'hono';
import type { Env } from '../types';
import { matchIpPattern } from '../handlers/security';

interface IpWhitelistEntry {
    id: string;
    ip_pattern: string;
    is_active: number;
}

/**
 * IP 白名单检查中间件
 * 如果启用了 IP 白名单，则检查请求 IP 是否在白名单中
 */
export const ipCheckMiddleware = async (c: Context<{ Bindings: Env }>, next: Next) => {
    try {
        // 检查是否启用了 IP 白名单
        const config = await c.env.DB.prepare(
            "SELECT value FROM system_config WHERE key = 'ip_whitelist_enabled'"
        ).first<{ value: string }>();

        // 如果未启用，直接放行
        if (!config || config.value !== 'true') {
            return next();
        }

        // 获取请求 IP
        const clientIp = getClientIp(c);

        if (!clientIp) {
            // 无法获取 IP，可能是内部请求，放行
            console.warn('IP whitelist: Could not determine client IP');
            return next();
        }

        // 获取白名单规则
        const rules = await c.env.DB.prepare(
            'SELECT id, ip_pattern, is_active FROM ip_whitelist WHERE is_active = 1'
        ).all<IpWhitelistEntry>();

        // 检查 IP 是否匹配任何规则
        const isAllowed = rules.results.some(rule => matchIpPattern(clientIp, rule.ip_pattern));

        if (!isAllowed) {
            console.warn(`IP whitelist: Blocked request from ${clientIp}`);
            return c.json(
                {
                    success: false,
                    error: {
                        code: 'IP_BLOCKED',
                        message: '您的 IP 地址不在允许访问的白名单中',
                    },
                },
                403
            );
        }

        return next();
    } catch (error) {
        console.error('IP check middleware error:', error);
        // 发生错误时放行，避免阻断服务
        return next();
    }
};

/**
 * 获取客户端 IP 地址
 */
function getClientIp(c: Context<{ Bindings: Env }>): string | null {
    // Cloudflare 提供的真实 IP
    const cfIp = c.req.header('CF-Connecting-IP');
    if (cfIp) return cfIp;

    // X-Forwarded-For 头（可能包含多个 IP，取第一个）
    const forwardedFor = c.req.header('X-Forwarded-For');
    if (forwardedFor) {
        const ips = forwardedFor.split(',').map(ip => ip.trim());
        return ips[0] || null;
    }

    // X-Real-IP 头
    const realIp = c.req.header('X-Real-IP');
    if (realIp) return realIp;

    return null;
}
