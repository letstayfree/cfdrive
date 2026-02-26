import type { D1Database, KVNamespace, R2Bucket } from '@cloudflare/workers-types';

/**
 * Cloudflare Worker 环境绑定
 */
export interface Env {
    // D1 数据库
    DB: D1Database;
    // KV 缓存
    CACHE: KVNamespace;
    // R2 存储桶 (缩略图等)
    THUMBNAILS: R2Bucket;

    // 环境变量
    APP_ENV: string;

    // Azure AD 配置 (可从数据库设置或环境变量获取)
    AZURE_CLIENT_ID?: string;
    AZURE_CLIENT_SECRET?: string;
    AZURE_TENANT_ID?: string;

    // 应用配置
    JWT_SECRET: string;
    APP_URL: string;
    NODE_ENV?: string;
}

/**
 * 用户角色
 */
export type UserRole = 'superadmin' | 'collaborator' | 'customer' | 'guest';

/**
 * 用户状态
 */
export type UserStatus = 'active' | 'disabled';

/**
 * 用户实体
 */
export interface User {
    id: string;
    email: string;
    username: string;
    password_hash: string;
    display_name: string | null;
    role: UserRole;
    status: UserStatus;
    avatar_url: string | null;
    last_login_at: string | null;
    created_at: string;
    updated_at: string;
}

/**
 * 用户会话
 */
export interface Session {
    id: string;
    user_id: string;
    token_hash: string;
    ip_address: string | null;
    user_agent: string | null;
    expires_at: string;
    created_at: string;
}

/**
 * 文件夹权限
 */
export interface FolderPermission {
    id: string;
    user_id: string;
    folder_id: string;
    folder_path: string;
    permission: 'crud' | 'rd' | 'r';
    granted_by: string;
    created_at: string;
}

/**
 * 分享链接
 */
export interface Share {
    id: string;
    code: string;
    file_id: string;
    file_path: string;
    file_type: 'file' | 'folder';
    created_by: string;
    password_hash: string | null;
    expires_at: string | null;
    max_downloads: number | null;
    download_count: number;
    view_count: number;
    is_active: boolean;
    created_at: string;
}

/**
 * 访问日志
 */
export interface AccessLog {
    id: string;
    user_id: string | null;
    action: string;
    resource_type: 'file' | 'folder' | 'share';
    resource_id: string;
    resource_path: string | null;
    ip_address: string | null;
    user_agent: string | null;
    details: string | null;
    created_at: string;
}

/**
 * 收藏
 */
export interface Favorite {
    id: string;
    user_id: string;
    file_id: string;
    file_path: string;
    file_name: string;
    file_type: 'file' | 'folder';
    created_at: string;
}

/**
 * 标签
 */
export interface Tag {
    id: string;
    user_id: string;
    name: string;
    color: string;
    created_at: string;
}

/**
 * 文件标签关联
 */
export interface FileTag {
    id: string;
    file_id: string;
    tag_id: string;
    created_at: string;
}

/**
 * IP 白名单
 */
export interface IpWhitelist {
    id: string;
    ip_pattern: string;
    description: string | null;
    created_by: string;
    is_active: boolean;
    created_at: string;
}

/**
 * 两步验证
 */
export interface TwoFactorAuth {
    id: string;
    user_id: string;
    secret: string;
    backup_codes: string | null;
    is_enabled: boolean;
    verified_at: string | null;
    created_at: string;
}

/**
 * OneDrive 文件项
 */
export interface DriveItem {
    id: string;
    name: string;
    size: number;
    createdDateTime: string;
    lastModifiedDateTime: string;
    webUrl: string;
    parentReference?: {
        id: string;
        path: string;
    };
    folder?: {
        childCount: number;
    };
    file?: {
        mimeType: string;
        hashes?: {
            sha256Hash?: string;
        };
    };
    thumbnails?: Array<{
        id: string;
        large?: { url: string };
        medium?: { url: string };
        small?: { url: string };
    }>;
}

/**
 * API 响应基础结构
 */
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
    };
}

/**
 * 分页参数
 */
export interface PaginationParams {
    page?: number;
    limit?: number;
}

/**
 * 分页响应
 */
export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
}
