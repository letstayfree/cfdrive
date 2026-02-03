import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useFilesStore, type DriveItem } from '../stores/files';
import { fileService, oauthService } from '../services/api';
import FileList from '../components/files/FileList';
import FileGrid from '../components/files/FileGrid';
import FileUpload from '../components/files/FileUpload';
import ContextMenu from '../components/files/ContextMenu';
import RenameModal from '../components/files/RenameModal';
import DeleteModal from '../components/files/DeleteModal';
import NewFolderModal from '../components/files/NewFolderModal';
import FilePreview from '../components/files/FilePreview';
import MoveCopyModal from '../components/files/MoveCopyModal';
import ShareModal from '../components/files/ShareModal';
import FileInfoModal from '../components/files/FileInfoModal';
import Breadcrumb from '../components/layout/Breadcrumb';
import { Loader2, Grid, List, RefreshCw, FolderPlus, AlertTriangle, Link2 } from 'lucide-react';

interface DrivePageProps {
    type?: 'favorites' | 'trash' | 'shares';
}

export default function DrivePage({ type }: DrivePageProps) {
    const { folderId = 'root' } = useParams();
    const navigate = useNavigate();
    const {
        currentFolderId,
        viewMode,
        sortField,
        sortOrder,
        items,
        setCurrentFolder,
        setItems,
        setLoading,
        setViewMode,
        clearSelection,
    } = useFilesStore();

    // 右键菜单状态
    const [contextMenu, setContextMenu] = useState<{
        x: number;
        y: number;
        item: DriveItem | null;
    } | null>(null);

    // 弹窗状态
    const [renameModal, setRenameModal] = useState<{ isOpen: boolean; item: DriveItem | null }>({
        isOpen: false,
        item: null,
    });
    const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; items: DriveItem[] }>({
        isOpen: false,
        items: [],
    });
    const [newFolderModal, setNewFolderModal] = useState(false);
    const [previewItem, setPreviewItem] = useState<DriveItem | null>(null);
    const [moveCopyModal, setMoveCopyModal] = useState<{
        isOpen: boolean;
        mode: 'move' | 'copy';
        items: DriveItem[];
    }>({ isOpen: false, mode: 'move', items: [] });
    const [shareModal, setShareModal] = useState<{ isOpen: boolean; item: DriveItem | null }>({
        isOpen: false,
        item: null,
    });
    const [infoModal, setInfoModal] = useState<{ isOpen: boolean; item: DriveItem | null }>({
        isOpen: false,
        item: null,
    });

    // 操作状态
    const [isOperating, setIsOperating] = useState(false);

    // OneDrive 连接状态
    const { data: oauthStatus } = useQuery({
        queryKey: ['oauth-status'],
        queryFn: async () => {
            const response = await oauthService.checkStatus();
            return response.data;
        },
    });

    // 获取文件列表
    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ['files', folderId, sortField, sortOrder],
        queryFn: async () => {
            const orderby = `${sortField} ${sortOrder}`;
            const response = await fileService.list(folderId, { orderby });
            return response;
        },
        enabled: !type && oauthStatus?.connected === true,
    });

    // 更新当前文件夹
    useEffect(() => {
        if (folderId !== currentFolderId) {
            setCurrentFolder(folderId, [
                { id: 'root', name: '我的网盘' },
                ...(folderId !== 'root' ? [{ id: folderId, name: '当前文件夹' }] : []),
            ]);
        }
    }, [folderId, currentFolderId, setCurrentFolder]);

    // 更新文件列表
    useEffect(() => {
        if (data?.success && data.data) {
            const items = (data.data as { items: DriveItem[] }).items || [];
            setItems(items);
        }
    }, [data, setItems]);

    // 更新加载状态
    useEffect(() => {
        setLoading(isLoading);
    }, [isLoading, setLoading]);

    // 右键菜单处理
    const handleContextMenu = useCallback((e: React.MouseEvent, item: DriveItem) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, item });
    }, []);

    const handleBackgroundContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, item: null });
    }, []);

    // 文件操作
    const handleOpen = useCallback((item: DriveItem) => {
        if (item.folder) {
            navigate(`/drive/${item.id}`);
        } else {
            setPreviewItem(item);
        }
    }, [navigate]);

    const handleDownload = useCallback(async (item: DriveItem) => {
        try {
            const response = await fileService.getDownloadUrl(item.id);
            if (response.success && response.data) {
                window.open(response.data.downloadUrl, '_blank');
            }
        } catch (error) {
            console.error('Download error:', error);
        }
    }, []);

    const handleRename = useCallback(async (newName: string) => {
        if (!renameModal.item) return;

        setIsOperating(true);
        try {
            const response = await fileService.rename(renameModal.item.id, newName);
            if (response.success) {
                refetch();
                setRenameModal({ isOpen: false, item: null });
            }
        } catch (error) {
            console.error('Rename error:', error);
        } finally {
            setIsOperating(false);
        }
    }, [renameModal.item, refetch]);

    const handleDelete = useCallback(async () => {
        if (deleteModal.items.length === 0) return;

        setIsOperating(true);
        try {
            for (const item of deleteModal.items) {
                await fileService.delete(item.id);
            }
            refetch();
            setDeleteModal({ isOpen: false, items: [] });
            clearSelection();
        } catch (error) {
            console.error('Delete error:', error);
        } finally {
            setIsOperating(false);
        }
    }, [deleteModal.items, refetch, clearSelection]);

    const handleNewFolder = useCallback(async (name: string) => {
        setIsOperating(true);
        try {
            const response = await fileService.createFolder(folderId, name);
            if (response.success) {
                refetch();
                setNewFolderModal(false);
            }
        } catch (error) {
            console.error('Create folder error:', error);
        } finally {
            setIsOperating(false);
        }
    }, [folderId, refetch]);

    const handleMoveCopy = useCallback(async (targetFolderId: string) => {
        if (moveCopyModal.items.length === 0) return;

        setIsOperating(true);
        try {
            for (const item of moveCopyModal.items) {
                if (moveCopyModal.mode === 'move') {
                    await fileService.move(item.id, targetFolderId);
                } else {
                    await fileService.copy(item.id, targetFolderId);
                }
            }
            refetch();
            setMoveCopyModal({ isOpen: false, mode: 'move', items: [] });
            clearSelection();
        } catch (error) {
            console.error('Move/Copy error:', error);
        } finally {
            setIsOperating(false);
        }
    }, [moveCopyModal, refetch, clearSelection]);

    const handleConnectOneDrive = () => {
        window.location.href = oauthService.getAuthorizeUrl();
    };

    // 获取可预览的文件列表（用于导航）
    const previewableItems = items.filter(item => !item.folder);

    // 特殊类型页面
    if (type === 'favorites') {
        return (
            <div className="text-center py-20">
                <p className="text-dark-500 dark:text-dark-400">收藏功能即将推出</p>
            </div>
        );
    }

    if (type === 'trash') {
        return (
            <div className="text-center py-20">
                <p className="text-dark-500 dark:text-dark-400">回收站功能即将推出</p>
            </div>
        );
    }

    if (type === 'shares') {
        return (
            <div className="text-center py-20">
                <p className="text-dark-500 dark:text-dark-400">分享管理功能即将推出</p>
            </div>
        );
    }

    // 未连接 OneDrive
    if (oauthStatus && !oauthStatus.connected) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <div className="w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-6">
                    <AlertTriangle className="w-10 h-10 text-amber-600 dark:text-amber-400" />
                </div>
                <h2 className="text-xl font-semibold text-dark-900 dark:text-dark-100 mb-2">
                    需要连接 OneDrive
                </h2>
                <p className="text-dark-500 dark:text-dark-400 mb-6 text-center max-w-md">
                    请先连接您的 Microsoft 账户以访问 OneDrive 存储
                </p>
                <button onClick={handleConnectOneDrive} className="btn btn-primary flex items-center gap-2">
                    <Link2 className="w-4 h-4" />
                    连接 OneDrive
                </button>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-20">
                <p className="text-red-500">加载失败</p>
                <button onClick={() => refetch()} className="mt-4 btn btn-primary">
                    重试
                </button>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col" onContextMenu={handleBackgroundContextMenu}>
            {/* 工具栏 */}
            <div className="flex items-center justify-between p-4 border-b border-dark-200 dark:border-dark-700">
                <Breadcrumb />

                <div className="flex items-center gap-2">
                    {/* 上传按钮 */}
                    <FileUpload parentId={folderId} onUploadComplete={() => refetch()} />

                    {/* 新建文件夹 */}
                    <button
                        onClick={() => setNewFolderModal(true)}
                        className="btn btn-secondary flex items-center gap-2"
                    >
                        <FolderPlus className="w-4 h-4" />
                        新建文件夹
                    </button>

                    {/* 刷新 */}
                    <button
                        onClick={() => refetch()}
                        className="p-2 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
                        title="刷新"
                    >
                        <RefreshCw className="w-5 h-5 text-dark-500" />
                    </button>

                    {/* 视图切换 */}
                    <div className="flex items-center border border-dark-200 dark:border-dark-700 rounded-lg overflow-hidden">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 transition-colors ${viewMode === 'list'
                                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600'
                                    : 'hover:bg-dark-100 dark:hover:bg-dark-700 text-dark-500'
                                }`}
                            title="列表视图"
                        >
                            <List className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2 transition-colors ${viewMode === 'grid'
                                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600'
                                    : 'hover:bg-dark-100 dark:hover:bg-dark-700 text-dark-500'
                                }`}
                            title="网格视图"
                        >
                            <Grid className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* 文件列表 */}
            <div className="flex-1 overflow-auto">
                {items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-dark-500 dark:text-dark-400">
                        <p className="text-lg mb-2">此文件夹为空</p>
                        <p className="text-sm">拖拽文件到此处上传，或点击上传按钮</p>
                    </div>
                ) : viewMode === 'grid' ? (
                    <FileGrid onContextMenu={handleContextMenu} onOpen={handleOpen} />
                ) : (
                    <FileList onContextMenu={handleContextMenu} onOpen={handleOpen} />
                )}
            </div>

            {/* 右键菜单 */}
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    item={contextMenu.item}
                    isFolder={!!contextMenu.item?.folder}
                    onClose={() => setContextMenu(null)}
                    onOpen={() => contextMenu.item && handleOpen(contextMenu.item)}
                    onDownload={() => contextMenu.item && handleDownload(contextMenu.item)}
                    onRename={() => {
                        if (contextMenu.item) {
                            setRenameModal({ isOpen: true, item: contextMenu.item });
                        }
                    }}
                    onCopy={() => {
                        if (contextMenu.item) {
                            setMoveCopyModal({ isOpen: true, mode: 'copy', items: [contextMenu.item] });
                        }
                    }}
                    onMove={() => {
                        if (contextMenu.item) {
                            setMoveCopyModal({ isOpen: true, mode: 'move', items: [contextMenu.item] });
                        }
                    }}
                    onDelete={() => {
                        if (contextMenu.item) {
                            setDeleteModal({ isOpen: true, items: [contextMenu.item] });
                        }
                    }}
                    onShare={() => {
                        if (contextMenu.item) {
                            setShareModal({ isOpen: true, item: contextMenu.item });
                        }
                    }}
                    onToggleFavorite={() => console.log('Toggle favorite')}
                    onShowInfo={() => {
                        if (contextMenu.item) {
                            setInfoModal({ isOpen: true, item: contextMenu.item });
                        }
                    }}
                    onNewFolder={!contextMenu.item ? () => setNewFolderModal(true) : undefined}
                />
            )}

            {/* 文件预览 */}
            {previewItem && (
                <FilePreview
                    item={previewItem}
                    items={previewableItems}
                    onClose={() => setPreviewItem(null)}
                    onNavigate={(item) => setPreviewItem(item)}
                />
            )}

            {/* 重命名弹窗 */}
            <RenameModal
                isOpen={renameModal.isOpen}
                itemName={renameModal.item?.name || ''}
                itemType={renameModal.item?.folder ? 'folder' : 'file'}
                onClose={() => setRenameModal({ isOpen: false, item: null })}
                onConfirm={handleRename}
                isLoading={isOperating}
            />

            {/* 删除确认弹窗 */}
            <DeleteModal
                isOpen={deleteModal.isOpen}
                items={deleteModal.items}
                onClose={() => setDeleteModal({ isOpen: false, items: [] })}
                onConfirm={handleDelete}
                isLoading={isOperating}
            />

            {/* 新建文件夹弹窗 */}
            <NewFolderModal
                isOpen={newFolderModal}
                onClose={() => setNewFolderModal(false)}
                onConfirm={handleNewFolder}
                isLoading={isOperating}
            />

            {/* 移动/复制弹窗 */}
            <MoveCopyModal
                isOpen={moveCopyModal.isOpen}
                mode={moveCopyModal.mode}
                items={moveCopyModal.items}
                onClose={() => setMoveCopyModal({ isOpen: false, mode: 'move', items: [] })}
                onConfirm={handleMoveCopy}
                isLoading={isOperating}
            />

            {/* 分享弹窗 */}
            {shareModal.item && (
                <ShareModal
                    isOpen={shareModal.isOpen}
                    item={shareModal.item}
                    onClose={() => setShareModal({ isOpen: false, item: null })}
                />
            )}

            {/* 属性弹窗 */}
            {infoModal.item && (
                <FileInfoModal
                    isOpen={infoModal.isOpen}
                    item={infoModal.item}
                    onClose={() => setInfoModal({ isOpen: false, item: null })}
                />
            )}
        </div>
    );
}
