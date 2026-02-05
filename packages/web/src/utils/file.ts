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
 * 获取文件类型
 */
export function getFileType(filename: string): string {
    const ext = getFileExtension(filename);

    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'];
    const videoExts = ['mp4', 'webm', 'mkv', 'avi', 'mov', 'wmv', 'flv'];
    const audioExts = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma'];
    const documentExts = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'pdf', 'txt', 'rtf'];
    const codeExts = ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cpp', 'cs', 'go', 'rb', 'php', 'swift', 'kt', 'rs', 'vue', 'svelte', 'html', 'css', 'scss', 'json', 'xml', 'yaml', 'yml'];
    const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'];

    if (imageExts.includes(ext)) return 'image';
    if (videoExts.includes(ext)) return 'video';
    if (audioExts.includes(ext)) return 'audio';
    if (documentExts.includes(ext)) return 'document';
    if (codeExts.includes(ext)) return 'code';
    if (archiveExts.includes(ext)) return 'archive';

    return 'file';
}

/**
 * 获取文件图标名称
 */
export function getFileIcon(filename: string, isFolder: boolean = false): string {
    if (isFolder) return 'folder';
    return getFileType(filename);
}

/**
 * 判断是否可预览
 */
export function isPreviewable(filename: string): boolean {
    const ext = getFileExtension(filename);
    const previewableExts = [
        // 图片
        'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp',
        // 视频
        'mp4', 'webm',
        // 音频
        'mp3', 'wav', 'ogg',
        // 文档
        'pdf', 'txt', 'md',
        // 代码
        'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cpp', 'go', 'rs', 'html', 'css', 'json', 'xml', 'yaml',
        // Office (通过 OneDrive 预览)
        'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
    ];

    return previewableExts.includes(ext);
}

/**
 * 判断是否为 Office 文件
 */
export function isOfficeFile(filename: string): boolean {
    const ext = getFileExtension(filename);
    return ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp'].includes(ext);
}

/**
 * 判断是否可在线编辑
 */
export function isEditable(filename: string): boolean {
    const ext = getFileExtension(filename);
    return ['txt', 'md', 'json', 'js', 'ts', 'css', 'html', 'xml', 'yaml', 'yml'].includes(ext);
}

/**
 * 格式化日期
 */
export function formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    // 一分钟内
    if (diff < 60 * 1000) {
        return '刚刚';
    }

    // 一小时内
    if (diff < 60 * 60 * 1000) {
        const minutes = Math.floor(diff / (60 * 1000));
        return `${minutes} 分钟前`;
    }

    // 今天
    if (date.toDateString() === now.toDateString()) {
        return `今天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }

    // 昨天
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
        return `昨天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }

    // 一周内
    if (diff < 7 * 24 * 60 * 60 * 1000) {
        const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        return days[date.getDay()];
    }

    // 今年
    if (date.getFullYear() === now.getFullYear()) {
        return `${date.getMonth() + 1}月${date.getDate()}日`;
    }

    // 其他年份
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

