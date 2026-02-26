import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { Env } from '../types';
import { generateId, generateToken } from '../utils';
import { getAzureConfig } from '../services/azure-config';

const oauth = new Hono<{ Bindings: Env }>();

// Microsoft OAuth 端点
const AUTHORIZE_URL = 'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize';
const TOKEN_URL = 'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token';

// 所需权限范围
const SCOPES = [
    'offline_access',
    'Files.Read',
    'Files.Read.All',
    'Files.ReadWrite',
    'Files.ReadWrite.All',
].join(' ');

/**
 * 开始 OAuth 授权流程
 * GET /api/oauth/authorize
 */
oauth.get('/authorize', async (c) => {
    const azure = await getAzureConfig(c.env);
    const redirectUri = `${c.env.APP_URL}/api/oauth/callback`;

    // 生成状态参数防止 CSRF
    const state = generateId();

    // 存储 state 到 cookie
    setCookie(c, 'oauth_state', state, {
        path: '/',
        httpOnly: true,
        secure: c.env.NODE_ENV === 'production',
        maxAge: 600, // 10分钟
        sameSite: 'Lax',
    });

    const authorizeUrl = AUTHORIZE_URL.replace('{tenant}', azure.tenantId);
    const params = new URLSearchParams({
        client_id: azure.clientId,
        response_type: 'code',
        redirect_uri: redirectUri,
        scope: SCOPES,
        state: state,
        response_mode: 'query',
    });

    return c.redirect(`${authorizeUrl}?${params.toString()}`);
});

/**
 * OAuth 回调处理
 * GET /api/oauth/callback
 */
oauth.get('/callback', async (c) => {
    const code = c.req.query('code');
    const state = c.req.query('state');
    const error = c.req.query('error');
    const errorDescription = c.req.query('error_description');

    // 检查错误
    if (error) {
        console.error('OAuth error:', error, errorDescription);
        return c.redirect(`${c.env.APP_URL}/login?error=${encodeURIComponent(errorDescription || error)}`);
    }

    // 验证 state
    const savedState = getCookie(c, 'oauth_state');
    if (!state || state !== savedState) {
        return c.redirect(`${c.env.APP_URL}/login?error=invalid_state`);
    }

    // 清除 state cookie
    deleteCookie(c, 'oauth_state', { path: '/' });

    if (!code) {
        return c.redirect(`${c.env.APP_URL}/login?error=no_code`);
    }

    try {
        // 交换 code 获取 token
        const azure = await getAzureConfig(c.env);
        const tokenUrl = TOKEN_URL.replace('{tenant}', azure.tenantId);
        const redirectUri = `${c.env.APP_URL}/api/oauth/callback`;

        const tokenResponse = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: azure.clientId,
                client_secret: azure.clientSecret,
                code: code,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
                scope: SCOPES,
            }),
        });

        if (!tokenResponse.ok) {
            const errorData = await tokenResponse.json() as { error_description?: string };
            console.error('Token exchange error:', errorData);
            return c.redirect(`${c.env.APP_URL}/login?error=${encodeURIComponent(errorData.error_description || 'token_exchange_failed')}`);
        }

        const tokenData = await tokenResponse.json() as {
            access_token: string;
            refresh_token: string;
            expires_in: number;
        };

        // 存储 tokens 到 KV (以系统级别存储，供所有用户使用)
        const tokenInfo = {
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_at: Date.now() + tokenData.expires_in * 1000,
        };

        await c.env.CACHE.put('onedrive_token', JSON.stringify(tokenInfo), {
            expirationTtl: 60 * 60 * 24 * 30, // 30天
        });

        // 更新系统配置
        const now = new Date().toISOString();
        await c.env.DB.prepare(
            `INSERT OR REPLACE INTO system_config (key, value, created_at, updated_at)
       VALUES ('onedrive_connected', 'true', ?, ?)`
        ).bind(now, now).run();

        return c.redirect(`${c.env.APP_URL}/drive?connected=true`);
    } catch (error) {
        console.error('OAuth callback error:', error);
        return c.redirect(`${c.env.APP_URL}/login?error=callback_failed`);
    }
});

