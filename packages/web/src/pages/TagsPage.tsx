import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tag as TagIcon, Plus, Edit2, Trash2, Hash } from 'lucide-react';
import { tagService } from '../services/api';
import toast from 'react-hot-toast';
import TagBadge from '../components/tags/TagBadge';

interface Tag {
    id: string;
    name: string;
    color: string;
    file_count: number;
}

const PRESET_COLORS = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
    '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6',
];

export default function TagsPage() {
    const queryClient = useQueryClient();
    const [isCreating, setIsCreating] = useState(false);
    const [editingTag, setEditingTag] = useState<Tag | null>(null);
    const [newTagName, setNewTagName] = useState('');
    const [newTagColor, setNewTagColor] = useState(PRESET_COLORS[0]);

    // 获取所有标签
    const { data, isLoading } = useQuery({
        queryKey: ['tags'],
        queryFn: async () => {
            const response = await tagService.getAll();
            return response.data;
        },
    });

    const tags = data?.tags || [];

    // 创建标签
    const createMutation = useMutation({
        mutationFn: (data: { name: string; color: string }) =>
            tagService.create(data.name, data.color),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tags'] });
            setIsCreating(false);
            setNewTagName('');
            setNewTagColor(PRESET_COLORS[0]);
            toast.success('标签已创建');
        },
        onError: (error: any) => {
            toast.error(error?.error?.message || '创建失败');
        },
    });

    // 更新标签
    const updateMutation = useMutation({
        mutationFn: ({ id, name, color }: { id: string; name?: string; color?: string }) =>
            tagService.update(id, name, color),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tags'] });
            setEditingTag(null);
            toast.success('标签已更新');
        },
        onError: (error: any) => {
            toast.error(error?.error?.message || '更新失败');
        },
    });

    // 删除标签
    const deleteMutation = useMutation({
        mutationFn: (id: string) => tagService.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tags'] });
            toast.success('标签已删除');
        },
        onError: () => {
            toast.error('删除失败');
        },
    });

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTagName.trim()) {
            toast.error('请输入标签名称');
            return;
        }
        createMutation.mutate({ name: newTagName.trim(), color: newTagColor });
    };

    const handleUpdate = () => {
        if (editingTag) {
            updateMutation.mutate({
                id: editingTag.id,
                name: newTagName || undefined,
                color: newTagColor !== editingTag.color ? newTagColor : undefined,
            });
        }
    };

    const handleDelete = (tag: Tag) => {
        if (confirm(`确定要删除标签 "${tag.name}" 吗？这将从所有文件中移除此标签。`)) {
            deleteMutation.mutate(tag.id);
        }
    };

    const startEdit = (tag: Tag) => {
        setEditingTag(tag);
        setNewTagName(tag.name);
        setNewTagColor(tag.color);
        setIsCreating(false);
    };

    const cancelEdit = () => {
        setEditingTag(null);
        setIsCreating(false);
        setNewTagName('');
        setNewTagColor(PRESET_COLORS[0]);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="max-w-4xl mx-auto">
                {/* 页头 */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                            <TagIcon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-dark-900 dark:text-dark-100">
                                标签管理
                            </h1>
                            <p className="text-sm text-dark-500 dark:text-dark-400">
                                共 {tags.length} 个标签
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            setIsCreating(true);
                            setEditingTag(null);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        创建标签
                    </button>
                </div>

                {/* 创建/编辑表单 */}
                {(isCreating || editingTag) && (
                    <div className="bg-white dark:bg-dark-800 rounded-xl p-6 shadow-sm border border-dark-200 dark:border-dark-700 mb-6">
                        <h3 className="text-lg font-semibold text-dark-900 dark:text-dark-100 mb-4">
                            {editingTag ? '编辑标签' : '创建新标签'}
                        </h3>
                        <form onSubmit={editingTag ? (e) => { e.preventDefault(); handleUpdate(); } : handleCreate} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                                    标签名称
                                </label>
                                <input
                                    type="text"
                                    value={newTagName}
                                    onChange={(e) => setNewTagName(e.target.value)}
                                    placeholder="输入标签名称"
                                    className="w-full px-4 py-2 bg-dark-50 dark:bg-dark-700 border border-dark-200 dark:border-dark-600 rounded-lg focus:outline-none focus:border-primary-500"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                                    标签颜色
                                </label>
                                <div className="flex gap-2">
                                    {PRESET_COLORS.map(color => (
                                        <button
                                            key={color}
                                            type="button"
                                            onClick={() => setNewTagColor(color)}
                                            className={`w-8 h-8 rounded-lg border-2 transition-all ${newTagColor === color
                                                ? 'border-dark-900 dark:border-white scale-110'
                                                : 'border-transparent hover:scale-105'
                                                }`}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    type="submit"
                                    disabled={!newTagName.trim() || createMutation.isPending || updateMutation.isPending}
                                    className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {editingTag ? '保存' : '创建'}
                                </button>
                                <button
                                    type="button"
                                    onClick={cancelEdit}
                                    className="px-4 py-2 border border-dark-300 dark:border-dark-600 text-dark-700 dark:text-dark-300 rounded-lg hover:bg-dark-50 dark:hover:bg-dark-700 transition-colors"
                                >
                                    取消
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* 标签列表 */}
                {tags.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-dark-100 dark:bg-dark-700 flex items-center justify-center">
                            <TagIcon className="w-8 h-8 text-dark-400" />
                        </div>
                        <h3 className="text-lg font-medium text-dark-900 dark:text-dark-100 mb-2">
                            还没有标签
                        </h3>
                        <p className="text-dark-500 dark:text-dark-400 mb-6">
                            创建标签来组织您的文件吧
                        </p>
                        <button
                            onClick={() => setIsCreating(true)}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            创建第一个标签
                        </button>
                    </div>
                ) : (
                    <div className="grid gap-3">
                        {tags.map(tag => (
                            <div
                                key={tag.id}
                                className="bg-white dark:bg-dark-800 rounded-xl p-4 shadow-sm border border-dark-200 dark:border-dark-700 hover:border-primary-500 dark:hover:border-primary-500 transition-colors"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4 flex-1">
                                        <TagBadge tag={tag} size="md" />
                                        <div className="flex items-center gap-2 text-sm text-dark-500">
                                            <Hash className="w-4 h-4" />
                                            <span>{tag.file_count} 个文件</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => startEdit(tag)}
                                            className="p-2 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 text-dark-500 hover:text-primary-600 transition-colors"
                                            title="编辑"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(tag)}
                                            disabled={deleteMutation.isPending}
                                            className="p-2 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 text-dark-500 hover:text-red-600 transition-colors disabled:opacity-50"
                                            title="删除"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
