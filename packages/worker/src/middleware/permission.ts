import type { Context, Next } from 'hono';
import type { Env, User, UserRole, FolderPermission } from '../types';

/**
 * 权限类型
 */
export type PermissionAction = 'create' | 'read' | 'update' | 'delete';

/**
 * 权限检查结果
 */
export interface PermissionCheckResult {
    allowed: boolean;
    reason?: string;
}

/**
 * 检查用户是否有权限执行指定操作
 * @param user 用户
 * @param folderId OneDrive 文件夹 ID
 * @param action 操作类型
 * @param db D1 数据库
 */
export async function checkPermission(
    user: User,
    folderId: string,
    action: PermissionAction,
    db: D1Database
): Promise<PermissionCheckResult> {
    // SuperAdmin 拥有所有权限
    if (user.role === 'superadmin') {
        return { allowed: true };
    }

    // Guest 只能访问公开分享的内容（在分享路由中处理）
    if (user.role === 'guest') {
        return { allowed: false, reason: '访客无权限访问此资源' };
    }

    // Collaborator 和 Customer 需要检查文件夹权限
    const permission = await db
        .prepare('SELECT * FROM folder_permissions WHERE user_id = ? AND folder_id = ?')
        .bind(user.id, folderId)
        .first<FolderPermission>();

    if (!permission) {
        return { allowed: false, reason: '没有此文件夹的访问权限' };
    }

    // 检查权限等级
    const allowedActions = getPermissionActions(permission.permission);
    if (!allowedActions.includes(action)) {
        return { allowed: false, reason: `没有此文件夹的${getActionName(action)}权限` };
    }

    return { allowed: true };
}

/**
 * 获取权限包含的操作
 */
function getPermissionActions(permission: string): PermissionAction[] {
    switch (permission) {
        case 'crud':
            return ['create', 'read', 'update', 'delete'];
        case 'rd':
            return ['read', 'delete']; // 这里 'd' 表示 download，实际上映射到 read
        case 'r':
            return ['read'];
        default:
            return [];
    }
}

/**
 * 获取操作的中文名称
 */
function getActionName(action: PermissionAction): string {
    const names: Record<PermissionAction, string> = {
        create: '创建',
        read: '查看',
        update: '修改',
        delete: '删除',
    };
    return names[action];
}

/**
 * 创建权限检查中间件
 * @param action 需要的操作权限
 */
export function requirePermission(action: PermissionAction) {
    return async (c: Context<{ Bindings: Env }>, next: Next) => {
        const user = c.get('user') as User;
        if (!user) {
            return c.json(
                {
                    success: false,
                    error: { code: 'UNAUTHORIZED', message: '未认证' },
                },
                401
            );
        }

        // 获取目标文件夹 ID（从请求参数或查询参数中获取）
        const folderId = c.req.param('folderId') || c.req.query('folderId') || 'root';

        const result = await checkPermission(user, folderId, action, c.env.DB);
        if (!result.allowed) {
            return c.json(
                {
                    success: false,
                    error: { code: 'FORBIDDEN', message: result.reason || '权限不足' },
                },
                403
            );
        }

        await next();
    };
}

/**
 * 检查用户是否有指定角色
 */
export function requireRole(...roles: UserRole[]) {
    return async (c: Context<{ Bindings: Env }>, next: Next) => {
        const user = c.get('user') as User;
        if (!user) {
            return c.json(
                {
                    success: false,
                    error: { code: 'UNAUTHORIZED', message: '未认证' },
                },
                401
            );
        }

        if (!roles.includes(user.role)) {
            return c.json(
                {
                    success: false,
                    error: { code: 'FORBIDDEN', message: '角色权限不足' },
                },
                403
            );
        }

        await next();
    };
}

/**
 * 检查是否为管理员
 */
export const requireAdmin = requireRole('superadmin');

/**
 * 检查是否为管理员或协作者
 */
export const requireCollaborator = requireRole('superadmin', 'collaborator');

/**
 * 递归检查文件/文件夹权限
 * 检查用户是否有权限访问指定路径
 */
export async function checkPathPermission(
    user: User,
    path: string,
    action: PermissionAction,
    db: D1Database
): Promise<PermissionCheckResult> {
    // SuperAdmin 拥有所有权限
    if (user.role === 'superadmin') {
        return { allowed: true };
    }

    // 获取用户的所有权限
    const permissions = await db
        .prepare('SELECT * FROM folder_permissions WHERE user_id = ?')
        .bind(user.id)
        .all<FolderPermission>();

    if (!permissions.results || permissions.results.length === 0) {
        return { allowed: false, reason: '没有任何文件夹访问权限' };
    }

    // 检查路径是否在任何已授权的文件夹下
    for (const perm of permissions.results) {
        if (path === perm.folder_path || path.startsWith(perm.folder_path + '/')) {
            const allowedActions = getPermissionActions(perm.permission);
            if (allowedActions.includes(action)) {
                return { allowed: true };
            }
        }
    }

    return { allowed: false, reason: '没有此路径的访问权限' };
}
