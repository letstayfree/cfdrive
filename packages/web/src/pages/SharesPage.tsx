import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { shareService } from '../services/api';
import {
    Link2,
    Copy,
    Check,
    Trash2,
    Eye,
    Download,
    Calendar,
    Lock,
    ExternalLink,
    Loader2,
    Share2,
} from 'lucide-react';

interface ShareItem {
    id: string;
    code: string;
    file_id: string;
    file_name: string;
    file_path: string;
    file_type: 'file' | 'folder';
    file_size: number;
    is_password_protected: boolean;
    expires_at: string | null;
    max_downloads: number | null;
    download_count: number;
    view_count: number;
    created_at: string;
    is_active: boolean;
}

export default function SharesPage() {
    const queryClient = useQueryClient();
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [deleteModalId, setDeleteModalId] = useState<string | null>(null);

    // 获取分享列表
    const { data: sharesData, isLoading } = useQuery({
        queryKey: ['shares'],
        queryFn: async () => {
            const response = await shareService.list();
            return response.data as { items: ShareItem[] };
        },
    });

    // 删除分享
    const deleteMutation = useMutation({
        mutationFn: (shareId: string) => shareService.delete(shareId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['shares'] });
            setDeleteModalId(null);
        },
    });

    const handleCopyLink = async (code: string, id: string) => {
        const link = `${window.location.origin}/s/${code}`;
        try {
            await navigator.clipboard.writeText(link);
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
        } catch {
            // 降级方案
            const input = document.createElement('input');
            input.value = link;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const isExpired = (expiresAt: string | null) => {
        if (!expiresAt) return false;
        return new Date(expiresAt) < new Date();
    };

    return (
        <div className="p-6">
            {/* 头部 */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-dark-900 dark:text-dark-100 flex items-center gap-2">
                        <Share2 className="w-7 h-7" />
                        我的分享
                    </h1>
                    <p className="text-dark-500 mt-1">
                        共 {sharesData?.items?.length || 0} 个分享链接
                    </p>
                </div>
            </div>

            {/* 分享列表 */}
            <div className="bg-white dark:bg-dark-800 rounded-xl shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
                    </div>
                ) : !sharesData?.items?.length ? (
                    <div className="flex flex-col items-center justify-center py-12 text-dark-500">
                        <Link2 className="w-12 h-12 mb-3 opacity-50" />
                        <p>暂无分享链接</p>
                        <p className="text-sm mt-1">在文件上右键选择"分享"来创建分享链接</p>
                    </div>
                ) : (
                    <div className="divide-y divide-dark-100 dark:divide-dark-700">
                        {sharesData.items.map((share) => (
                            <div
                                key={share.id}
                                className={`p-4 hover:bg-dark-50 dark:hover:bg-dark-700/50 transition-colors ${!share.is_active || isExpired(share.expires_at)
                                    ? 'opacity-60'
                                    : ''
                                    }`}
                            >
                                <div className="flex items-start gap-4">
                                    {/* 图标 */}
                                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${share.file_type === 'folder'
                                        ? 'bg-yellow-100 dark:bg-yellow-900/30'
                                        : 'bg-blue-100 dark:bg-blue-900/30'
                                        }`}>
                                        <Link2 className={`w-6 h-6 ${share.file_type === 'folder'
                                            ? 'text-yellow-600 dark:text-yellow-400'
                                            : 'text-blue-600 dark:text-blue-400'
                                            }`} />
                                    </div>

                                    {/* 信息 */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-medium text-dark-900 dark:text-dark-100 truncate">
                                                {share.file_name}
                                            </h3>
                                            {share.is_password_protected && (
                                                <Lock className="w-4 h-4 text-amber-500 flex-shrink-0" />
                                            )}
                                            {isExpired(share.expires_at) && (
                                                <span className="px-2 py-0.5 text-xs bg-red-100 text-red-600 rounded-full">
                                                    已过期
                                                </span>
                                            )}
                                            {!share.is_active && (
                                                <span className="px-2 py-0.5 text-xs bg-dark-100 text-dark-600 rounded-full">
                                                    已停用
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-4 text-sm text-dark-500">
                                            <span className="flex items-center gap-1">
                                                <Eye className="w-4 h-4" />
                                                {share.view_count} 次查看
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Download className="w-4 h-4" />
                                                {share.download_count}
                                                {share.max_downloads ? `/${share.max_downloads}` : ''} 次下载
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Calendar className="w-4 h-4" />
                                                {formatDate(share.created_at)}
                                            </span>
                                            {share.expires_at && (
                                                <span className="flex items-center gap-1">
                                                    到期: {formatDate(share.expires_at)}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* 操作按钮 */}
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <button
                                            onClick={() => handleCopyLink(share.code, share.id)}
                                            className="btn btn-secondary flex items-center gap-2"
                                        >
                                            {copiedId === share.id ? (
                                                <>
                                                    <Check className="w-4 h-4" />
                                                    已复制
                                                </>
                                            ) : (
                                                <>
                                                    <Copy className="w-4 h-4" />
                                                    复制链接
                                                </>
                                            )}
                                        </button>
                                        <a
                                            href={`/s/${share.code}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-2 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-600 transition-colors"
                                            title="访问链接"
                                        >
                                            <ExternalLink className="w-5 h-5 text-dark-400" />
                                        </a>
                                        <button
                                            onClick={() => setDeleteModalId(share.id)}
                                            className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                            title="删除分享"
                                        >
                                            <Trash2 className="w-5 h-5 text-red-500" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* 删除确认弹窗 */}
            {deleteModalId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white dark:bg-dark-800 rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
                        <h3 className="text-lg font-semibold text-dark-900 dark:text-dark-100 mb-2">
                            确认删除分享
                        </h3>
                        <p className="text-dark-600 dark:text-dark-400 mb-6">
                            删除后，使用此链接的用户将无法再访问文件。此操作不可撤销。
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setDeleteModalId(null)}
                                className="btn btn-secondary"
                            >
                                取消
                            </button>
                            <button
                                onClick={() => deleteMutation.mutate(deleteModalId)}
                                className="btn bg-red-600 hover:bg-red-700 text-white"
                                disabled={deleteMutation.isPending}
                            >
                                {deleteMutation.isPending ? '删除中...' : '删除'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
