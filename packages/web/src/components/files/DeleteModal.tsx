import { X, AlertTriangle, Trash2 } from 'lucide-react';
import type { DriveItem } from '../../stores/files';

interface DeleteModalProps {
    isOpen: boolean;
    items: DriveItem[];
    onClose: () => void;
    onConfirm: () => void;
    isLoading?: boolean;
}

export default function DeleteModal({
    isOpen,
    items,
    onClose,
    onConfirm,
    isLoading = false,
}: DeleteModalProps) {
    if (!isOpen || items.length === 0) return null;

    const isSingleItem = items.length === 1;
    const item = items[0];
    const hasFolder = items.some((i) => i.folder);
    const folderCount = items.filter((i) => i.folder).length;
    const fileCount = items.length - folderCount;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fadeIn">
            <div className="bg-white dark:bg-dark-800 rounded-xl shadow-xl w-full max-w-md mx-4">
                <div className="flex items-center justify-between p-4 border-b border-dark-200 dark:border-dark-700">
                    <h3 className="text-lg font-semibold text-dark-900 dark:text-dark-100 flex items-center gap-2">
                        <Trash2 className="w-5 h-5 text-red-500" />
                        确认删除
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
                    >
                        <X className="w-5 h-5 text-dark-500" />
                    </button>
                </div>

                <div className="p-4">
                    <div className="flex items-start gap-3 mb-4">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                        </div>
                        <div>
                            {isSingleItem ? (
                                <p className="text-dark-700 dark:text-dark-300">
                                    确定要删除{item.folder ? '文件夹' : '文件'}{' '}
                                    <span className="font-medium text-dark-900 dark:text-dark-100">
                                        "{item.name}"
                                    </span>{' '}
                                    吗？
                                </p>
                            ) : (
                                <p className="text-dark-700 dark:text-dark-300">
                                    确定要删除选中的 {items.length} 个项目吗？
                                    <br />
                                    <span className="text-sm text-dark-500">
                                        （{fileCount > 0 && `${fileCount} 个文件`}
                                        {fileCount > 0 && folderCount > 0 && '、'}
                                        {folderCount > 0 && `${folderCount} 个文件夹`}）
                                    </span>
                                </p>
                            )}
                            {hasFolder && (
                                <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
                                    ⚠️ 文件夹内的所有内容也将被删除
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="btn btn-secondary"
                            disabled={isLoading}
                        >
                            取消
                        </button>
                        <button
                            onClick={onConfirm}
                            className="btn bg-red-600 hover:bg-red-700 text-white"
                            disabled={isLoading}
                        >
                            {isLoading ? '删除中...' : '删除'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
