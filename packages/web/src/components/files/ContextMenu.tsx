import { useEffect, useRef } from 'react';
import {
    Download,
    Eye,
    Edit3,
    Copy,
    Move,
    Trash2,
    Share2,
    Star,
    StarOff,
    Info,
    FolderPlus,
} from 'lucide-react';
import type { DriveItem } from '../../stores/files';

interface ContextMenuProps {
    x: number;
    y: number;
    item: DriveItem | null;
    isFolder?: boolean;
    onClose: () => void;
    onOpen: () => void;
    onDownload: () => void;
    onRename: () => void;
    onCopy: () => void;
    onMove: () => void;
    onDelete: () => void;
    onShare: () => void;
    onToggleFavorite: () => void;
    onShowInfo: () => void;
    onNewFolder?: () => void;
    isFavorite?: boolean;
}

export default function ContextMenu({
    x,
    y,
    item,
    isFolder,
    onClose,
    onOpen,
    onDownload,
    onRename,
    onCopy,
    onMove,
    onDelete,
    onShare,
    onToggleFavorite,
    onShowInfo,
    onNewFolder,
    isFavorite = false,
}: ContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [onClose]);

    // 调整菜单位置，确保不超出屏幕
    const adjustedPosition = () => {
        const menuWidth = 200;
        const menuHeight = 350;
        const padding = 10;

        let adjustedX = x;
        let adjustedY = y;

        if (x + menuWidth > window.innerWidth - padding) {
            adjustedX = window.innerWidth - menuWidth - padding;
        }

        if (y + menuHeight > window.innerHeight - padding) {
            adjustedY = window.innerHeight - menuHeight - padding;
        }

        return { left: adjustedX, top: adjustedY };
    };

    const position = adjustedPosition();

    const menuItems = [
        // 打开
        { icon: Eye, label: '打开', onClick: onOpen, divider: false },
        // 下载（仅文件）
        ...(!isFolder ? [{ icon: Download, label: '下载', onClick: onDownload, divider: true }] : []),
        // 新建文件夹（仅在空白处右键或文件夹）
        ...(onNewFolder ? [{ icon: FolderPlus, label: '新建文件夹', onClick: onNewFolder, divider: false }] : []),
        // 分隔线后的操作
        { icon: Edit3, label: '重命名', onClick: onRename, divider: false },
        { icon: Copy, label: '复制', onClick: onCopy, divider: false },
        { icon: Move, label: '移动', onClick: onMove, divider: true },
        // 分享
        { icon: Share2, label: '分享', onClick: onShare, divider: false },
        // 收藏
        {
            icon: isFavorite ? StarOff : Star,
            label: isFavorite ? '取消收藏' : '添加收藏',
            onClick: onToggleFavorite,
            divider: true,
        },
        // 属性
        { icon: Info, label: '属性', onClick: onShowInfo, divider: true },
        // 删除
        { icon: Trash2, label: '删除', onClick: onDelete, divider: false, danger: true },
    ];

    return (
        <div
            ref={menuRef}
            className="fixed z-50 w-52 bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded-lg shadow-lg py-1 animate-fadeIn"
            style={position}
        >
            {item && (
                <div className="px-3 py-2 border-b border-dark-200 dark:border-dark-700">
                    <p className="text-sm font-medium text-dark-900 dark:text-dark-100 truncate">
                        {item.name}
                    </p>
                    <p className="text-xs text-dark-500">
                        {isFolder ? '文件夹' : '文件'}
                    </p>
                </div>
            )}
            {menuItems.map((menuItem, index) => (
                <div key={index}>
                    <button
                        onClick={() => {
                            menuItem.onClick();
                            onClose();
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors
              ${menuItem.danger
                                ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                                : 'text-dark-700 dark:text-dark-200 hover:bg-dark-100 dark:hover:bg-dark-700'
                            }
            `}
                    >
                        <menuItem.icon className="w-4 h-4" />
                        {menuItem.label}
                    </button>
                    {menuItem.divider && (
                        <div className="my-1 border-t border-dark-200 dark:border-dark-700" />
                    )}
                </div>
            ))}
        </div>
    );
}
