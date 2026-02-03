import { useState } from 'react';
import { X, Link2, Copy, Check, Lock, Calendar, Download, Loader2 } from 'lucide-react';
import { shareService } from '../../services/api';
import type { DriveItem } from '../../stores/files';

interface ShareModalProps {
    isOpen: boolean;
    item: DriveItem;
    onClose: () => void;
}

export default function ShareModal({ isOpen, item, onClose }: ShareModalProps) {
    const [isCreating, setIsCreating] = useState(false);
    const [shareLink, setShareLink] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 分享设置
    const [password, setPassword] = useState('');
    const [usePassword, setUsePassword] = useState(false);
    const [expiresIn, setExpiresIn] = useState<string>('never');
    const [maxDownloads, setMaxDownloads] = useState<string>('');

    const handleCreateShare = async () => {
        setIsCreating(true);
        setError(null);

        try {
            // 计算过期时间
            let expiresAt: string | undefined;
            if (expiresIn !== 'never') {
                const days = parseInt(expiresIn);
                const date = new Date();
                date.setDate(date.getDate() + days);
                expiresAt = date.toISOString();
            }

            const response = await shareService.create({
                file_id: item.id,
                password: usePassword && password ? password : undefined,
                expires_at: expiresAt,
                max_downloads: maxDownloads ? parseInt(maxDownloads) : undefined,
            });

            if (response.success && response.data) {
                const data = response.data as { code: string };
                const link = `${window.location.origin}/s/${data.code}`;
                setShareLink(link);
            } else {
                setError(response.error?.message || '创建分享失败');
            }
        } catch {
            setError('创建分享失败');
        } finally {
            setIsCreating(false);
        }
    };

    const handleCopyLink = async () => {
        if (!shareLink) return;

        try {
            await navigator.clipboard.writeText(shareLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // 降级方案
            const input = document.createElement('input');
            input.value = shareLink;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleClose = () => {
        setShareLink(null);
        setPassword('');
        setUsePassword(false);
        setExpiresIn('never');
        setMaxDownloads('');
        setError(null);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-dark-800 rounded-xl shadow-xl w-full max-w-md mx-4">
                {/* 头部 */}
                <div className="flex items-center justify-between p-4 border-b border-dark-200 dark:border-dark-700">
                    <div className="flex items-center gap-2">
                        <Link2 className="w-5 h-5 text-primary-600" />
                        <h3 className="text-lg font-semibold text-dark-900 dark:text-dark-100">
                            分享文件
                        </h3>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-1 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700"
                    >
                        <X className="w-5 h-5 text-dark-500" />
                    </button>
                </div>

                <div className="p-4">
                    {/* 文件信息 */}
                    <div className="flex items-center gap-3 p-3 bg-dark-50 dark:bg-dark-700/50 rounded-lg mb-4">
                        <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                            <Link2 className="w-5 h-5 text-primary-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-dark-900 dark:text-dark-100 truncate">
                                {item.name}
                            </p>
                            <p className="text-sm text-dark-500">
                                {item.folder ? '文件夹' : '文件'}
                            </p>
                        </div>
                    </div>

                    {shareLink ? (
                        /* 分享链接已生成 */
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                                    分享链接
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={shareLink}
                                        readOnly
                                        className="input flex-1"
                                    />
                                    <button
                                        onClick={handleCopyLink}
                                        className={`btn ${copied ? 'btn-primary' : 'btn-secondary'} flex items-center gap-2`}
                                    >
                                        {copied ? (
                                            <>
                                                <Check className="w-4 h-4" />
                                                已复制
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="w-4 h-4" />
                                                复制
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {usePassword && password && (
                                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                                    <p className="text-sm text-amber-700 dark:text-amber-300">
                                        <Lock className="w-4 h-4 inline mr-1" />
                                        访问密码: <strong>{password}</strong>
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* 分享设置 */
                        <div className="space-y-4">
                            {/* 密码保护 */}
                            <div>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={usePassword}
                                        onChange={(e) => setUsePassword(e.target.checked)}
                                        className="w-4 h-4 rounded border-dark-300 text-primary-600 focus:ring-primary-500"
                                    />
                                    <Lock className="w-4 h-4 text-dark-500" />
                                    <span className="text-dark-700 dark:text-dark-300">设置访问密码</span>
                                </label>
                                {usePassword && (
                                    <input
                                        type="text"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="输入密码"
                                        className="input mt-2"
                                    />
                                )}
                            </div>

                            {/* 过期时间 */}
                            <div>
                                <label className="flex items-center gap-2 mb-2">
                                    <Calendar className="w-4 h-4 text-dark-500" />
                                    <span className="text-dark-700 dark:text-dark-300">有效期</span>
                                </label>
                                <select
                                    value={expiresIn}
                                    onChange={(e) => setExpiresIn(e.target.value)}
                                    className="input"
                                >
                                    <option value="never">永久有效</option>
                                    <option value="1">1 天</option>
                                    <option value="7">7 天</option>
                                    <option value="30">30 天</option>
                                    <option value="90">90 天</option>
                                </select>
                            </div>

                            {/* 下载次数限制 */}
                            <div>
                                <label className="flex items-center gap-2 mb-2">
                                    <Download className="w-4 h-4 text-dark-500" />
                                    <span className="text-dark-700 dark:text-dark-300">下载次数限制</span>
                                </label>
                                <input
                                    type="number"
                                    value={maxDownloads}
                                    onChange={(e) => setMaxDownloads(e.target.value)}
                                    placeholder="不限制"
                                    min="1"
                                    className="input"
                                />
                            </div>

                            {error && (
                                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                            )}
                        </div>
                    )}
                </div>

                {/* 底部按钮 */}
                <div className="flex justify-end gap-2 p-4 border-t border-dark-200 dark:border-dark-700">
                    <button onClick={handleClose} className="btn btn-secondary">
                        {shareLink ? '关闭' : '取消'}
                    </button>
                    {!shareLink && (
                        <button
                            onClick={handleCreateShare}
                            className="btn btn-primary flex items-center gap-2"
                            disabled={isCreating}
                        >
                            {isCreating ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    创建中...
                                </>
                            ) : (
                                <>
                                    <Link2 className="w-4 h-4" />
                                    创建分享
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
