import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { Env } from './types';
import { authRoutes } from './handlers/auth';
import { userRoutes } from './handlers/users';
import { fileRoutes } from './handlers/files';
import { shareRoutes } from './handlers/shares';
import { setupRoutes } from './handlers/setup';
import { oauthRoutes } from './handlers/oauth';
import { favoriteRoutes } from './handlers/favorites';
import tagRoutes from './handlers/tags';
import logRoutes from './handlers/logs';
import securityRoutes from './handlers/security';
import configRoutes from './handlers/config';
import { authMiddleware } from './middleware/auth';
import { initCheck } from './middleware/init-check';
import { ipCheckMiddleware } from './middleware/ip-check';

// 创建 Hono 应用
const app = new Hono<{ Bindings: Env }>();

// 全局中间件
app.use('*', logger());
app.use(
    '*',
    cors({
        origin: (origin, c) => {
            const appUrl = c.env.APP_URL || 'http://localhost:5173';
            // 允许本地开发和配置的 APP_URL
            if (origin === appUrl || origin?.startsWith('http://localhost:')) {
                return origin;
            }
            return appUrl;
        },
        credentials: true,
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
    })
);

// 健康检查
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// 初始化检查 API (无需认证)
app.get('/api/init/status', initCheck);

// 初始设置路由 (无需认证)
app.route('/api/setup', setupRoutes);

// OAuth 路由 (无需认证)
app.route('/api/oauth', oauthRoutes);

// 公开分享访问 (无需认证)
app.get('/api/s/:code', shareRoutes.publicAccess);
app.post('/api/s/:code/verify', shareRoutes.verifyPassword);
app.get('/api/s/:code/download/:fileId', shareRoutes.publicDownload);

// 认证路由 (内部处理认证逻辑)
app.route('/api/auth', authRoutes);

// === 以下路由需要认证 ===
app.use('/api/*', authMiddleware);

// IP 白名单检查中间件（在认证之后）
app.use('/api/*', ipCheckMiddleware);

// 用户管理路由
app.route('/api/users', userRoutes);

// 文件操作路由
app.route('/api/files', fileRoutes);

// 分享管理路由
app.route('/api/shares', shareRoutes.authenticated);

// 收藏管理路由
app.route('/api/favorites', favoriteRoutes);

// 标签管理路由
app.route('/api/tags', tagRoutes);

// 日志管理路由
app.route('/api/logs', logRoutes);

// 安全管理路由
app.route('/api/security', securityRoutes);

// 配置管理路由
app.route('/api/config', configRoutes);

// 404 处理
app.notFound((c) =>
    c.json(
        {
            success: false,
            error: { code: 'NOT_FOUND', message: 'Resource not found' },
        },
        404
    )
);

// 全局错误处理
app.onError((err, c) => {
    console.error('Unhandled error:', err);
    return c.json(
        {
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
        },
        500
    );
});

export default app;
