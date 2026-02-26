import { useAuthStore } from '../stores/auth';

const BASE_URL = '/api';

export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    message?: string;
    error?: {
        code: string;
        message: string;
    };
}

async function request<T>(
    path: string,
    options: RequestInit = {}
): Promise<ApiResponse<T>> {
    const token = useAuthStore.getState().token;

    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token) {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(`${BASE_URL}${path}`, {
            ...options,
            headers,
        });

        const data = await response.json();

        // 如果是 401 且不是登录/登出请求，清除认证状态
        if (response.status === 401 && !path.includes('/auth/login') && !path.includes('/auth/logout')) {
            useAuthStore.getState().logout();
        }

        return data;
    } catch (error) {
        console.error('API request error:', error);
        return {
            success: false,
            error: { code: 'NETWORK_ERROR', message: '网络请求失败' },
        };
    }
}

export const api = {
    get: <T>(path: string) => request<T>(path, { method: 'GET' }),

    post: <T>(path: string, body?: unknown) =>
        request<T>(path, {
            method: 'POST',
            body: body ? JSON.stringify(body) : undefined,
        }),

    put: <T>(path: string, body?: unknown) =>
        request<T>(path, {
            method: 'PUT',
            body: body ? JSON.stringify(body) : undefined,
        }),

    delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),

    // 用于文件上传
    upload: async <T>(path: string, formData: FormData): Promise<ApiResponse<T>> => {
        const token = useAuthStore.getState().token;

        const headers: HeadersInit = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        try {
            const response = await fetch(`${BASE_URL}${path}`, {
                method: 'POST',
                headers,
                body: formData,
            });

            return await response.json();
        } catch (error) {
            console.error('Upload error:', error);
            return {
                success: false,
                error: { code: 'UPLOAD_ERROR', message: '上传失败' },
            };
        }
    },
};

// 驱动器服务
export const driveService = {
    getQuota: () => api.get<{
        total: number;
        used: number;
        remaining: number;
        state: string;
        driveType: string;
    }>('/files/drive/quota'),
};

// 文件服务
export const fileService = {
    list: (folderId: string = 'root', options?: { top?: number; skip?: number; orderby?: string }) => {
        const params = new URLSearchParams();
        params.set('folderId', folderId);
        if (options?.top) params.set('top', options.top.toString());
        if (options?.skip) params.set('skip', options.skip.toString());
        if (options?.orderby) params.set('orderby', options.orderby);
        return api.get(`/files?${params}`);
    },

    getItem: (itemId: string) => api.get(`/files/${itemId}`),

    createFolder: (parentId: string, name: string) =>
        api.post('/files/folder', { parentId, name }),

    rename: (itemId: string, name: string) =>
        api.put(`/files/${itemId}/rename`, { name }),

    delete: (itemId: string) => api.delete(`/files/${itemId}`),

    copy: (itemId: string, targetParentId: string, newName?: string) =>
        api.post(`/files/${itemId}/copy`, { targetParentId, newName }),

    move: (itemId: string, targetParentId: string, newName?: string) =>
        api.post(`/files/${itemId}/move`, { targetParentId, newName }),

    getDownloadUrl: (itemId: string) => api.get<{ downloadUrl: string }>(`/files/${itemId}/download`),

    getPreviewUrl: (itemId: string) => api.get<{ previewUrl: string }>(`/files/${itemId}/preview`),

    getThumbnail: (itemId: string, size: 'small' | 'medium' | 'large' = 'medium') =>
        api.get<{ url: string }>(`/files/${itemId}/thumbnail?size=${size}`),

    search: (query: string, folderId?: string) => {
        const params = new URLSearchParams({ q: query });
        if (folderId) params.set('folderId', folderId);
        return api.get(`/files/search?${params}`);
    },

    upload: (parentId: string, file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('parentId', parentId);
        return api.upload('/files/upload', formData);
    },

    createUploadSession: (parentId: string, fileName: string, fileSize: number) =>
        api.post<{ uploadUrl: string; expirationDateTime: string }>('/files/upload/session', {
            parentId,
            fileName,
            fileSize,
        }),

    getVersions: (itemId: string) => api.get(`/files/${itemId}/versions`),

    // 回收站
    getTrash: () => api.get('/files/trash'),
    restore: (itemId: string) => api.post(`/files/${itemId}/restore`),
    permanentDelete: (itemId: string) => api.delete(`/files/${itemId}/permanent`),

    // 批量操作
    batchDelete: (itemIds: string[]) =>
        api.post<{
            success: string[];
            failed: Array<{ id: string; reason: string }>;
        }>('/files/batch/delete', { itemIds }),

    batchMove: (itemIds: string[], targetParentId: string) =>
        api.post<{
            success: string[];
            failed: Array<{ id: string; reason: string }>;
        }>('/files/batch/move', { itemIds, targetParentId }),

    batchCopy: (itemIds: string[], targetParentId: string) =>
        api.post<{
            success: string[];
            failed: Array<{ id: string; reason: string }>;
        }>('/files/batch/copy', { itemIds, targetParentId }),
};

