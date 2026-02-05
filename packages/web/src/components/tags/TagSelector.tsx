import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Tag as TagIcon, Check } from 'lucide-react';
import { tagService } from '../../services/api';
import toast from 'react-hot-toast';
import TagBadge from './TagBadge';

interface Tag {
    id: string;
    name: string;
    color: string;
    file_count?: number;
}

interface TagSelectorProps {
    fileId: string;
    selectedTags: Tag[];
    onTagsChange?: () => void;
}

const PRESET_COLORS = [
    '#3B82F6', // 蓝色
    '#10B981', // 绿色
    '#F59E0B', // 橙色
    '#EF4444', // 红色
    '#8B5CF6', // 紫色
    '#EC4899', // 粉色
    '#6366F1', // 靛蓝
    '#14B8A6', // 青色
];

export default function TagSelector({ fileId, selectedTags, onTagsChange }: TagSelectorProps) {
    const queryClient = useQueryClient();
    const [isOpen, setIsOpen] = useState(false);
    const [newTagName, setNewTagName] = useState('');
    const [newTagColor, setNewTagColor] = useState(PRESET_COLORS[0]);

    // 获取所有标签
    const { data: allTagsData } = useQuery({
        queryKey: ['tags'],
        queryFn: async () => {
            const response = await tagService.getAll();
            return response.data;
        },
    });

    const allTags = allTagsData?.tags || [];
    const selectedTagIds = new Set(selectedTags.map(t => t.id));

    // 创建新标签
    const createMutation = useMutation({
        mutationFn: (data: { name: string; color: string }) =>
            tagService.create(data.name, data.color),
        onSuccess: (response) => {
            queryClient.invalidateQueries({ queryKey: ['tags'] });
            setNewTagName('');
            setNewTagColor(PRESET_COLORS[0]);

            // 自动添加新创建的标签到文件
            if (response.data) {
                const newTag = response.data as Tag;
                addTagsMutation.mutate([newTag.id]);
            }
        },
        onError: (error: any) => {
            toast.error(error?.error?.message || '创建标签失败');
        },
    });

    // 添加标签到文件
    const addTagsMutation = useMutation({
        mutationFn: (tagIds: string[]) => tagService.addFileTags(fileId, tagIds),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['file-tags', fileId] });
            onTagsChange?.();
            toast.success('标签已添加');
        },
    });

    // 移除文件标签
    const removeTagMutation = useMutation({
        mutationFn: (tagId: string) => tagService.removeFileTag(fileId, tagId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['file-tags', fileId] });
            onTagsChange?.();
            toast.success('标签已移除');
        },
    });

    const handleCreateTag = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTagName.trim()) {
            toast.error('请输入标签名称');
            return;
        }
        createMutation.mutate({ name: newTagName.trim(), color: newTagColor });
    };

    const handleToggleTag = (tagId: string, isSelected: boolean) => {
        if (isSelected) {
            removeTagMutation.mutate(tagId);
        } else {
            addTagsMutation.mutate([tagId]);
        }
    };

    return (
        <div className="relative">
            {/* 已选标签显示 */}
            <div className="flex flex-wrap gap-2 mb-2">
                {selectedTags.map(tag => (
                    <TagBadge
                        key={tag.id}
                        tag={tag}
                        onRemove={() => removeTagMutation.mutate(tag.id)}
                    />
                ))}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-dashed border-dark-300 dark:border-dark-600 text-dark-500 hover:border-primary-500 hover:text-primary-600 transition-colors"
                >
                    <Plus className="w-3 h-3" />
                    添加标签
                </button>
            </div>

            {/* 标签选择器下拉 */}
            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-80 bg-white dark:bg-dark-800 rounded-xl shadow-lg border border-dark-200 dark:border-dark-700 z-50 p-4">
                    {/* 现有标签列表 */}
                    <div className="mb-4">
                        <h4 className="text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                            选择标签
                        </h4>
                        <div className="max-h-48 overflow-y-auto space-y-1">
                            {allTags.length === 0 ? (
                                <p className="text-sm text-dark-500 text-center py-4">
                                    暂无标签，创建一个新标签吧
                                </p>
                            ) : (
                                allTags.map(tag => {
                                    const isSelected = selectedTagIds.has(tag.id);
                                    return (
                                        <button
                                            key={tag.id}
                                            onClick={() => handleToggleTag(tag.id, isSelected)}
                                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-dark-50 dark:hover:bg-dark-700 transition-colors"
                                        >
                                            <div
                                                className="w-4 h-4 rounded border-2 flex items-center justify-center"
                                                style={{
                                                    borderColor: isSelected ? tag.color : '#D1D5DB',
                                                    backgroundColor: isSelected ? tag.color : 'transparent',
                                                }}
                                            >
                                                {isSelected && <Check className="w-3 h-3 text-white" />}
                                            </div>
                                            <TagBadge tag={tag} />
                                            <span className="ml-auto text-xs text-dark-400">
                                                {tag.file_count || 0}
                                            </span>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* 创建新标签 */}
                    <div className="border-t border-dark-200 dark:border-dark-700 pt-4">
                        <h4 className="text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                            创建新标签
                        </h4>
                        <form onSubmit={handleCreateTag} className="space-y-3">
                            <input
                                type="text"
                                value={newTagName}
                                onChange={(e) => setNewTagName(e.target.value)}
                                placeholder="标签名称"
                                className="w-full px-3 py-2 bg-dark-50 dark:bg-dark-700 border border-dark-200 dark:border-dark-600 rounded-lg focus:outline-none focus:border-primary-500"
                            />
                            <div className="flex gap-2">
                                {PRESET_COLORS.map(color => (
                                    <button
                                        key={color}
                                        type="button"
                                        onClick={() => setNewTagColor(color)}
                                        className={`w-6 h-6 rounded-full border-2 ${newTagColor === color ? 'border-dark-900 dark:border-white' : 'border-transparent'
                                            }`}
                                        style={{ backgroundColor: color }}
                                    />
                                ))}
                            </div>
                            <button
                                type="submit"
                                disabled={!newTagName.trim() || createMutation.isPending}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <TagIcon className="w-4 h-4" />
                                创建并添加
                            </button>
                        </form>
                    </div>

                    {/* 关闭按钮 */}
                    <button
                        onClick={() => setIsOpen(false)}
                        className="absolute top-2 right-2 p-1 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700"
                    >
                        <Plus className="w-4 h-4 rotate-45" />
                    </button>
                </div>
            )}

            {/* 点击外部关闭 */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </div>
    );
}
