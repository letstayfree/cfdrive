import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { systemService } from '../services/api';
import { Cloud, Eye, EyeOff, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

export default function SetupPage() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        display_name: '',
    });
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [checkingInit, setCheckingInit] = useState(true);
    const [passwordStrength, setPasswordStrength] = useState<{
        strength: string;
        score: number;
        feedback: string[];
    } | null>(null);

    // 检查系统是否已初始化
    useEffect(() => {
        async function checkInit() {
            try {
                const response = await systemService.checkInit();
                if (response.success && response.data?.initialized) {
                    navigate('/login');
                    return;
                }
            } catch {
                // 忽略错误
            }
            setCheckingInit(false);
        }
        checkInit();
    }, [navigate]);

    // 检查密码强度
    useEffect(() => {
        if (!formData.password) {
            setPasswordStrength(null);
            return;
        }

        const timer = setTimeout(async () => {
            const response = await systemService.checkPassword(formData.password);
            if (response.success && response.data) {
                setPasswordStrength(response.data);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [formData.password]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.username || !formData.email || !formData.password) {
            toast.error('请填写所有必填项');
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            toast.error('两次输入的密码不一致');
            return;
        }

        if (passwordStrength?.strength === 'weak') {
            toast.error('密码强度不足，请使用更复杂的密码');
            return;
        }

        setIsLoading(true);
        try {
            const response = await systemService.setup({
                username: formData.username,
                email: formData.email,
                password: formData.password,
                display_name: formData.display_name || undefined,
            });

            if (response.success) {
                toast.success('初始化成功！请登录');
                navigate('/login');
            } else {
                toast.error(response.error?.message || '初始化失败');
            }
        } catch {
            toast.error('初始化失败');
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

    const getStrengthColor = (strength: string) => {
        switch (strength) {
            case 'weak':
                return 'bg-red-500';
            case 'medium':
                return 'bg-yellow-500';
            case 'strong':
                return 'bg-green-500';
            default:
                return 'bg-dark-300';
        }
    };

    const getStrengthWidth = (strength: string) => {
        switch (strength) {
            case 'weak':
                return 'w-1/3';
            case 'medium':
                return 'w-2/3';
            case 'strong':
                return 'w-full';
            default:
                return 'w-0';
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-dark-900 dark:to-dark-800 p-4">
            <div className="w-full max-w-lg">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-4">
                        <Cloud className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-dark-900 dark:text-dark-100">CFDrive</h1>
                    <p className="mt-2 text-dark-500 dark:text-dark-400">首次使用，请设置管理员账户</p>
                </div>

                {/* 设置表单 */}
                <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl p-8">
                    <h2 className="text-xl font-semibold text-dark-900 dark:text-dark-100 mb-6">
                        创建超级管理员账户
                    </h2>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1.5">
                                    用户名 *
                                </label>
                                <input
                                    type="text"
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    className="input"
                                    placeholder="admin"
                                    pattern="^[a-zA-Z0-9_]{3,20}$"
                                    title="3-20个字符，只能包含字母、数字和下划线"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1.5">
                                    显示名称
                                </label>
                                <input
                                    type="text"
                                    value={formData.display_name}
                                    onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                                    className="input"
                                    placeholder="管理员"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1.5">
                                邮箱 *
                            </label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="input"
                                placeholder="admin@example.com"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1.5">
                                密码 *
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    className="input pr-10"
                                    placeholder="至少8位，包含大小写字母和数字"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-600 dark:hover:text-dark-300"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>

                            {/* 密码强度指示器 */}
                            {formData.password && passwordStrength && (
                                <div className="mt-2">
                                    <div className="h-1.5 bg-dark-200 dark:bg-dark-700 rounded-full overflow-hidden">
                                        <div
                                            className={clsx(
                                                'h-full rounded-full transition-all',
                                                getStrengthColor(passwordStrength.strength),
                                                getStrengthWidth(passwordStrength.strength)
                                            )}
                                        />
                                    </div>
                                    <div className="mt-2 space-y-1">
                                        {passwordStrength.feedback.map((item, index) => (
                                            <div key={index} className="flex items-center gap-2 text-sm text-red-500">
                                                <X className="w-4 h-4" />
                                                {item}
                                            </div>
                                        ))}
                                        {passwordStrength.feedback.length === 0 && (
                                            <div className="flex items-center gap-2 text-sm text-green-500">
                                                <Check className="w-4 h-4" />
                                                密码强度符合要求
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1.5">
                                确认密码 *
                            </label>
                            <input
                                type="password"
                                value={formData.confirmPassword}
                                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                className={clsx(
                                    'input',
                                    formData.confirmPassword &&
                                    formData.password !== formData.confirmPassword &&
                                    'input-error'
                                )}
                                placeholder="再次输入密码"
                                required
                            />
                            {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                                <p className="mt-1 text-sm text-red-500">两次输入的密码不一致</p>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading || passwordStrength?.strength === 'weak'}
                            className="w-full btn btn-primary py-2.5"
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                '完成设置'
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
