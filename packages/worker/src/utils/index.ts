import { nanoid } from 'nanoid';

/**
 * 生成 UUID
 */
export function generateId(): string {
    return nanoid(21);
}

/**
 * 生成短代码 (用于分享链接)
 */
export function generateShortCode(length: number = 8): string {
    return nanoid(length);
}

/**
 * 密码强度等级
 */
export type PasswordStrength = 'weak' | 'medium' | 'strong';

/**
 * 密码强度检查结果
 */
export interface PasswordStrengthResult {
    strength: PasswordStrength;
    score: number;
    feedback: string[];
}

/**
 * 检查密码强度
 * @param password 密码
 * @returns 密码强度检查结果
 */
export function checkPasswordStrength(password: string): PasswordStrengthResult {
    const feedback: string[] = [];
    let score = 0;

    // 长度检查
    if (password.length < 8) {
        feedback.push('密码长度至少为 8 个字符');
    } else {
        score += 1;
        if (password.length >= 12) {
            score += 1;
        }
    }

    // 小写字母
    if (!/[a-z]/.test(password)) {
        feedback.push('需要包含小写字母');
    } else {
        score += 1;
    }

    // 大写字母
    if (!/[A-Z]/.test(password)) {
        feedback.push('需要包含大写字母');
    } else {
        score += 1;
    }

    // 数字
    if (!/[0-9]/.test(password)) {
        feedback.push('需要包含数字');
    } else {
        score += 1;
    }

    // 特殊字符
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        score += 1;
    }

    // 确定强度等级
    let strength: PasswordStrength;
    if (score < 4) {
        strength = 'weak';
    } else if (score < 5) {
        strength = 'medium';
    } else {
        strength = 'strong';
    }

    return { strength, score, feedback };
}

/**
 * 验证密码是否达到中等以上强度
 */
export function isPasswordValid(password: string): { valid: boolean; feedback: string[] } {
    const result = checkPasswordStrength(password);
    return {
        valid: result.strength !== 'weak',
        feedback: result.feedback,
    };
}

/**
 * 使用 Web Crypto API 生成密码哈希 (bcrypt 替代方案)
 * 在 Cloudflare Workers 中使用 PBKDF2
 */
export async function hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveBits']
    );

    const hash = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256',
        },
        keyMaterial,
        256
    );

    // 格式: salt:hash (都是 base64 编码)
    const saltBase64 = btoa(String.fromCharCode(...salt));
    const hashBase64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
    return `${saltBase64}:${hashBase64}`;
}

/**
 * 验证密码
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
    const [saltBase64, hashBase64] = storedHash.split(':');
    if (!saltBase64 || !hashBase64) return false;

    const salt = Uint8Array.from(atob(saltBase64), (c) => c.charCodeAt(0));
    const expectedHash = Uint8Array.from(atob(hashBase64), (c) => c.charCodeAt(0));

    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveBits']
    );

    const hash = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256',
        },
        keyMaterial,
        256
    );

    const actualHash = new Uint8Array(hash);
    if (actualHash.length !== expectedHash.length) return false;

    // 时间恒定比较，防止时序攻击
    let result = 0;
    for (let i = 0; i < actualHash.length; i++) {
        result |= actualHash[i] ^ expectedHash[i];
    }
    return result === 0;
}

/**
 * 生成 JWT Token
 */
export async function generateToken(
    payload: Record<string, unknown>,
    secret: string,
    expiresIn: number = 7 * 24 * 60 * 60 // 默认 7 天
): Promise<string> {
    const header = { alg: 'HS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const tokenPayload = {
        ...payload,
        iat: now,
        exp: now + expiresIn,
    };

    const base64Header = btoa(JSON.stringify(header)).replace(/=/g, '');
    const base64Payload = btoa(JSON.stringify(tokenPayload)).replace(/=/g, '');
    const message = `${base64Header}.${base64Payload}`;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
    const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, '');

    return `${message}.${base64Signature}`;
}

/**
 * 验证 JWT Token
 */
export async function verifyToken(
    token: string,
    secret: string
): Promise<Record<string, unknown> | null> {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;

        const [base64Header, base64Payload, base64Signature] = parts;
        const message = `${base64Header}.${base64Payload}`;

        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(secret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['verify']
        );

        const signature = Uint8Array.from(atob(base64Signature), (c) => c.charCodeAt(0));
        const valid = await crypto.subtle.verify('HMAC', key, signature, encoder.encode(message));
        if (!valid) return null;

        const payload = JSON.parse(atob(base64Payload));

        // 检查过期时间
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
            return null;
        }

        return payload;
    } catch {
        return null;
    }
}

/**
 * 生成 Token 哈希 (用于存储)
 */
export async function hashToken(token: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 获取文件扩展名
 */
export function getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot === -1 ? '' : filename.slice(lastDot + 1).toLowerCase();
}

/**
 * 判断是否为 Office 文件
 */
export function isOfficeFile(filename: string): boolean {
    const ext = getFileExtension(filename);
    return ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp'].includes(ext);
}

/**
 * 判断是否为图片文件
 */
export function isImageFile(filename: string): boolean {
    const ext = getFileExtension(filename);
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext);
}

/**
 * 判断是否为视频文件
 */
export function isVideoFile(filename: string): boolean {
    const ext = getFileExtension(filename);
    return ['mp4', 'webm', 'mkv', 'avi', 'mov', 'wmv', 'flv'].includes(ext);
}

/**
 * 判断是否为音频文件
 */
export function isAudioFile(filename: string): boolean {
    const ext = getFileExtension(filename);
    return ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma'].includes(ext);
}

/**
 * 判断是否为 PDF 文件
 */
export function isPdfFile(filename: string): boolean {
    return getFileExtension(filename) === 'pdf';
}

/**
 * 判断是否为代码文件
 */
export function isCodeFile(filename: string): boolean {
    const ext = getFileExtension(filename);
    return [
        'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cpp', 'cs', 'go',
        'rb', 'php', 'swift', 'kt', 'rs', 'vue', 'svelte', 'html', 'css',
        'scss', 'sass', 'less', 'json', 'xml', 'yaml', 'yml', 'toml',
        'sh', 'bash', 'zsh', 'ps1', 'bat', 'sql'
    ].includes(ext);
}

/**
 * 判断是否为 Markdown 文件
 */
export function isMarkdownFile(filename: string): boolean {
    const ext = getFileExtension(filename);
    return ['md', 'markdown', 'mdx'].includes(ext);
}
