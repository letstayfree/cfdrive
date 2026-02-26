import type { Env } from '../types';

export interface AzureConfig {
    clientId: string;
    clientSecret: string;
    tenantId: string;
}

/**
 * 从数据库获取 Azure AD 配置，DB 无值时回退到环境变量
 */
export async function getAzureConfig(env: Env): Promise<AzureConfig> {
    const keys = ['azure_client_id', 'azure_client_secret', 'azure_tenant_id'] as const;

    const results = await env.DB.prepare(
        `SELECT key, value FROM system_config WHERE key IN (${keys.map(() => '?').join(',')})`
    ).bind(...keys).all<{ key: string; value: string }>();

    const dbValues: Record<string, string> = {};
    for (const row of results.results) {
        dbValues[row.key] = row.value;
    }

    return {
        clientId: dbValues['azure_client_id'] || env.AZURE_CLIENT_ID || '',
        clientSecret: dbValues['azure_client_secret'] || env.AZURE_CLIENT_SECRET || '',
        tenantId: dbValues['azure_tenant_id'] || env.AZURE_TENANT_ID || '',
    };
}
