import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { fileService } from '../services/api';
import {
    Trash2,
    File,
    Folder,
    RotateCcw,
    XCircle,
    Loader2,
    Clock,
    AlertTriangle,
    FolderOpen,
    ExternalLink,
} from 'lucide-react';
import { formatFileSize, formatDate } from '../utils/file';
import toast from 'react-hot-toast';

// 删除记录的类型定义
interface DeletedItem {
    id: string;
    fileId: string;
    name: string;
    path: string;
    folder?: object;
    size: number;
    deletedAt: string;
    parentId: string | null;
    metadata?: {
        mimeType?: string;
        webUrl?: string;
        createdDateTime?: string;
        lastModifiedDateTime?: string;
    };
}

interface ApiResponse {
    success: boolean;
    data?: { items: DeletedItem[] } | {
        message: string;
        note: string;
        fileId: string;
        fileName: string;
        oneDriveUrl: string;
    };
    error?: {
        code?: string;
        message?: string;
    };
}

export default function TrashPage() {
    const queryClient = useQueryClient();
    const location = useLocation();

    // 获取回收站内容
    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ['trash'],
        queryFn: async () => {
            const response = await fileService.getTrash() as ApiResponse;
            if (response.success && response.data && 'items' in response.data) {
                return response.data.items || [];
            }
            throw new Error(response.error?.message || '获取回收站失败');
        },
        retry: false,
    });

    // 监听路由变化，刷新数据
    useEffect(() => {
        refetch();
    }, [location.pathname, refetch]);

    // 恢复文件
    const restoreMutation = useMutation({
        mutationFn: (itemId: string) => fileService.restore(itemId),
        onSuccess: (response) => {
            queryClient.invalidateQueries({ queryKey: ['trash'] });
            queryClient.invalidateQueries({ queryKey: ['files'] });

            // 检查响应类型
            const data = response.data;
            const message = response.message;

            // 如果有 message 字段且包含"成功恢复"，说明 API 恢复成功
            if (message && message.includes('成功')) {
                toast.success('✅ 文件已成功恢复到原位置');
            }
            // 如果 data 有 note 字段，说明需要手动恢复
            else if (data && typeof data === 'object' && 'note' in data) {
                const noteData = data as { note: string; oneDriveUrl?: string; fileName?: string };
                toast((t) => (
                    <div className="flex flex-col gap-2">
                        <p className="font-medium">⚠️ 已从回收站记录中移除</p>
                        <p className="text-sm text-dark-500">{noteData.note}</p>
                        {noteData.oneDriveUrl && (
                            <a
                                href={noteData.oneDriveUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
                                onClick={() => toast.dismiss(t.id)}
                            >
                                <ExternalLink className="w-3 h-3" />
                                打开 OneDrive 回收站手动恢复
                            </a>
                        )}
                    </div>
                ), { duration: 10000 });
            } else {
                toast.success('已恢复');
            }
        },
        onError: (error: Error) => {
            toast.error(error.message || '恢复失败');
        },
    });

    // 永久删除
    const deleteMutation = useMutation({
        mutationFn: (itemId: string) => fileService.permanentDelete(itemId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['trash'] });
            toast.success('已永久删除');
        },
        onError: () => {
            toast.error('删除失败');
        },
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-dark-500 p-6">
                <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-lg border border-dark-200 dark:border-dark-700 p-8 max-w-md text-center">
                    <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-xl font-semibold text-dark-900 dark:text-dark-100 mb-2">
                        回收站加载失败
                    </h2>
                    <p className="text-dark-500 mb-6">
                        {(error as Error).message || '无法获取回收站内容，请稍后重试。'}
                    </p>
                </div>
            </div>
        );
    }

    const trashItems = data || [];

    return (
        <div className="p-6">
            {/* 头部 */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-dark-900 dark:text-dark-100 flex items-center gap-2">
                    <Trash2 className="w-6 h-6 text-dark-500" />
                    回收站
                </h1>
                <p className="text-dark-500 mt-1">
                    共 {trashItems.length} 个已删除项目（保留30天）
                </p>
            </div>

            {/* 回收站列表 */}
            {trashItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-dark-500">
                    <Trash2 className="w-16 h-16 mb-4 text-dark-300" />
                    <p className="text-lg">回收站为空</p>
                    <p className="text-sm mt-1">已删除的文件会在这里显示</p>
                </div>
            ) : (
                <div className="bg-white dark:bg-dark-800 rounded-xl shadow-sm border border-dark-200 dark:border-dark-700 overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-dark-50 dark:bg-dark-900 border-b border-dark-200 dark:border-dark-700">
                                <th className="px-4 py-3 text-left text-sm font-medium text-dark-600 dark:text-dark-400">
                                    名称
                                </th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-dark-600 dark:text-dark-400 hidden lg:table-cell">
                                    原位置
                                </th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-dark-600 dark:text-dark-400 hidden md:table-cell">
                                    大小
                                </th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-dark-600 dark:text-dark-400 hidden sm:table-cell">
                                    删除时间
                                </th>
                                <th className="px-4 py-3 text-right text-sm font-medium text-dark-600 dark:text-dark-400">
                                    操作
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-100 dark:divide-dark-700">
                            {trashItems.map((item) => (
                                <tr
                                    key={item.id}
                                    className="hover:bg-dark-50 dark:hover:bg-dark-700/50 transition-colors"
                                >
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${item.folder
                                                ? 'bg-yellow-100 dark:bg-yellow-900/30'
                                                : 'bg-blue-100 dark:bg-blue-900/30'
                                                }`}>
                                                {item.folder ? (
                                                    <Folder className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                                                ) : (
                                                    <File className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <span className="font-medium text-dark-900 dark:text-dark-100 truncate block max-w-xs">
                                                    {item.name}
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 hidden lg:table-cell">
                                        <div className="flex items-center gap-1 text-sm text-dark-500 max-w-xs truncate">
                                            <FolderOpen className="w-4 h-4 flex-shrink-0" />
                                            <span className="truncate">{item.path || '根目录'}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-dark-500 hidden md:table-cell">
                                        {item.folder ? '-' : formatFileSize(item.size)}
                                    </td>
                                    <td className="px-4 py-3 hidden sm:table-cell">
                                        <div className="flex items-center gap-1 text-sm text-dark-500">
                                            <Clock className="w-4 h-4" />
                                            {item.deletedAt ? formatDate(item.deletedAt) : '-'}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                onClick={() => restoreMutation.mutate(item.id)}
                                                disabled={restoreMutation.isPending}
                                                className="p-2 rounded-lg text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors disabled:opacity-50"
                                                title="恢复"
                                            >
                                                <RotateCcw className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (confirm('确定要永久删除吗？此操作不可恢复。')) {
                                                        deleteMutation.mutate(item.id);
                                                    }
                                                }}
                                                disabled={deleteMutation.isPending}
                                                className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
                                                title="永久删除"
                                            >
                                                <XCircle className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
