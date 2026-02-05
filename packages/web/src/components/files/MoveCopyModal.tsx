import { useState, useEffect } from 'react';
import { X, Folder, ChevronRight, Loader2, FolderOpen, ArrowLeft } from 'lucide-react';
import { fileService } from '../../services/api';
import type { DriveItem } from '../../stores/files';

interface MoveCopyModalProps {
    isOpen: boolean;
    mode: 'move' | 'copy';
    items: DriveItem[];
    onClose: () => void;
    onConfirm: (targetFolderId: string) => void;
    isLoading?: boolean;
}

interface FolderItem {
    id: string;
    name: string;
    parentId?: string;
}

export default function MoveCopyModal({
    isOpen,
    mode,
    items,
    onClose,
    onConfirm,
    isLoading = false,
}: MoveCopyModalProps) {
    const [folders, setFolders] = useState<FolderItem[]>([]);
    const [currentFolderId, setCurrentFolderId] = useState('root');
    const [selectedFolderId, setSelectedFolderId] = useState('root');
    const [selectedFolderName, setSelectedFolderName] = useState('我的网盘');
    const [pathStack, setPathStack] = useState<FolderItem[]>([{ id: 'root', name: '我的网盘' }]);
    const [isFetching, setIsFetching] = useState(false);

    // 获取文件夹列表
    useEffect(() => {
        if (!isOpen) return;

        const fetchFolders = async () => {
            setIsFetching(true);
            try {
                console.log('[MoveCopyModal] Fetching folders from:', currentFolderId);
                const response = await fileService.list(currentFolderId);
                if (response.success && response.data) {
                    const data = response.data as { items: DriveItem[] };
                    // 只显示文件夹，排除正在移动/复制的项目
                    const folderItems = data.items
                        .filter(item => item.folder && !items.some(i => i.id === item.id))
                        .map(item => ({
                            id: item.id,
                            name: item.name,
                            parentId: currentFolderId,
                        }));
                    console.log('[MoveCopyModal] Found folders:', folderItems.map(f => f.name));
                    setFolders(folderItems);
                }
            } catch (error) {
                console.error('Fetch folders error:', error);
            } finally {
                setIsFetching(false);
            }
        };

        fetchFolders();
    }, [isOpen, currentFolderId, items]);

    // 重置状态
    useEffect(() => {
        if (isOpen) {
            setCurrentFolderId('root');
            setSelectedFolderId('root');  // 默认选中 root
            setPathStack([{ id: 'root', name: '我的网盘' }]);
            console.log('[MoveCopyModal] Modal opened, root folder selected by default');
        }
    }, [isOpen]);

    const handleFolderClick = (folder: FolderItem) => {
        setSelectedFolderId(folder.id);
    };

    const handleFolderDoubleClick = (folder: FolderItem) => {
        setCurrentFolderId(folder.id);
        setSelectedFolderId(folder.id);
        setPathStack(prev => [...prev, folder]);
    };

    const handleBack = () => {
        if (pathStack.length > 1) {
            const newStack = pathStack.slice(0, -1);
            setPathStack(newStack);
            const parentFolder = newStack[newStack.length - 1];
            setCurrentFolderId(parentFolder.id);
            setSelectedFolderId(parentFolder.id);
        }
    };

    const handlePathClick = (index: number) => {
        if (index < pathStack.length - 1) {
            const newStack = pathStack.slice(0, index + 1);
            setPathStack(newStack);
            const folder = newStack[newStack.length - 1];
            setCurrentFolderId(folder.id);
            setSelectedFolderId(folder.id);
        }
    };

    if (!isOpen) return null;

    const title = mode === 'move' ? '移动到' : '复制到';
    const actionText = mode === 'move' ? '移动' : '复制';
    const itemCount = items.length;
    const itemDesc = itemCount === 1
        ? `"${items[0].name}"`
        : `${itemCount} 个项目`;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-dark-800 rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
                {/* 头部 */}
                <div className="flex items-center justify-between p-4 border-b border-dark-200 dark:border-dark-700">
                    <h3 className="text-lg font-semibold text-dark-900 dark:text-dark-100">
                        {title}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700"
                    >
                        <X className="w-5 h-5 text-dark-500" />
                    </button>
                </div>

                {/* 描述 */}
                <div className="px-4 py-2 text-sm text-dark-500 border-b border-dark-200 dark:border-dark-700">
                    {actionText} {itemDesc} 到:
                </div>

                {/* 路径导航 */}
                <div className="flex items-center gap-1 px-4 py-2 border-b border-dark-200 dark:border-dark-700 overflow-x-auto">
                    {pathStack.length > 1 && (
                        <button
                            onClick={handleBack}
                            className="p-1 rounded hover:bg-dark-100 dark:hover:bg-dark-700 flex-shrink-0"
                        >
                            <ArrowLeft className="w-4 h-4 text-dark-500" />
                        </button>
                    )}
                    {pathStack.map((folder, index) => (
                        <div key={folder.id} className="flex items-center flex-shrink-0">
                            {index > 0 && (
                                <ChevronRight className="w-4 h-4 text-dark-400 mx-1" />
                            )}
                            <button
                                onClick={() => {
                                    handlePathClick(index);
                                }}
                                className={`px-2 py-1 rounded text-sm transition-colors ${
                                    index === pathStack.length - 1
                                        ? 'font-medium text-dark-900 dark:text-dark-100 hover:bg-dark-100 dark:hover:bg-dark-700'
                                        : 'text-dark-600 hover:text-dark-900 dark:text-dark-400 dark:hover:text-dark-200 hover:bg-dark-100 dark:hover:bg-dark-700'
                                }`}
                            >
                                {folder.name}
                            </button>
                        </div>
                    ))}
                </div>

                {/* 文件夹列表 */}
                <div className="flex-1 overflow-y-auto min-h-[200px] max-h-[300px]">
                    {isFetching ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
                        </div>
                    ) : (
                        <div className="divide-y divide-dark-100 dark:divide-dark-700">
                            {/* 根目录选项 - 总是显示 */}
                            <div
                                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                                    selectedFolderId === 'root'
                                        ? 'bg-primary-50 dark:bg-primary-900/20 border-l-4 border-primary-600'
                                        : 'hover:bg-dark-50 dark:hover:bg-dark-700/50'
                                }`}
                                onClick={() => {
                                    setSelectedFolderId('root');
                                    setSelectedFolderName('我的网盘');
                                    console.log('[MoveCopyModal] Root folder selected, id: root, name: 我的网盘');
                                }}
                            >
                                <Folder className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                                <span className="text-dark-900 dark:text-dark-100 truncate flex-1 font-medium">
                                    我的网盘 (根目录)
                                </span>
                                {selectedFolderId === 'root' && (
                                    <div className="w-2 h-2 bg-primary-600 rounded-full" />
                                )}
                            </div>

                            {/* 当前文件夹的子文件夹列表 */}
                            {folders.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-8 text-dark-500">
                                    <FolderOpen className="w-12 h-12 mb-2 opacity-50" />
                                    <p>此文件夹为空</p>
                                </div>
                            ) : (
                                folders.map(folder => (
                                    <div
                                        key={folder.id}
                                        className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                                            selectedFolderId === folder.id
                                                ? 'bg-primary-50 dark:bg-primary-900/20 border-l-4 border-primary-600'
                                                : 'hover:bg-dark-50 dark:hover:bg-dark-700/50'
                                        }`}
                                        onClick={() => {
                                            handleFolderClick(folder);
                                            setSelectedFolderName(folder.name);
                                            console.log('[MoveCopyModal] Folder selected:', folder.name, 'id:', folder.id);
                                        }}
                                        onDoubleClick={() => {
                                            console.log(
                                                '[MoveCopyModal] Folder double-clicked, entering:',
                                                folder.name,
                                                folder.id
                                            );
                                            handleFolderDoubleClick(folder);
                                        }}
                                    >
                                        <Folder className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                                        <span className="text-dark-900 dark:text-dark-100 truncate flex-1">
                                            {folder.name}
                                        </span>
                                        {selectedFolderId === folder.id && (
                                            <div className="w-2 h-2 bg-primary-600 rounded-full" />
                                        )}
                                        <ChevronRight className="w-4 h-4 text-dark-400 flex-shrink-0" />
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {/* 底部操作 */}
                <div className="flex items-center justify-between p-4 border-t border-dark-200 dark:border-dark-700">
                    <div className="text-sm text-dark-500">
                        目标文件夹: <span className="font-medium text-dark-700 dark:text-dark-300">
                            {selectedFolderName || '未选择'}
                        </span>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="btn btn-secondary">
                            取消
                        </button>
                        <button
                            onClick={() => {
                                console.log(`[MoveCopyModal] Confirming ${mode}: selectedFolderId=${selectedFolderId}, selectedFolderName=${selectedFolderName}`);
                                onConfirm(selectedFolderId);
                            }}
                            className="btn btn-primary"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                    处理中...
                                </>
                            ) : (
                                actionText
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