// 分享服务
export const shareService = {
    list: () => api.get('/shares'),

    create: (options: {
        file_id: string;
        password?: string;
        expires_at?: string;
        max_downloads?: number;
    }) => api.post<{ code: string; id: string }>('/shares', options),

    get: (shareId: string) => api.get(`/shares/${shareId}`),

    update: (shareId: string, options: {
        password?: string | null;
        expiresIn?: number | null;
        maxDownloads?: number | null;
        isActive?: boolean;
    }) => api.put(`/shares/${shareId}`, options),

    delete: (shareId: string) => api.delete(`/shares/${shareId}`),

    getStats: (shareId: string) => api.get(`/shares/${shareId}/stats`),

    // 公开访问
    publicAccess: (code: string) => api.get(`/s/${code}`),

    verifyPassword: (code: string, password: string) =>
        api.post(`/s/${code}/verify`, { password }),

    publicDownload: (code: string, fileId: string) =>
        api.get<{ downloadUrl: string }>(`/s/${code}/download/${fileId}`),
};

// 用户服务
export const userService = {
    list: (options?: { page?: number; limit?: number; role?: string; status?: string; search?: string }) => {
        const params = new URLSearchParams();
        if (options?.page) params.set('page', options.page.toString());
        if (options?.limit) params.set('limit', options.limit.toString());
        if (options?.role) params.set('role', options.role);
        if (options?.status) params.set('status', options.status);
        if (options?.search) params.set('search', options.search);
        return api.get(`/users?${params}`);
    },

    get: (userId: string) => api.get(`/users/${userId}`),

    create: (data: {
        username: string;
        email: string;
        password: string;
        display_name?: string;
        role: 'collaborator' | 'customer' | 'guest';
    }) => api.post('/users', data),

    update: (userId: string, data: {
        display_name?: string;
        role?: string;
        status?: string;
    }) => api.put(`/users/${userId}`, data),

    delete: (userId: string) => api.delete(`/users/${userId}`),

    setPermissions: (userId: string, permissions: Array<{
        folder_id: string;
        folder_path: string;
        permission: 'crud' | 'rd' | 'r';
    }>) => api.put(`/users/${userId}/permissions`, { permissions }),

    resetPassword: (userId: string, newPassword: string) =>
        api.post(`/users/${userId}/reset-password`, { new_password: newPassword }),
};

// 收藏服务
export const favoriteService = {
    list: () => api.get<{
        items: Array<{
            id: string;
            file_id: string;
            file_name: string;
            file_path: string;
            file_type: 'file' | 'folder';
            created_at: string;
        }>
    }>('/favorites'),

    add: (file: {
        file_id: string;
        file_name: string;
        file_path: string;
        file_type: 'file' | 'folder';
    }) => api.post('/favorites', file),

    remove: (fileId: string) => api.delete(`/favorites/${fileId}`),

    check: (fileId: string) => api.get<{ isFavorite: boolean; favoriteId: string | null }>(`/favorites/check/${fileId}`),

    checkBatch: (fileIds: string[]) => api.post<Record<string, boolean>>('/favorites/check-batch', { fileIds }),
};

// 系统服务
export const systemService = {
    checkInit: () => api.get<{ initialized: boolean; message: string }>('/init/status'),

    setup: (data: {
        username: string;
        email: string;
        password: string;
        display_name?: string;
    }) => api.post('/setup/init', data),

    checkPassword: (password: string) =>
        api.post<{ strength: string; score: number; feedback: string[] }>('/setup/check-password', { password }),
};

// OAuth 服务
export const oauthService = {
    getAuthorizeUrl: () => `${BASE_URL}/oauth/authorize`,

    checkStatus: () => api.get<{ connected: boolean; expired?: boolean }>('/oauth/status'),

    refresh: () => api.post('/oauth/refresh'),

    disconnect: () => api.post('/oauth/disconnect'),
};

