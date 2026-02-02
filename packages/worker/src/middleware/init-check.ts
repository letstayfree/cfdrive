import type { Context } from 'hono';
import type { Env } from '../types';

/**
 * 检查系统是否已初始化
 */
export async function initCheck(c: Context<{ Bindings: Env }>) {
    try {
        const result = await c.env.DB.prepare(
            "SELECT value FROM system_config WHERE key = 'initialized'"
        ).first<{ value: string }>();

        const initialized = result?.value === 'true';

        return c.json({
            success: true,
            data: {
                initialized,
                message: initialized ? '系统已初始化' : '系统需要初始设置',
            },
        });
    } catch (error) {
        // 表可能不存在，说明需要运行迁移
        console.error('Init check error:', error);
        return c.json({
            success: true,
            data: {
                initialized: false,
                message: '数据库需要初始化',
                requiresMigration: true,
            },
        });
    }
}
