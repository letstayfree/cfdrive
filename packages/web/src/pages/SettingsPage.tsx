import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useThemeStore } from '../stores/theme';
import { useAuthStore } from '../stores/auth';
import { oauthService } from '../services/api';
import {
    Moon,
    Sun,
    Monitor,
    Link2,
    Unlink,
    User,
    Shield,
    HardDrive,
    Loader2,
    CheckCircle,
    AlertCircle,
} from 'lucide-react';

export default function SettingsPage() {
    const { isDark, setTheme } = useThemeStore();
    const { user } = useAuthStore();
    const [isDisconnecting, setIsDisconnecting] = useState(false);

    // 检查 OneDrive 连接状态
    const { data: oauthStatus, refetch: refetchOauth } = useQuery({
        queryKey: ['oauth-status'],
        queryFn: async () => {
            const response = await oauthService.checkStatus();
            return response.data;
        },
    });

    const handleConnectOneDrive = () => {
        window.location.href = oauthService.getAuthorizeUrl();
    };

    const handleDisconnectOneDrive = async () => {
        setIsDisconnecting(true);
        try {
            await oauthService.disconnect();
            refetchOauth();
        } catch (error) {
            console.error('Disconnect error:', error);
        } finally {
            setIsDisconnecting(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto p-6">
            <h1 className="text-2xl font-bold text-dark-900 dark:text-dark-100 mb-6">设置</h1>

            {/* 账户信息 */}
            <section className="bg-white dark:bg-dark-800 rounded-xl shadow-sm p-6 mb-6">
                <h2 className="text-lg font-semibold text-dark-900 dark:text-dark-100 mb-4 flex items-center gap-2">
                    <User className="w-5 h-5" />
                    账户信息
                </h2>
                <div className="space-y-4">
                    <div className="flex items-center justify-between py-3 border-b border-dark-100 dark:border-dark-700">
                        <span className="text-dark-600 dark:text-dark-400">用户名</span>
                        <span className="text-dark-900 dark:text-dark-100 font-medium">
                            {user?.username}
                        </span>
                    </div>
                    <div className="flex items-center justify-between py-3 border-b border-dark-100 dark:border-dark-700">
                        <span className="text-dark-600 dark:text-dark-400">邮箱</span>
                        <span className="text-dark-900 dark:text-dark-100 font-medium">
                            {user?.email}
                        </span>
                    </div>
                    <div className="flex items-center justify-between py-3">
                        <span className="text-dark-600 dark:text-dark-400">角色</span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                            <Shield className="w-3.5 h-3.5" />
                            {user?.role === 'superadmin' ? '超级管理员' :
                                user?.role === 'collaborator' ? '协作者' :
                                    user?.role === 'customer' ? '客户' : '访客'}
                        </span>
                    </div>
                </div>
            </section>

            {/* OneDrive 连接 */}
            <section className="bg-white dark:bg-dark-800 rounded-xl shadow-sm p-6 mb-6">
                <h2 className="text-lg font-semibold text-dark-900 dark:text-dark-100 mb-4 flex items-center gap-2">
                    <HardDrive className="w-5 h-5" />
                    OneDrive 连接
                </h2>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {oauthStatus?.connected ? (
                            <>
                                <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                                </div>
                                <div>
                                    <p className="font-medium text-dark-900 dark:text-dark-100">已连接</p>
                                    <p className="text-sm text-dark-500">您的 OneDrive 账户已成功连接</p>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                    <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                                </div>
                                <div>
                                    <p className="font-medium text-dark-900 dark:text-dark-100">未连接</p>
                                    <p className="text-sm text-dark-500">请连接您的 Microsoft 账户</p>
                                </div>
                            </>
                        )}
                    </div>
                    {oauthStatus?.connected ? (
                        <button
                            onClick={handleDisconnectOneDrive}
                            className="btn btn-secondary flex items-center gap-2"
                            disabled={isDisconnecting}
                        >
                            {isDisconnecting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Unlink className="w-4 h-4" />
                            )}
                            断开连接
                        </button>
                    ) : (
                        <button
                            onClick={handleConnectOneDrive}
                            className="btn btn-primary flex items-center gap-2"
                        >
                            <Link2 className="w-4 h-4" />
                            连接 OneDrive
                        </button>
                    )}
                </div>
            </section>

            {/* 外观设置 */}
            <section className="bg-white dark:bg-dark-800 rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-dark-900 dark:text-dark-100 mb-4 flex items-center gap-2">
                    <Monitor className="w-5 h-5" />
                    外观设置
                </h2>
                <div className="grid grid-cols-3 gap-3">
                    <button
                        onClick={() => setTheme('light')}
                        className={`p-4 rounded-xl border-2 transition-all ${!isDark
                                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                : 'border-dark-200 dark:border-dark-700 hover:border-dark-300'
                            }`}
                    >
                        <Sun className="w-6 h-6 mx-auto mb-2 text-yellow-500" />
                        <span className="text-sm font-medium text-dark-900 dark:text-dark-100">
                            浅色
                        </span>
                    </button>
                    <button
                        onClick={() => setTheme('dark')}
                        className={`p-4 rounded-xl border-2 transition-all ${isDark
                                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                : 'border-dark-200 dark:border-dark-700 hover:border-dark-300'
                            }`}
                    >
                        <Moon className="w-6 h-6 mx-auto mb-2 text-blue-500" />
                        <span className="text-sm font-medium text-dark-900 dark:text-dark-100">
                            深色
                        </span>
                    </button>
                    <button
                        onClick={() => {
                            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                            setTheme(prefersDark ? 'dark' : 'light');
                        }}
                        className="p-4 rounded-xl border-2 border-dark-200 dark:border-dark-700 hover:border-dark-300 transition-all"
                    >
                        <Monitor className="w-6 h-6 mx-auto mb-2 text-dark-500" />
                        <span className="text-sm font-medium text-dark-900 dark:text-dark-100">
                            跟随系统
                        </span>
                    </button>
                </div>
            </section>
        </div>
    );
}
