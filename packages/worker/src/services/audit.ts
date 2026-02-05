import { generateId } from '../utils';

/**
 * 记录访问日志
 */
export async function logAccess(
    db: D1Database,
    userId: string | null,
    action: string,
    resourceType: string,
    resourceId: string,
    resourcePath: string | null,
    request: Request,
    details?: Record<string, unknown>
) {
    try {
        const id = generateId();
        const ipAddress =
            request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || null;
        const userAgent = request.headers.get('User-Agent') || null;

        await db
            .prepare(
                `INSERT INTO access_logs (id, user_id, action, resource_type, resource_id, resource_path, ip_address, user_agent, details, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
                id,
                userId,
                action,
                resourceType,
                resourceId,
                resourcePath,
                ipAddress,
                userAgent,
                details ? JSON.stringify(details) : null,
                new Date().toISOString()
            )
            .run();
    } catch (error) {
        console.error('Failed to log access:', error);
    }
}
