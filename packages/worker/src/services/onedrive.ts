import type { Env, DriveItem } from '../types';

/**
 * Microsoft Graph API 客户端
 * 用于与 OneDrive 交互
 */
export class GraphClient {
    private accessToken: string | null = null;
    private tokenExpires: number = 0;
    private env: Env;

    constructor(env: Env) {
        this.env = env;
    }

    /**
     * 获取应用访问令牌 (Client Credentials Flow)
     */
    async getAppToken(): Promise<string> {
        // 检查缓存的 token 是否有效
        if (this.accessToken && Date.now() < this.tokenExpires - 60000) {
            return this.accessToken;
        }

        const tokenUrl = `https://login.microsoftonline.com/${this.env.AZURE_TENANT_ID}/oauth2/v2.0/token`;

        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: this.env.AZURE_CLIENT_ID,
                client_secret: this.env.AZURE_CLIENT_SECRET,
                scope: 'https://graph.microsoft.com/.default',
                grant_type: 'client_credentials',
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('Failed to get app token:', error);
            throw new Error('Failed to get Microsoft Graph access token');
        }

        const data = (await response.json()) as {
            access_token: string;
            expires_in: number;
        };

        this.accessToken = data.access_token;
        this.tokenExpires = Date.now() + data.expires_in * 1000;

        return this.accessToken;
    }

    /**
     * 发送 Graph API 请求
     */
    async request<T>(
        path: string,
        options: RequestInit = {}
    ): Promise<T> {
        const token = await this.getAppToken();

        const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
            ...options,
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('Graph API error:', response.status, error);
            throw new Error(`Graph API error: ${response.status}`);
        }

        // 处理 204 No Content
        if (response.status === 204) {
            return {} as T;
        }

        return response.json() as Promise<T>;
    }

    /**
     * 发送原始请求（用于获取 response 对象）
     */
    async rawRequest(path: string, options: RequestInit = {}): Promise<Response> {
        const token = await this.getAppToken();

        return fetch(`https://graph.microsoft.com/v1.0${path}`, {
            ...options,
            headers: {
                Authorization: `Bearer ${token}`,
                ...options.headers,
            },
        });
    }
}

/**
 * OneDrive 操作服务
 */
export class OneDriveService {
    private graph: GraphClient;
    private driveId: string | null = null;

    constructor(env: Env) {
        this.graph = new GraphClient(env);
    }

    /**
     * 获取默认驱动器 ID
     */
    private async getDriveId(): Promise<string> {
        if (this.driveId) {
            return this.driveId;
        }

        // 使用应用的 Drive
        const response = await this.graph.request<{ id: string }>('/drive');
        this.driveId = response.id;
        return this.driveId;
    }

    /**
     * 列出目录内容
     */
    async listFolder(
        folderId: string = 'root',
        options: { top?: number; skip?: number; orderby?: string } = {}
    ): Promise<{ items: DriveItem[]; nextLink?: string }> {
        const params = new URLSearchParams();
        if (options.top) params.set('$top', options.top.toString());
        if (options.skip) params.set('$skip', options.skip.toString());
        if (options.orderby) params.set('$orderby', options.orderby);
        params.set('$expand', 'thumbnails');

        const path = folderId === 'root'
            ? `/drive/root/children?${params}`
            : `/drive/items/${folderId}/children?${params}`;

        const response = await this.graph.request<{
            value: DriveItem[];
            '@odata.nextLink'?: string;
        }>(path);

        return {
            items: response.value,
            nextLink: response['@odata.nextLink'],
        };
    }

    /**
     * 获取文件/文件夹详情
     */
    async getItem(itemId: string): Promise<DriveItem> {
        const path = itemId === 'root'
            ? '/drive/root?$expand=thumbnails'
            : `/drive/items/${itemId}?$expand=thumbnails`;

        return this.graph.request<DriveItem>(path);
    }

    /**
     * 通过路径获取文件/文件夹
     */
    async getItemByPath(itemPath: string): Promise<DriveItem> {
        const encodedPath = encodeURIComponent(itemPath);
        return this.graph.request<DriveItem>(`/drive/root:/${encodedPath}?$expand=thumbnails`);
    }

    /**
     * 创建文件夹
     */
    async createFolder(parentId: string, name: string): Promise<DriveItem> {
        const path = parentId === 'root'
            ? '/drive/root/children'
            : `/drive/items/${parentId}/children`;

        return this.graph.request<DriveItem>(path, {
            method: 'POST',
            body: JSON.stringify({
                name,
                folder: {},
                '@microsoft.graph.conflictBehavior': 'rename',
            }),
        });
    }

    /**
     * 重命名文件/文件夹
     */
    async renameItem(itemId: string, newName: string): Promise<DriveItem> {
        return this.graph.request<DriveItem>(`/drive/items/${itemId}`, {
            method: 'PATCH',
            body: JSON.stringify({ name: newName }),
        });
    }

    /**
     * 删除文件/文件夹
     */
    async deleteItem(itemId: string): Promise<void> {
        await this.graph.request<void>(`/drive/items/${itemId}`, {
            method: 'DELETE',
        });
    }

