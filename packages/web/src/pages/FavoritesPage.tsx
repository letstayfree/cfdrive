import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { favoriteService, fileService } from '../services/api';
import {
    Star,
    File,
    Folder,
    Trash2,
    Download,
    ExternalLink,
    Loader2,
    Clock,
} from 'lucide-react';
import { formatDate } from '../utils/file';
import toast from 'react-hot-toast';

interface FavoriteItem {
    id: string;
    file_id: string;
    file_name: string;
    file_path: string;
    file_type: 'file' | 'folder';
    created_at: string;
}

export default function FavoritesPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    // 获取收藏列表
    const { data, isLoading, error } = useQuery({
        queryKey: ['favorites'],
        queryFn: async () => {
            const response = await favoriteService.list();
            if (response.success && response.data) {
                return response.data.items;
            }
            throw new Error('获取收藏列表失败');
        },
    });

    // 取消收藏
    const removeMutation = useMutation({
        mutationFn: (fileId: string) => favoriteService.remove(fileId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['favorites'] });
            toast.success('已取消收藏');
        },
        onError: () => {
            toast.error('取消收藏失败');
        },
    });

    // 下载文件
    const handleDownload = async (item: FavoriteItem) => {
        if (item.file_type === 'folder') {
            toast.error('文件夹暂不支持下载');
            return;
        }

        try {
            const response = await fileService.getDownloadUrl(item.file_id);
            if (response.success && response.data) {
                const data = response.data as { downloadUrl: string };
                window.open(data.downloadUrl, '_blank');
            }
        } catch {
            toast.error('获取下载链接失败');
        }
    };

    // 打开文件/文件夹
    const handleOpen = (item: FavoriteItem) => {
        if (item.file_type === 'folder') {
            navigate(`/drive/${item.file_id}`);
        } else {
            // 对于文件，跳转到其所在文件夹
            navigate(`/drive`);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-dark-500">
                <p>加载失败</p>
            </div>
        );
    }

    const favorites = data || [];

    return (
        <div className="p-6">
            {/* 头部 */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-dark-900 dark:text-dark-100 flex items-center gap-2">
                    <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
                    我的收藏
                </h1>
                <p className="text-dark-500 mt-1">
                    共 {favorites.length} 个收藏项目
                </p>
            </div>

            {/* 收藏列表 */}
            {favorites.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-dark-500">
                    <Star className="w-16 h-16 mb-4 text-dark-300" />
                    <p className="text-lg">暂无收藏</p>
                    <p className="text-sm mt-1">右键文件或文件夹添加收藏</p>
                </div>
            ) : (
                <div className="bg-white dark:bg-dark-800 rounded-xl shadow-sm border border-dark-200 dark:border-dark-700 overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-dark-50 dark:bg-dark-900 border-b border-dark-200 dark:border-dark-700">
                                <th className="px-4 py-3 text-left text-sm font-medium text-dark-600 dark:text-dark-400">
                                    名称
                                </th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-dark-600 dark:text-dark-400 hidden md:table-cell">
                                    位置
                                </th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-dark-600 dark:text-dark-400 hidden sm:table-cell">
                                    收藏时间
                                </th>
                                <th className="px-4 py-3 text-right text-sm font-medium text-dark-600 dark:text-dark-400">
                                    操作
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-100 dark:divide-dark-700">
                            {favorites.map((item) => (
                                <tr
                                    key={item.id}
                                    className="hover:bg-dark-50 dark:hover:bg-dark-700/50 transition-colors"
                                >
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${item.file_type === 'folder'
                                                ? 'bg-yellow-100 dark:bg-yellow-900/30'
                                                : 'bg-blue-100 dark:bg-blue-900/30'
                                                }`}>
                                                {item.file_type === 'folder' ? (
                                                    <Folder className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                                                ) : (
                                                    <File className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <button
                                                    onClick={() => handleOpen(item)}
                                                    className="font-medium text-dark-900 dark:text-dark-100 hover:text-primary-600 dark:hover:text-primary-400 truncate block max-w-xs"
                                                >
                                                    {item.file_name}
                                                </button>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-dark-500 hidden md:table-cell">
                                        {item.file_path || '/'}
                                    </td>
                                    <td className="px-4 py-3 hidden sm:table-cell">
                                        <div className="flex items-center gap-1 text-sm text-dark-500">
                                            <Clock className="w-4 h-4" />
                                            {formatDate(item.created_at)}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-end gap-1">
                                            {item.file_type === 'file' && (
                                                <button
                                                    onClick={() => handleDownload(item)}
                                                    className="p-2 rounded-lg text-dark-500 hover:bg-dark-100 dark:hover:bg-dark-600 transition-colors"
                                                    title="下载"
                                                >
                                                    <Download className="w-4 h-4" />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleOpen(item)}
                                                className="p-2 rounded-lg text-dark-500 hover:bg-dark-100 dark:hover:bg-dark-600 transition-colors"
                                                title="打开"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => removeMutation.mutate(item.file_id)}
                                                disabled={removeMutation.isPending}
                                                className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                                                title="取消收藏"
                                            >
                                                <Trash2 className="w-4 h-4" />
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