// 标签服务
export const tagService = {
    getAll: () => api.get<{ tags: Array<{ id: string; name: string; color: string; file_count: number }> }>('/tags'),

    create: (name: string, color?: string) => api.post('/tags', { name, color }),

    update: (id: string, name?: string, color?: string) => api.put(`/tags/${id}`, { name, color }),

    delete: (id: string) => api.delete(`/tags/${id}`),

    getFileTags: (fileId: string) =>
        api.get<{ tags: Array<{ id: string; name: string; color: string }> }>(`/tags/files/${fileId}`),

    addFileTags: (fileId: string, tagIds: string[]) =>
        api.post(`/tags/files/${fileId}`, { tagIds }),

    removeFileTag: (fileId: string, tagId: string) =>
        api.delete(`/tags/files/${fileId}/tags/${tagId}`),

    getTaggedFiles: (tagId: string) =>
        api.get<{ tag: { id: string; name: string }; fileIds: string[] }>(`/tags/${tagId}/files`),
};

// 日志服务
export const logService = {
    getLogs: (params?: {
        page?: number;
        limit?: number;
        user_id?: string;
        action?: string;
        resource_type?: string;
        start_date?: string;
        end_date?: string;
    }) => {
        const query = new URLSearchParams();
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined) query.append(key, value.toString());
            });
        }
        return api.get<{
            logs: Array<{
                id: string;
                user_id: string | null;
                action: string;
                resource_type: string;
                resource_id: string;
                resource_path: string | null;
                ip_address: string | null;
                user_agent: string | null;
                details: string | null;
                created_at: string;
                user: { username: string; email: string } | null;
            }>;
            pagination: {
                page: number;
                limit: number;
                total: number;
                pages: number;
            };
        }>(`/logs?${query.toString()}`);
    },

    getStats: (params?: { start_date?: string; end_date?: string }) => {
        const query = new URLSearchParams();
        if (params) {
            Object.entries(params).forEach(([key, value]) => {
                if (value) query.append(key, value);
            });
        }
        return api.get<{
            by_action: Array<{ action: string; count: number }>;
            by_resource: Array<{ resource_type: string; count: number }>;
            by_user: Array<{
                user_id: string;
                user: { username: string; email: string } | null;
                count: number;
            }>;
        }>(`/logs/stats?${query.toString()}`);
    },

    cleanup: (days: number = 90) => api.delete(`/logs/cleanup?days=${days}`),
};

// 安全服务
export const securityService = {
    // IP 白名单
    getIpWhitelist: () =>
        api.get<{
            enabled: boolean;
            items: Array<{
                id: string;
                ip_pattern: string;
                description: string | null;
                is_active: number;
                created_at: string;
            }>;
        }>('/security/ip-whitelist'),

    addIpWhitelist: (data: { ip_pattern: string; description?: string }) =>
        api.post<{ id: string; ip_pattern: string; description: string | null }>('/security/ip-whitelist', data),

    deleteIpWhitelist: (id: string) => api.delete(`/security/ip-whitelist/${id}`),

    toggleIpWhitelist: (enabled: boolean) =>
        api.put<{ enabled: boolean }>('/security/ip-whitelist/toggle', { enabled }),
};

// 配置服务
export const configService = {
    // 获取所有配置
    getAll: () =>
        api.get<{
            items: Array<{ key: string; value: string; created_at: string; updated_at: string }>;
            configurableKeys: string[];
        }>('/config'),

    // 获取单个配置
    get: (key: string) =>
        api.get<{ key: string; value: string; created_at: string; updated_at: string }>(`/config/${key}`),

    // 更新单个配置
    update: (key: string, value: string) =>
        api.put<{ key: string; value: string; updated_at: string }>(`/config/${key}`, { value }),

    // 批量更新配置
    batchUpdate: (configs: Record<string, string>) =>
        api.put<{ updates: Array<{ key: string; value: string }>; updated_at: string }>('/config', configs),

    // 获取 OneDrive 连接状态
    getOnedriveStatus: () =>
        api.get<{
            configured: boolean;
            connected: boolean;
            details: {
                hasClientId: boolean;
                hasClientSecret: boolean;
                hasTenantId: boolean;
                hasToken: boolean;
                isTokenValid: boolean;
            };
        }>('/config/onedrive/status'),
};

// 默认导出常用方法
export default {
    ...api,
    uploadFile: fileService.upload,
};