    /**
     * 复制文件/文件夹
     */
    async copyItem(
        itemId: string,
        targetParentId: string,
        newName?: string
    ): Promise<{ monitorUrl: string }> {
        const parentReference = targetParentId === 'root'
            ? { path: '/drive/root' }
            : { id: targetParentId };

        const response = await this.graph.rawRequest(`/drive/items/${itemId}/copy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                parentReference,
                name: newName,
            }),
        });

        if (response.status !== 202) {
            throw new Error('Copy operation failed');
        }

        return {
            monitorUrl: response.headers.get('Location') || '',
        };
    }

    /**
     * 移动文件/文件夹
     */
    async moveItem(
        itemId: string,
        targetParentId: string,
        newName?: string
    ): Promise<DriveItem> {
        const parentReference = targetParentId === 'root'
            ? { path: '/drive/root' }
            : { id: targetParentId };

        const body: Record<string, unknown> = { parentReference };
        if (newName) {
            body.name = newName;
        }

        return this.graph.request<DriveItem>(`/drive/items/${itemId}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        });
    }

    /**
     * 获取文件下载 URL
     */
    async getDownloadUrl(itemId: string): Promise<string> {
        const item = await this.graph.request<{ '@microsoft.graph.downloadUrl': string }>(
            `/drive/items/${itemId}?select=id,@microsoft.graph.downloadUrl`
        );
        return item['@microsoft.graph.downloadUrl'];
    }

    /**
     * 小文件上传 (<4MB)
     */
    async uploadSmall(
        parentId: string,
        fileName: string,
        content: ArrayBuffer | Uint8Array,
        contentType: string = 'application/octet-stream'
    ): Promise<DriveItem> {
        const encodedName = encodeURIComponent(fileName);
        const path = parentId === 'root'
            ? `/drive/root:/${encodedName}:/content`
            : `/drive/items/${parentId}:/${encodedName}:/content`;

        return this.graph.request<DriveItem>(path, {
            method: 'PUT',
            headers: {
                'Content-Type': contentType,
            },
            body: content,
        });
    }

    /**
     * 创建大文件上传会话
     */
    async createUploadSession(
        parentId: string,
        fileName: string
    ): Promise<{ uploadUrl: string; expirationDateTime: string }> {
        const encodedName = encodeURIComponent(fileName);
        const path = parentId === 'root'
            ? `/drive/root:/${encodedName}:/createUploadSession`
            : `/drive/items/${parentId}:/${encodedName}:/createUploadSession`;

        return this.graph.request<{ uploadUrl: string; expirationDateTime: string }>(path, {
            method: 'POST',
            body: JSON.stringify({
                item: {
                    '@microsoft.graph.conflictBehavior': 'rename',
                },
            }),
        });
    }

    /**
     * 搜索文件
     */
    async search(
        query: string,
        folderId?: string
    ): Promise<DriveItem[]> {
        const encodedQuery = encodeURIComponent(query);
        const path = folderId
            ? `/drive/items/${folderId}/search(q='${encodedQuery}')`
            : `/drive/root/search(q='${encodedQuery}')`;

        const response = await this.graph.request<{ value: DriveItem[] }>(path);
        return response.value;
    }

    /**
     * 获取文件预览 URL (用于 Office 文件)
     */
    async getPreviewUrl(itemId: string): Promise<{ getUrl: string; postUrl: string }> {
        return this.graph.request<{ getUrl: string; postUrl: string }>(
            `/drive/items/${itemId}/preview`,
            { method: 'POST' }
        );
    }

    /**
     * 获取缩略图
     */
    async getThumbnails(
        itemId: string,
        size: 'small' | 'medium' | 'large' = 'medium'
    ): Promise<string | null> {
        try {
            const response = await this.graph.request<{
                value: Array<{
                    [key: string]: { url: string };
                }>;
            }>(`/drive/items/${itemId}/thumbnails`);

            if (response.value && response.value.length > 0) {
                return response.value[0][size]?.url || null;
            }
            return null;
        } catch {
            return null;
        }
    }

    /**
     * 获取文件版本历史
     */
    async getVersions(itemId: string): Promise<Array<{
        id: string;
        lastModifiedDateTime: string;
        size: number;
    }>> {
        const response = await this.graph.request<{
            value: Array<{
                id: string;
                lastModifiedDateTime: string;
                size: number;
            }>;
        }>(`/drive/items/${itemId}/versions`);

        return response.value;
    }

    /**
     * 恢复到指定版本
     */
    async restoreVersion(itemId: string, versionId: string): Promise<void> {
        await this.graph.request<void>(`/drive/items/${itemId}/versions/${versionId}/restoreVersion`, {
            method: 'POST',
        });
    }

    /**
     * 获取回收站项目
     */
    async getDeletedItems(): Promise<DriveItem[]> {
        // 注意：OneDrive 的回收站需要使用特殊的端点
        // 这里使用 delta 查询来获取已删除的项目
        try {
            // 尝试获取回收站内容
            const response = await this.graph.request<{ value: DriveItem[] }>('/drive/special/recycle/children');
            return response.value;
        } catch {
            // 如果不支持，返回空数组
            return [];
        }
    }

    /**
     * 永久删除回收站项目
     */
    async permanentlyDelete(itemId: string): Promise<void> {
        await this.graph.request<void>(`/drive/items/${itemId}`, {
            method: 'DELETE',
        });
    }

    /**
     * 从回收站恢复项目
     */
    async restoreFromTrash(itemId: string): Promise<DriveItem> {
        return this.graph.request<DriveItem>(`/drive/items/${itemId}/restore`, {
            method: 'POST',
        });
    }
}
