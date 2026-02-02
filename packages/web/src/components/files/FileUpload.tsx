import { useState, useRef, useCallback } from 'react';
import { Upload, X, File, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { formatFileSize } from '../../utils/file';
import api from '../../services/api';

interface UploadFile {
    id: string;
    file: File;
    progress: number;
    status: 'pending' | 'uploading' | 'success' | 'error';
    error?: string;
}

interface FileUploadProps {
    parentId: string;
    onUploadComplete: () => void;
}

export default function FileUpload({ parentId, onUploadComplete }: FileUploadProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [files, setFiles] = useState<UploadFile[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const droppedFiles = Array.from(e.dataTransfer.files);
        addFiles(droppedFiles);
    }, []);

    const addFiles = (newFiles: File[]) => {
        const uploadFiles: UploadFile[] = newFiles.map((file) => ({
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            file,
            progress: 0,
            status: 'pending' as const,
        }));

        setFiles((prev) => [...prev, ...uploadFiles]);
        setIsOpen(true);

        // 开始上传
        uploadFiles.forEach((uploadFile) => {
            uploadSingleFile(uploadFile);
        });
    };

    const uploadSingleFile = async (uploadFile: UploadFile) => {
        try {
            setFiles((prev) =>
                prev.map((f) =>
                    f.id === uploadFile.id ? { ...f, status: 'uploading' as const } : f
                )
            );

            const formData = new FormData();
            formData.append('file', uploadFile.file);
            formData.append('parentId', parentId);

            // 使用 fetch 直接上传以获取进度
            const response = await api.uploadFile(parentId, uploadFile.file);

            if (response.success) {
                setFiles((prev) =>
                    prev.map((f) =>
                        f.id === uploadFile.id
                            ? { ...f, status: 'success' as const, progress: 100 }
                            : f
                    )
                );
                onUploadComplete();
            } else {
                throw new Error(response.error?.message || '上传失败');
            }
        } catch (error) {
            setFiles((prev) =>
                prev.map((f) =>
                    f.id === uploadFile.id
                        ? {
                            ...f,
                            status: 'error' as const,
                            error: error instanceof Error ? error.message : '上传失败',
                        }
                        : f
                )
            );
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            addFiles(Array.from(e.target.files));
        }
        // 重置 input 以允许重复选择相同文件
        e.target.value = '';
    };

    const removeFile = (id: string) => {
        setFiles((prev) => prev.filter((f) => f.id !== id));
    };

    const clearCompleted = () => {
        setFiles((prev) => prev.filter((f) => f.status !== 'success'));
    };

    const closePanel = () => {
        setIsOpen(false);
        // 延迟清除已完成的文件
        setTimeout(() => {
            setFiles((prev) => prev.filter((f) => f.status === 'uploading' || f.status === 'pending'));
        }, 300);
    };

    const pendingCount = files.filter((f) => f.status === 'pending' || f.status === 'uploading').length;
    const successCount = files.filter((f) => f.status === 'success').length;
    const errorCount = files.filter((f) => f.status === 'error').length;

    return (
        <>
            {/* 拖拽区域覆盖层 */}
            {isDragging && (
                <div
                    className="fixed inset-0 z-40 bg-primary-500/10 border-4 border-dashed border-primary-500 flex items-center justify-center"
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    <div className="text-center">
                        <Upload className="w-16 h-16 text-primary-500 mx-auto mb-4" />
                        <p className="text-xl font-medium text-primary-700 dark:text-primary-300">
                            释放以上传文件
                        </p>
                    </div>
                </div>
            )}

            {/* 主容器 - 用于捕获拖拽事件 */}
            <div
                className="absolute inset-0 pointer-events-none"
                onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                }}
            />

            {/* 上传按钮 */}
            <button
                onClick={() => fileInputRef.current?.click()}
                className="btn btn-primary flex items-center gap-2"
            >
                <Upload className="w-4 h-4" />
                上传
            </button>

            <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileSelect}
            />

            {/* 上传进度面板 */}
            {isOpen && files.length > 0 && (
                <div className="fixed bottom-4 right-4 z-50 w-96 bg-white dark:bg-dark-800 rounded-xl shadow-2xl border border-dark-200 dark:border-dark-700 overflow-hidden animate-slideUp">
                    {/* 头部 */}
                    <div className="flex items-center justify-between p-4 border-b border-dark-200 dark:border-dark-700 bg-dark-50 dark:bg-dark-900">
                        <div>
                            <h3 className="font-medium text-dark-900 dark:text-dark-100">
                                上传文件
                            </h3>
                            <p className="text-sm text-dark-500">
                                {pendingCount > 0 && `${pendingCount} 个正在上传`}
                                {pendingCount > 0 && successCount > 0 && '，'}
                                {successCount > 0 && `${successCount} 个已完成`}
                                {errorCount > 0 && `，${errorCount} 个失败`}
                            </p>
                        </div>
                        <button
                            onClick={closePanel}
                            className="p-1 rounded-lg hover:bg-dark-200 dark:hover:bg-dark-700 transition-colors"
                        >
                            <X className="w-5 h-5 text-dark-500" />
                        </button>
                    </div>

                    {/* 文件列表 */}
                    <div className="max-h-64 overflow-y-auto">
                        {files.map((uploadFile) => (
                            <div
                                key={uploadFile.id}
                                className="flex items-center gap-3 p-3 border-b border-dark-100 dark:border-dark-700 last:border-b-0"
                            >
                                {/* 图标/状态 */}
                                <div className="flex-shrink-0">
                                    {uploadFile.status === 'uploading' && (
                                        <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
                                    )}
                                    {uploadFile.status === 'pending' && (
                                        <File className="w-5 h-5 text-dark-400" />
                                    )}
                                    {uploadFile.status === 'success' && (
                                        <CheckCircle className="w-5 h-5 text-green-500" />
                                    )}
                                    {uploadFile.status === 'error' && (
                                        <AlertCircle className="w-5 h-5 text-red-500" />
                                    )}
                                </div>

                                {/* 文件信息 */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-dark-900 dark:text-dark-100 truncate">
                                        {uploadFile.file.name}
                                    </p>
                                    <p className="text-xs text-dark-500">
                                        {formatFileSize(uploadFile.file.size)}
                                        {uploadFile.error && (
                                            <span className="text-red-500 ml-2">{uploadFile.error}</span>
                                        )}
                                    </p>
                                </div>

                                {/* 移除按钮 */}
                                {(uploadFile.status === 'success' || uploadFile.status === 'error') && (
                                    <button
                                        onClick={() => removeFile(uploadFile.id)}
                                        className="p-1 rounded hover:bg-dark-100 dark:hover:bg-dark-700"
                                    >
                                        <X className="w-4 h-4 text-dark-400" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* 底部操作 */}
                    {successCount > 0 && (
                        <div className="p-2 border-t border-dark-200 dark:border-dark-700 bg-dark-50 dark:bg-dark-900">
                            <button
                                onClick={clearCompleted}
                                className="text-sm text-primary-600 hover:text-primary-700"
                            >
                                清除已完成
                            </button>
                        </div>
                    )}
                </div>
            )}
        </>
    );
}
