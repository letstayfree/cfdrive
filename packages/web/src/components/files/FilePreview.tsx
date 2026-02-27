import { useState, useEffect } from 'react';
import { X, Download, ChevronLeft, ChevronRight, Loader2, ExternalLink, FileText, File } from 'lucide-react';
import { fileService } from '../../services/api';
import type { DriveItem } from '../../stores/files';
import { formatFileSize } from '../../utils/file';
import XMindViewer from './XMindViewer';

interface FilePreviewProps {
    item: DriveItem;
    items?: DriveItem[];
    onClose: () => void;
    onNavigate?: (item: DriveItem) => void;
}

// 确定文件类型（纯函数，放在组件外避免重复创建）
type PreviewType = 'image' | 'video' | 'audio' | 'office' | 'pdf' | 'text' | 'xmind' | 'unsupported';
function getFileType(fileName: string): PreviewType {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';

    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image';
    if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) return 'video';
    if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'].includes(ext)) return 'audio';
    if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) return 'office';
    if (['pdf'].includes(ext)) return 'pdf';
    if (ext === 'xmind') return 'xmind';
    if (['txt', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts', 'py', 'java', 'go', 'rs'].includes(ext)) return 'text';

    return 'unsupported';
}

export default function FilePreview({ item, items = [], onClose, onNavigate }: FilePreviewProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewType, setPreviewType] = useState<PreviewType>(() => getFileType(item.name));
    const [error, setError] = useState<string | null>(null);

    const currentIndex = items.findIndex(i => i.id === item.id);
    const hasPrev = currentIndex > 0;
    const hasNext = currentIndex < items.length - 1;

    // 加载预览
    useEffect(() => {
        const loadPreview = async () => {
            setIsLoading(true);
            setError(null);

            const type = getFileType(item.name);
            setPreviewType(type);

            try {
                if (type === 'image') {
                    // 图片使用缩略图或直接下载链接
                    if (item.thumbnails?.[0]?.large?.url) {
                        setPreviewUrl(item.thumbnails[0].large.url);
                    } else {
                        const response = await fileService.getDownloadUrl(item.id);
                        if (response.success && response.data) {
                            setPreviewUrl(response.data.downloadUrl);
                        }
                    }
                } else if (type === 'video' || type === 'audio') {
                    const response = await fileService.getDownloadUrl(item.id);
                    if (response.success && response.data) {
                        setPreviewUrl(response.data.downloadUrl);
                    }
                } else if (type === 'office' || type === 'pdf') {
                    // Office 和 PDF 使用在线预览
                    const response = await fileService.getPreviewUrl(item.id);
                    if (response.success && response.data) {
                        setPreviewUrl(response.data.previewUrl);
                    }
                } else if (type === 'xmind') {
                    // XMind 由 XMindViewer 组件自行加载，无需在此获取 URL
                }
            } catch (err) {
                setError('加载预览失败');
                console.error('Preview error:', err);
            } finally {
                setIsLoading(false);
            }
        };

        loadPreview();
    }, [item]);

    // 键盘导航
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            } else if (e.key === 'ArrowLeft' && hasPrev && onNavigate) {
                onNavigate(items[currentIndex - 1]);
            } else if (e.key === 'ArrowRight' && hasNext && onNavigate) {
                onNavigate(items[currentIndex + 1]);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentIndex, hasPrev, hasNext, items, onClose, onNavigate]);

    const handleDownload = async () => {
        const response = await fileService.getDownloadUrl(item.id);
        if (response.success && response.data) {
            window.open(response.data.downloadUrl, '_blank');
        }
    };

    // XMind 文件由 XMindViewer 独立渲染（全屏自带工具栏）
    if (previewType === 'xmind') {
        return <XMindViewer item={item} onClose={onClose} />;
    }

    const renderPreview = () => {
        if (isLoading) {
            return (
                <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-12 h-12 text-white animate-spin" />
                </div>
            );
        }

        if (error) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-white">
                    <File className="w-16 h-16 mb-4 opacity-50" />
                    <p>{error}</p>
                </div>
            );
        }

        switch (previewType) {
            case 'image':
                return (
                    <img
                        src={previewUrl || ''}
                        alt={item.name}
                        className="max-w-full max-h-full object-contain"
                        onLoad={() => setIsLoading(false)}
                    />
                );

            case 'video':
                return (
                    <video
                        src={previewUrl || ''}
                        controls
                        autoPlay
                        className="max-w-full max-h-full"
                    >
                        您的浏览器不支持视频播放
                    </video>
                );

            case 'audio':
                return (
                    <div className="flex flex-col items-center justify-center">
                        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-8">
                            <FileText className="w-16 h-16 text-white" />
                        </div>
                        <audio src={previewUrl || ''} controls autoPlay className="w-80">
                            您的浏览器不支持音频播放
                        </audio>
                    </div>
                );

            case 'office':
            case 'pdf':
                return previewUrl ? (
                    <iframe
                        src={previewUrl}
                        className="w-full h-full bg-white rounded-lg"
                        title={item.name}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-white">
                        <FileText className="w-16 h-16 mb-4 opacity-50" />
                        <p>无法预览此文件</p>
                        <button onClick={handleDownload} className="btn btn-primary mt-4">
                            下载查看
                        </button>
                    </div>
                );

            default:
                return (
                    <div className="flex flex-col items-center justify-center h-full text-white">
                        <File className="w-20 h-20 mb-4 opacity-50" />
                        <p className="text-lg mb-2">{item.name}</p>
                        <p className="text-sm opacity-70 mb-6">{formatFileSize(item.size)}</p>
                        <p className="mb-4 opacity-70">此文件类型不支持预览</p>
                        <button onClick={handleDownload} className="btn btn-primary flex items-center gap-2">
                            <Download className="w-4 h-4" />
                            下载文件
                        </button>
                    </div>
                );
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
            {/* 顶部工具栏 */}
            <div className="flex items-center justify-between p-4 text-white">
                <div className="flex items-center gap-4">
                    <h3 className="text-lg font-medium truncate max-w-md">{item.name}</h3>
                    <span className="text-sm opacity-70">{formatFileSize(item.size)}</span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleDownload}
                        className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                        title="下载"
                    >
                        <Download className="w-5 h-5" />
                    </button>
                    {previewType === 'office' && previewUrl && (
                        <a
                            href={previewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                            title="在新窗口打开"
                        >
                            <ExternalLink className="w-5 h-5" />
                        </a>
                    )}
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                        title="关闭"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* 预览区域 */}
            <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
                {renderPreview()}
            </div>

            {/* 导航按钮 */}
            {items.length > 1 && onNavigate && (
                <>
                    {hasPrev && (
                        <button
                            onClick={() => onNavigate(items[currentIndex - 1])}
                            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                        >
                            <ChevronLeft className="w-6 h-6" />
                        </button>
                    )}
                    {hasNext && (
                        <button
                            onClick={() => onNavigate(items[currentIndex + 1])}
                            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                        >
                            <ChevronRight className="w-6 h-6" />
                        </button>
                    )}
                </>
            )}

            {/* 底部信息 */}
            {items.length > 1 && (
                <div className="text-center text-white/70 text-sm pb-4">
                    {currentIndex + 1} / {items.length}
                </div>
            )}
        </div>
    );
}
