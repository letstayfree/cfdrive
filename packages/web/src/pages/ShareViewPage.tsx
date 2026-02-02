import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { shareService } from '../services/api';
import {
    Loader2,
    File,
    Folder,
    Download,
    Lock,
    AlertCircle,
    Clock,
    Eye,
    FileText,
    Image,
    Film,
    Music,
} from 'lucide-react';
import { formatFileSize } from '../utils/file';

interface ShareData {
    id: string;
    code: string;
    file_id: string;
    file_path: string;
    file_type: 'file' | 'folder';
    expires_at: string | null;
    is_password_protected: boolean;
    file_name: string;
    file_size?: number;
    view_count: number;
    download_count: number;
    max_downloads: number | null;
}

export default function ShareViewPage() {
    const { code } = useParams<{ code: string }>();
    const [password, setPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [isVerified, setIsVerified] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    // 获取分享信息
    const { data: shareData, isLoading, error } = useQuery({
        queryKey: ['share', code],
        queryFn: async () => {
            const response = await shareService.publicAccess(code!);
            if (response.success && response.data) {
                const data = response.data as ShareData;
                if (!data.is_password_protected) {
                    setIsVerified(true);
                }
                return data;
            }
            throw new Error(response.error?.message || '获取分享信息失败');
        },
        enabled: !!code,
    });

    // 处理密码验证
    const handleVerifyPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!password.trim()) {
            setPasswordError('请输入密码');
            return;
        }

        setIsVerifying(true);
        setPasswordError('');

        try {
            const response = await shareService.verifyPassword(code!, password);
            if (response.success) {
                setIsVerified(true);
            } else {
                setPasswordError(response.error?.message || '密码错误');
            }
        } catch {
            setPasswordError('验证失败，请重试');
        } finally {
            setIsVerifying(false);
        }
    };

    // 处理下载
    const handleDownload = async (fileId?: string) => {
        setIsDownloading(true);
        try {
            const targetId = fileId || shareData?.file_id;
            if (!targetId) return;

            const response = await shareService.publicDownload(code!, targetId);
            if (response.success && response.data) {
                window.open(response.data.downloadUrl, '_blank');
            }
        } catch (error) {
            console.error('Download error:', error);
        } finally {
            setIsDownloading(false);
        }
    };

    // 获取文件图标
    const FileIcon = ({ name, size = 7 }: { name: string; size?: number }) => {
        const ext = name.split('.').pop()?.toLowerCase() || '';
        const className = `w-${size} h-${size}`;

        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) {
            return <Image className={`${className} text-green-500`} />;
        }
        if (['mp4', 'webm', 'mkv', 'avi', 'mov'].includes(ext)) {
            return <Film className={`${className} text-purple-500`} />;
        }
        if (['mp3', 'wav', 'ogg', 'flac', 'aac'].includes(ext)) {
            return <Music className={`${className} text-pink-500`} />;
        }
        if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'pdf', 'txt', 'md'].includes(ext)) {
            return <FileText className={`${className} text-blue-500`} />;
        }
        return <File className={`${className} text-dark-400`} />;
    };

    // 加载中
    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-primary-50 to-blue-100 dark:from-dark-900 dark:to-dark-800 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
            </div>
        );
    }

    // 错误页面
    if (error || !shareData) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-primary-50 to-blue-100 dark:from-dark-900 dark:to-dark-800 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl p-8 text-center max-w-md w-full">
                    <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
                    </div>
                    <h1 className="text-xl font-semibold text-dark-900 dark:text-dark-100 mb-2">
                        分享链接无效
                    </h1>
                    <p className="text-dark-500 dark:text-dark-400">
                        该分享链接不存在或已过期
                    </p>
                </div>
            </div>
        );
    }

    // 密码验证页面
    if (shareData.is_password_protected && !isVerified) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-primary-50 to-blue-100 dark:from-dark-900 dark:to-dark-800 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl p-8 max-w-md w-full">
                    <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mx-auto mb-6">
                        <Lock className="w-8 h-8 text-primary-600 dark:text-primary-400" />
                    </div>
                    <h1 className="text-xl font-semibold text-dark-900 dark:text-dark-100 text-center mb-2">
                        需要密码访问
                    </h1>
                    <p className="text-dark-500 dark:text-dark-400 text-center mb-6">
                        此分享链接已设置密码保护
                    </p>
                    <form onSubmit={handleVerifyPassword}>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="请输入访问密码"
                            className="input mb-2"
                            autoFocus
                        />
                        {passwordError && (
                            <p className="text-sm text-red-600 dark:text-red-400 mb-4">
                                {passwordError}
                            </p>
                        )}
                        <button
                            type="submit"
                            className="btn btn-primary w-full mt-4"
                            disabled={isVerifying}
                        >
                            {isVerifying ? '验证中...' : '确认'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // 分享内容页面
    return (
        <div className="min-h-screen bg-gradient-to-br from-primary-50 to-blue-100 dark:from-dark-900 dark:to-dark-800 py-8 px-4">
            <div className="max-w-2xl mx-auto">
                {/* 头部 */}
                <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl overflow-hidden">
                    <div className="p-6 border-b border-dark-200 dark:border-dark-700">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                                {shareData.file_type === 'folder' ? (
                                    <Folder className="w-7 h-7 text-yellow-500" />
                                ) : (
                                    <FileIcon name={shareData.file_name} />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h1 className="text-xl font-semibold text-dark-900 dark:text-dark-100 truncate">
                                    {shareData.file_name}
                                </h1>
                                <div className="flex items-center gap-4 mt-1 text-sm text-dark-500">
                                    {shareData.file_size && (
                                        <span>{formatFileSize(shareData.file_size)}</span>
                                    )}
                                    <span className="flex items-center gap-1">
                                        <Eye className="w-4 h-4" />
                                        {shareData.view_count} 次查看
                                    </span>
                                    {shareData.expires_at && (
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-4 h-4" />
                                            {new Date(shareData.expires_at).toLocaleDateString('zh-CN')}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 操作区域 */}
                    <div className="p-6">
                        <button
                            onClick={() => handleDownload()}
                            className="btn btn-primary w-full flex items-center justify-center gap-2 py-3"
                            disabled={isDownloading}
                        >
                            {isDownloading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <Download className="w-5 h-5" />
                            )}
                            {isDownloading ? '准备下载...' : '下载文件'}
                        </button>

                        {shareData.max_downloads && (
                            <p className="text-center text-sm text-dark-500 mt-3">
                                剩余下载次数: {shareData.max_downloads - shareData.download_count}
                            </p>
                        )}
                    </div>
                </div>

                {/* 底部品牌 */}
                <div className="text-center mt-6 text-sm text-dark-500">
                    由 <span className="font-medium text-primary-600">CFDrive</span> 提供分享服务
                </div>
            </div>
        </div>
    );
}
