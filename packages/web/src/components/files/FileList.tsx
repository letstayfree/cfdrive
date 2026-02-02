import { useFilesStore, type DriveItem } from '../../stores/files';
import { formatFileSize } from '../../utils/file';
import {
    Folder,
    FileText,
    Image,
    Film,
    Music,
    FileCode,
    File,
    MoreVertical,
} from 'lucide-react';
import clsx from 'clsx';

interface FileListProps {
    onContextMenu?: (e: React.MouseEvent, item: DriveItem) => void;
    onOpen?: (item: DriveItem) => void;
}

export default function FileList({ onContextMenu, onOpen }: FileListProps) {
    const { items, selectedIds, toggleSelectItem, clearSelection } = useFilesStore();

    const handleItemClick = (item: DriveItem, e: React.MouseEvent) => {
        if (e.ctrlKey || e.metaKey) {
            toggleSelectItem(item.id);
        } else {
            clearSelection();
            toggleSelectItem(item.id);
        }
    };

    const handleDoubleClick = (item: DriveItem) => {
        if (onOpen) {
            onOpen(item);
        }
    };

    const handleContextMenu = (e: React.MouseEvent, item: DriveItem) => {
        e.preventDefault();
        e.stopPropagation();
        if (onContextMenu) {
            onContextMenu(e, item);
        }
    };

    return (
        <div className="bg-white dark:bg-dark-800 rounded-xl shadow-sm overflow-hidden m-4">
            {/* 表头 */}
            <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-dark-50 dark:bg-dark-700/50 text-sm font-medium text-dark-500 dark:text-dark-400 border-b border-dark-200 dark:border-dark-700">
                <div className="col-span-6">名称</div>
                <div className="col-span-2">修改时间</div>
                <div className="col-span-2">大小</div>
                <div className="col-span-2 text-right">操作</div>
            </div>

            {/* 文件列表 */}
            <div className="divide-y divide-dark-100 dark:divide-dark-700">
                {items.map((item) => (
                    <FileListItem
                        key={item.id}
                        item={item}
                        isSelected={selectedIds.has(item.id)}
                        onClick={(e) => handleItemClick(item, e)}
                        onDoubleClick={() => handleDoubleClick(item)}
                        onContextMenu={(e) => handleContextMenu(e, item)}
                    />
                ))}
            </div>
        </div>
    );
}

interface FileListItemProps {
    item: DriveItem;
    isSelected: boolean;
    onClick: (e: React.MouseEvent) => void;
    onDoubleClick: () => void;
    onContextMenu: (e: React.MouseEvent) => void;
}

function FileListItem({ item, isSelected, onClick, onDoubleClick, onContextMenu }: FileListItemProps) {
    const IconComponent = getFileIconComponent(item);

    return (
        <div
            className={clsx(
                'grid grid-cols-12 gap-4 px-4 py-3 cursor-pointer transition-colors',
                isSelected
                    ? 'bg-primary-50 dark:bg-primary-900/20'
                    : 'hover:bg-dark-50 dark:hover:bg-dark-700/50'
            )}
            onClick={onClick}
            onDoubleClick={onDoubleClick}
            onContextMenu={onContextMenu}
        >
            {/* 名称 */}
            <div className="col-span-6 flex items-center gap-3 min-w-0">
                <div className={clsx('flex-shrink-0', getFileIconColor(item))}>
                    <IconComponent className="w-5 h-5" />
                </div>
                <span className="truncate text-dark-900 dark:text-dark-100">{item.name}</span>
            </div>

            {/* 修改时间 */}
            <div className="col-span-2 flex items-center text-sm text-dark-500 dark:text-dark-400">
                {formatDate(item.lastModifiedDateTime)}
            </div>

            {/* 大小 */}
            <div className="col-span-2 flex items-center text-sm text-dark-500 dark:text-dark-400">
                {item.folder ? `${item.folder.childCount} 项` : formatFileSize(item.size)}
            </div>

            {/* 操作 */}
            <div className="col-span-2 flex items-center justify-end">
                <button
                    className="p-1.5 rounded-lg text-dark-400 hover:text-dark-600 dark:hover:text-dark-300 hover:bg-dark-100 dark:hover:bg-dark-600 transition-colors"
                    onClick={(e) => {
                        e.stopPropagation();
                        onContextMenu(e);
                    }}
                >
                    <MoreVertical className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}

function getFileIconComponent(item: DriveItem) {
    if (item.folder) return Folder;

    const ext = item.name.split('.').pop()?.toLowerCase() || '';

    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return Image;
    if (['mp4', 'webm', 'mkv', 'avi', 'mov'].includes(ext)) return Film;
    if (['mp3', 'wav', 'ogg', 'flac', 'aac'].includes(ext)) return Music;
    if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'c', 'cpp', 'go', 'rs', 'html', 'css', 'json'].includes(ext)) return FileCode;
    if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'pdf', 'txt', 'md'].includes(ext)) return FileText;

    return File;
}

function getFileIconColor(item: DriveItem) {
    if (item.folder) return 'text-yellow-500';

    const ext = item.name.split('.').pop()?.toLowerCase() || '';

    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'text-green-500';
    if (['mp4', 'webm', 'mkv', 'avi', 'mov'].includes(ext)) return 'text-purple-500';
    if (['mp3', 'wav', 'ogg', 'flac', 'aac'].includes(ext)) return 'text-pink-500';
    if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'c', 'cpp', 'go', 'rs', 'html', 'css', 'json'].includes(ext)) return 'text-emerald-500';
    if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'pdf', 'txt', 'md'].includes(ext)) return 'text-blue-500';

    return 'text-dark-400';
}

function formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return '今天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
        return '昨天';
    } else if (diffDays < 7) {
        return `${diffDays} 天前`;
    } else {
        return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });
    }
}