/**
 * 检查 OneDrive 连接状态
 * GET /api/oauth/status
 */
oauth.get('/status', async (c) => {
    try {
        const tokenInfo = await c.env.CACHE.get('onedrive_token');

        if (!tokenInfo) {
            return c.json({
                success: true,
                data: { connected: false },
            });
        }

        const token = JSON.parse(tokenInfo) as {
            access_token: string;
            refresh_token: string;
            expires_at: number;
        };

        // 检查 token 是否过期
        const isExpired = Date.now() > token.expires_at;

        return c.json({
            success: true,
            data: {
                connected: true,
                expired: isExpired,
            },
        });
    } catch (error) {
        console.error('Check status error:', error);
        return c.json({
            success: true,
            data: { connected: false },
        });
    }
});

/**
 * 刷新 Access Token
 * POST /api/oauth/refresh
 */
oauth.post('/refresh', async (c) => {
    try {
        const tokenInfo = await c.env.CACHE.get('onedrive_token');

        if (!tokenInfo) {
            return c.json({
                success: false,
                error: { code: 'NOT_CONNECTED', message: '未连接 OneDrive' },
            }, 401);
        }

        const token = JSON.parse(tokenInfo) as {
            access_token: string;
            refresh_token: string;
            expires_at: number;
        };

        const azure = await getAzureConfig(c.env);
        const tokenUrl = TOKEN_URL.replace('{tenant}', azure.tenantId);

        const refreshResponse = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: azure.clientId,
                client_secret: azure.clientSecret,
                refresh_token: token.refresh_token,
                grant_type: 'refresh_token',
                scope: SCOPES,
            }),
        });

        if (!refreshResponse.ok) {
            const errorData = await refreshResponse.json() as { error_description?: string };
            console.error('Token refresh error:', errorData);

            // 清除无效的 token
            await c.env.CACHE.delete('onedrive_token');

            return c.json({
                success: false,
                error: { code: 'REFRESH_FAILED', message: errorData.error_description || '刷新令牌失败' },
            }, 401);
        }

        const newTokenData = await refreshResponse.json() as {
            access_token: string;
            refresh_token: string;
            expires_in: number;
        };

        // 更新存储的 token
        const newTokenInfo = {
            access_token: newTokenData.access_token,
            refresh_token: newTokenData.refresh_token || token.refresh_token,
            expires_at: Date.now() + newTokenData.expires_in * 1000,
        };

        await c.env.CACHE.put('onedrive_token', JSON.stringify(newTokenInfo), {
            expirationTtl: 60 * 60 * 24 * 30,
        });

        return c.json({
            success: true,
            data: { message: '令牌已刷新' },
        });
    } catch (error) {
        console.error('Refresh token error:', error);
        return c.json({
            success: false,
            error: { code: 'REFRESH_ERROR', message: '刷新令牌失败' },
        }, 500);
    }
});

/**
 * 断开 OneDrive 连接
 * POST /api/oauth/disconnect
 */
oauth.post('/disconnect', async (c) => {
    try {
        await c.env.CACHE.delete('onedrive_token');

        const now = new Date().toISOString();
        await c.env.DB.prepare(
            `INSERT OR REPLACE INTO system_config (key, value, created_at, updated_at)
       VALUES ('onedrive_connected', 'false', ?, ?)`
        ).bind(now, now).run();

        return c.json({
            success: true,
            data: { message: 'OneDrive 连接已断开' },
        });
    } catch (error) {
        console.error('Disconnect error:', error);
        return c.json({
            success: false,
            error: { code: 'DISCONNECT_ERROR', message: '断开连接失败' },
        }, 500);
    }
});

export const oauthRoutes = oauth;
