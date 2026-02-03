import { useState, useRef, useCallback } from 'react';
import { Upload, X, File, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { formatFileSize } from '../../utils/file';
import { fileService } from '../../services/api';

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

// 分片大小: 320KB 的倍数 (Microsoft 推荐)
const CHUNK_SIZE = 320 * 1024 * 10; // 3.2MB
const MAX_SIMPLE_UPLOAD_SIZE = 4 * 1024 * 1024; // 4MB

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

    const updateFileProgress = (id: string, progress: number) => {
        setFiles((prev) =>
            prev.map((f) =>
                f.id === id ? { ...f, progress } : f
            )
        );
    };

    const uploadSingleFile = async (uploadFile: UploadFile) => {
        try {
            setFiles((prev) =>
                prev.map((f) =>
                    f.id === uploadFile.id ? { ...f, status: 'uploading' as const } : f
                )
            );

            const fileSize = uploadFile.file.size;

            if (fileSize <= MAX_SIMPLE_UPLOAD_SIZE) {
                // 小文件：直接上传
                await uploadSimple(uploadFile);
            } else {
                // 大文件：分片上传
                await uploadChunked(uploadFile);
            }

            setFiles((prev) =>
                prev.map((f) =>
                    f.id === uploadFile.id
                        ? { ...f, status: 'success' as const, progress: 100 }
                        : f
                )
            );
            onUploadComplete();
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

    // 小文件简单上传
    const uploadSimple = async (uploadFile: UploadFile) => {
        const response = await fileService.upload(parentId, uploadFile.file);
        if (!response.success) {
            throw new Error(response.error?.message || '上传失败');
        }
    };

    // 大文件分片上传
    const uploadChunked = async (uploadFile: UploadFile) => {
        const { file, id } = uploadFile;
        const fileSize = file.size;

        // 1. 创建上传会话
        const sessionResponse = await fileService.createUploadSession(parentId, file.name, fileSize);
        if (!sessionResponse.success || !sessionResponse.data) {
            throw new Error(sessionResponse.error?.message || '创建上传会话失败');
        }

        const { uploadUrl } = sessionResponse.data;

        // 2. 分片上传
        let uploadedBytes = 0;
        const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);

        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
            const start = chunkIndex * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, fileSize);
            const chunk = file.slice(start, end);

            const contentRange = `bytes ${start}-${end - 1}/${fileSize}`;

            // uploadUrl 是 OneDrive 提供的完整 URL，已包含身份验证信息
            const response = await fetch(uploadUrl, {
                method: 'PUT',
                headers: {
                    'Content-Length': chunk.size.toString(),
                    'Content-Range': contentRange,
                },
                body: chunk,
            });

            if (!response.ok && response.status !== 202 && response.status !== 201 && response.status !== 200) {
                const errorText = await response.text();
                throw new Error(`上传分片失败: ${response.status} - ${errorText}`);
            }

            uploadedBytes = end;
            const progress = Math.round((uploadedBytes / fileSize) * 100);
            updateFileProgress(id, progress);
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
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-dark-500">
                                            {formatFileSize(uploadFile.file.size)}
                                        </span>
                                        {uploadFile.status === 'uploading' && uploadFile.progress > 0 && (
                                            <span className="text-xs text-primary-600">
                                                {uploadFile.progress}%
                                            </span>
                                        )}
                                        {uploadFile.error && (
                                            <span className="text-xs text-red-500">{uploadFile.error}</span>
                                        )}
                                    </div>
                                    {/* 进度条 */}
                                    {uploadFile.status === 'uploading' && (
                                        <div className="mt-1 h-1 bg-dark-200 dark:bg-dark-600 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-primary-500 transition-all duration-300"
                                                style={{ width: `${uploadFile.progress}%` }}
                                            />
                                        </div>
                                    )}
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
