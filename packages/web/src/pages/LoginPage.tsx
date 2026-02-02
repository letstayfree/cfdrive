import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { systemService } from '../services/api';
import { Cloud, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoginPage() {
    const navigate = useNavigate();
    const { login, isAuthenticated } = useAuthStore();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [checkingInit, setCheckingInit] = useState(true);

    // 检查系统是否已初始化
    useEffect(() => {
        async function checkInit() {
            try {
                const response = await systemService.checkInit();
                if (response.success && response.data && !response.data.initialized) {
                    navigate('/setup');
                    return;
                }
            } catch {
                // 忽略错误
            }
            setCheckingInit(false);
        }
        checkInit();
    }, [navigate]);

    // 如果已登录，跳转到首页
    useEffect(() => {
        if (isAuthenticated) {
            navigate('/drive');
        }
    }, [isAuthenticated, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!username || !password) {
            toast.error('请输入用户名和密码');
            return;
        }

        setIsLoading(true);
        try {
            await login(username, password);
            toast.success('登录成功');
            navigate('/drive');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : '登录失败');
        } finally {
            setIsLoading(false);
        }
    };

    if (checkingInit) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-dark-50 dark:bg-dark-900">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-dark-900 dark:to-dark-800 p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-4">
                        <Cloud className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-dark-900 dark:text-dark-100">CFDrive</h1>
                    <p className="mt-2 text-dark-500 dark:text-dark-400">基于 Cloudflare 的云盘应用</p>
                </div>

                {/* 登录表单 */}
                <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl p-8">
                    <h2 className="text-xl font-semibold text-dark-900 dark:text-dark-100 mb-6">
                        登录到你的账户
                    </h2>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label
                                htmlFor="username"
                                className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1.5"
                            >
                                用户名或邮箱
                            </label>
                            <input
                                id="username"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="input"
                                placeholder="请输入用户名或邮箱"
                                autoComplete="username"
                                autoFocus
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="password"
                                className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1.5"
                            >
                                密码
                            </label>
                            <div className="relative">
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="input pr-10"
                                    placeholder="请输入密码"
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-600 dark:hover:text-dark-300"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full btn btn-primary py-2.5"
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                '登录'
                            )}
                        </button>
                    </form>
                </div>

                {/* 版权信息 */}
                <p className="mt-6 text-center text-sm text-dark-500 dark:text-dark-400">
                    © {new Date().getFullYear()} CFDrive. All rights reserved.
                </p>
            </div>
        </div>
    );
}
