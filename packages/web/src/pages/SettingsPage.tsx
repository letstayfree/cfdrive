import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useThemeStore } from '../stores/theme';
import { useAuthStore } from '../stores/auth';
import { oauthService, configService } from '../services/api';
import toast from 'react-hot-toast';
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
    Cloud,
    Save,
    Eye,
    EyeOff,
} from 'lucide-react';

export default function SettingsPage() {
    const { isDark, setTheme } = useThemeStore();
    const { user } = useAuthStore();
    const [isDisconnecting, setIsDisconnecting] = useState(false);
    const queryClient = useQueryClient();

    // Azure AD 配置状态
    const [azureForm, setAzureForm] = useState({ clientId: '', clientSecret: '', tenantId: '' });
    const [isSavingAzure, setIsSavingAzure] = useState(false);
    const [showSecret, setShowSecret] = useState(false);

    // 获取 Azure AD 配置
    const { data: azureConfig } = useQuery({
        queryKey: ['azure-config'],
        queryFn: async () => {
            const response = await configService.getAzureConfig();
            return response.data;
        },
        enabled: user?.role === 'superadmin',
    });

    // 加载 Azure 配置到表单
    useEffect(() => {
        if (azureConfig) {
            setAzureForm({
                clientId: azureConfig.clientId || '',
                clientSecret: '',
                tenantId: azureConfig.tenantId || '',
            });
        }
    }, [azureConfig]);

    const handleSaveAzure = async () => {
        if (!azureForm.clientId || !azureForm.tenantId) {
            toast.error('请填写 Client ID 和 Tenant ID');
            return;
        }
        // 如果 secret 为空且已配置过，使用占位表示不修改
        const secretToSave = azureForm.clientSecret || (azureConfig?.clientSecret ? '__UNCHANGED__' : '');
        if (!secretToSave) {
            toast.error('请填写 Client Secret');
            return;
        }

        setIsSavingAzure(true);
        try {
            const response = await configService.updateAzureConfig({
                clientId: azureForm.clientId,
                clientSecret: azureForm.clientSecret || '__UNCHANGED__',
                tenantId: azureForm.tenantId,
            });
            if (response.success) {
                toast.success('Azure AD 配置已保存');
                queryClient.invalidateQueries({ queryKey: ['azure-config'] });
                setAzureForm(prev => ({ ...prev, clientSecret: '' }));
            } else {
                toast.error(response.error?.message || '保存失败');
            }
        } catch {
            toast.error('保存配置失败');
        } finally {
            setIsSavingAzure(false);
        }
    };

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

            {/* Azure AD 配置 (仅管理员) */}
            {user?.role === 'superadmin' && (
                <section className="bg-white dark:bg-dark-800 rounded-xl shadow-sm p-6 mb-6">
                    <h2 className="text-lg font-semibold text-dark-900 dark:text-dark-100 mb-4 flex items-center gap-2">
                        <Cloud className="w-5 h-5" />
                        Azure AD 配置
                    </h2>
                    <p className="text-sm text-dark-500 dark:text-dark-400 mb-4">
                        配置 Microsoft Azure AD 应用凭据，用于连接 OneDrive 存储。
                    </p>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
                                Client ID
                            </label>
                            <input
                                type="text"
                                value={azureForm.clientId}
                                onChange={(e) => setAzureForm(prev => ({ ...prev, clientId: e.target.value }))}
                                placeholder="Azure 应用的 Client ID"
                                className="w-full px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600 bg-white dark:bg-dark-700 text-dark-900 dark:text-dark-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
                                Client Secret
                            </label>
                            <div className="relative">
                                <input
                                    type={showSecret ? 'text' : 'password'}
                                    value={azureForm.clientSecret}
                                    onChange={(e) => setAzureForm(prev => ({ ...prev, clientSecret: e.target.value }))}
                                    placeholder={azureConfig?.clientSecret ? '已配置，留空则不修改' : 'Azure 应用的 Client Secret'}
                                    className="w-full px-3 py-2 pr-10 rounded-lg border border-dark-200 dark:border-dark-600 bg-white dark:bg-dark-700 text-dark-900 dark:text-dark-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowSecret(!showSecret)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-dark-400 hover:text-dark-600 dark:hover:text-dark-300"
                                >
                                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
                                Tenant ID
                            </label>
                            <input
                                type="text"
                                value={azureForm.tenantId}
                                onChange={(e) => setAzureForm(prev => ({ ...prev, tenantId: e.target.value }))}
                                placeholder="Azure AD 的 Tenant ID"
                                className="w-full px-3 py-2 rounded-lg border border-dark-200 dark:border-dark-600 bg-white dark:bg-dark-700 text-dark-900 dark:text-dark-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                        </div>
                        <div className="flex items-center justify-between pt-2">
                            <div className="text-sm">
                                {azureConfig?.configured ? (
                                    <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                                        <CheckCircle className="w-4 h-4" /> 已配置
                                    </span>
                                ) : (
                                    <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                        <AlertCircle className="w-4 h-4" /> 未配置
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={handleSaveAzure}
                                disabled={isSavingAzure}
                                className="btn btn-primary flex items-center gap-2"
                            >
                                {isSavingAzure ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}
                                保存配置
                            </button>
                        </div>
                    </div>
                </section>
            )}

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
