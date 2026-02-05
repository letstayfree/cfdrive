import { Trash2, Download, Move, Copy, X, Tag } from 'lucide-react';
import { useFilesStore, DriveItem } from '../../stores/files';

interface BatchActionsBarProps {
    onDelete: (items: DriveItem[]) => void;
    onMove: (items: DriveItem[]) => void;
    onCopy: (items: DriveItem[]) => void;
    onDownload?: (item: DriveItem) => void;
}

export default function BatchActionsBar({ onDelete, onMove, onCopy, onDownload }: BatchActionsBarProps) {
    const { items, selectedIds, clearSelection } = useFilesStore();

    const selectedItems = items.filter((item) => selectedIds.has(item.id));
    const count = selectedItems.length;

    if (count === 0) return null;

    const handleDownloadAll = () => {
        if (onDownload) {
            selectedItems.forEach((item) => {
                if (!item.folder) {
                    onDownload(item);
                }
            });
        }
    };

    const downloadableCount = selectedItems.filter((i) => !i.folder).length;

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-dark-900 dark:bg-dark-800 text-white rounded-xl shadow-2xl px-4 py-3 flex items-center gap-4 animate-slideUp">
            <div className="flex items-center gap-2 pr-4 border-r border-dark-700">
                <span className="font-medium">{count}</span>
                <span className="text-dark-400">项已选中</span>
            </div>

            <div className="flex items-center gap-1">
                {downloadableCount > 0 && onDownload && (
                    <button
                        onClick={handleDownloadAll}
                        className="p-2 rounded-lg hover:bg-dark-700 transition-colors flex items-center gap-2"
                        title="下载"
                    >
                        <Download className="w-5 h-5" />
                        <span className="text-sm">下载</span>
                    </button>
                )}

                <button
                    onClick={() => onMove(selectedItems)}
                    className="p-2 rounded-lg hover:bg-dark-700 transition-colors flex items-center gap-2"
                    title="移动"
                >
                    <Move className="w-5 h-5" />
                    <span className="text-sm">移动</span>
                </button>

                <button
                    onClick={() => onCopy(selectedItems)}
                    className="p-2 rounded-lg hover:bg-dark-700 transition-colors flex items-center gap-2"
                    title="复制"
                >
                    <Copy className="w-5 h-5" />
                    <span className="text-sm">复制</span>
                </button>

                <button
                    onClick={() => onDelete(selectedItems)}
                    className="p-2 rounded-lg hover:bg-red-600/20 text-red-400 transition-colors flex items-center gap-2"
                    title="删除"
                >
                    <Trash2 className="w-5 h-5" />
                    <span className="text-sm">删除</span>
                </button>
            </div>

            <button
                onClick={clearSelection}
                className="p-2 rounded-lg hover:bg-dark-700 transition-colors ml-2"
                title="取消选择"
            >
                <X className="w-5 h-5" />
            </button>
        </div>
    );
}
