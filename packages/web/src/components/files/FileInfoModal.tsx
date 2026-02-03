import { X, File, Folder, Calendar, HardDrive, Link } from 'lucide-react';
import type { DriveItem } from '../../stores/files';
import { formatFileSize } from '../../utils/file';

interface FileInfoModalProps {
    isOpen: boolean;
    item: DriveItem;
    onClose: () => void;
}

export default function FileInfoModal({ isOpen, item, onClose }: FileInfoModalProps) {
    if (!isOpen) return null;

    const isFolder = !!item.folder;
    const ext = item.name.split('.').pop()?.toLowerCase() || '';

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const infoItems = [
        {
            icon: isFolder ? Folder : File,
            label: '类型',
            value: isFolder ? '文件夹' : (ext.toUpperCase() + ' 文件'),
        },
        {
            icon: HardDrive,
            label: '大小',
            value: isFolder ? `${item.folder?.childCount || 0} 个项目` : formatFileSize(item.size),
        },
        {
            icon: Calendar,
            label: '创建时间',
            value: formatDate(item.createdDateTime),
        },
        {
            icon: Calendar,
            label: '修改时间',
            value: formatDate(item.lastModifiedDateTime),
        },
        {
            icon: Link,
            label: '位置',
            value: item.parentReference?.path?.replace('/drive/root:', '我的网盘') || '我的网盘',
        },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-dark-800 rounded-xl shadow-xl w-full max-w-md mx-4">
                {/* 头部 */}
                <div className="flex items-center justify-between p-4 border-b border-dark-200 dark:border-dark-700">
                    <h3 className="text-lg font-semibold text-dark-900 dark:text-dark-100">
                        属性
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700"
                    >
                        <X className="w-5 h-5 text-dark-500" />
                    </button>
                </div>

                <div className="p-4">
                    {/* 文件图标和名称 */}
                    <div className="flex flex-col items-center py-4 mb-4">
                        <div className={`w-16 h-16 rounded-xl flex items-center justify-center mb-3 ${isFolder
                            ? 'bg-yellow-100 dark:bg-yellow-900/30'
                            : 'bg-blue-100 dark:bg-blue-900/30'
                            }`}>
                            {isFolder ? (
                                <Folder className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
                            ) : (
                                <File className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                            )}
                        </div>
                        <h4 className="text-lg font-medium text-dark-900 dark:text-dark-100 text-center break-all px-4">
                            {item.name}
                        </h4>
                    </div>

                    {/* 属性列表 */}
                    <div className="space-y-3">
                        {infoItems.map((info, index) => (
                            <div
                                key={index}
                                className="flex items-start gap-3 py-2 border-b border-dark-100 dark:border-dark-700 last:border-0"
                            >
                                <info.icon className="w-5 h-5 text-dark-400 mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-dark-500">{info.label}</p>
                                    <p className="text-dark-900 dark:text-dark-100 break-all">
                                        {info.value}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Web URL */}
                    {item.webUrl && (
                        <div className="mt-4 p-3 bg-dark-50 dark:bg-dark-700/50 rounded-lg">
                            <p className="text-xs text-dark-500 mb-1">OneDrive 链接</p>
                            <a
                                href={item.webUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-primary-600 hover:underline break-all"
                            >
                                {item.webUrl}
                            </a>
                        </div>
                    )}
                </div>

                {/* 底部按钮 */}
                <div className="flex justify-end p-4 border-t border-dark-200 dark:border-dark-700">
                    <button onClick={onClose} className="btn btn-primary">
                        确定
                    </button>
                </div>
            </div>
        </div>
    );
}
