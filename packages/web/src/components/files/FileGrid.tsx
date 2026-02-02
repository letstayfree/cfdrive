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
} from 'lucide-react';
import clsx from 'clsx';

interface FileGridProps {
    onContextMenu?: (e: React.MouseEvent, item: DriveItem) => void;
    onOpen?: (item: DriveItem) => void;
}

export default function FileGrid({ onContextMenu, onOpen }: FileGridProps) {
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 p-4">
            {items.map((item) => (
                <FileGridItem
                    key={item.id}
                    item={item}
                    isSelected={selectedIds.has(item.id)}
                    onClick={(e) => handleItemClick(item, e)}
                    onDoubleClick={() => handleDoubleClick(item)}
                    onContextMenu={(e) => handleContextMenu(e, item)}
                />
            ))}
        </div>
    );
}

interface FileGridItemProps {
    item: DriveItem;
    isSelected: boolean;
    onClick: (e: React.MouseEvent) => void;
    onDoubleClick: () => void;
    onContextMenu: (e: React.MouseEvent) => void;
}

function FileGridItem({ item, isSelected, onClick, onDoubleClick, onContextMenu }: FileGridItemProps) {
    const IconComponent = getFileIconComponent(item);
    const thumbnailUrl = item.thumbnails?.[0]?.medium?.url;

    return (
        <div
            className={clsx(
                'group relative bg-white dark:bg-dark-800 rounded-xl p-4 cursor-pointer transition-all border-2',
                isSelected
                    ? 'border-primary-500 shadow-lg'
                    : 'border-transparent hover:shadow-md hover:border-dark-200 dark:hover:border-dark-600'
            )}
            onClick={onClick}
            onDoubleClick={onDoubleClick}
            onContextMenu={onContextMenu}
        >
            {/* 缩略图/图标 */}
            <div className="aspect-square rounded-lg bg-dark-100 dark:bg-dark-700 flex items-center justify-center overflow-hidden mb-3">
                {thumbnailUrl && !item.folder ? (
                    <img
                        src={thumbnailUrl}
                        alt={item.name}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className={clsx('w-12 h-12', getFileIconColor(item))}>
                        <IconComponent className="w-full h-full" />
                    </div>
                )}
            </div>

            {/* 文件名 */}
            <div className="text-sm font-medium text-dark-900 dark:text-dark-100 truncate" title={item.name}>
                {item.name}
            </div>

            {/* 文件信息 */}
            <div className="mt-1 text-xs text-dark-500 dark:text-dark-400">
                {item.folder ? `${item.folder.childCount} 项` : formatFileSize(item.size)}
            </div>

            {/* 选中标识 */}
            {isSelected && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
            )}
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
