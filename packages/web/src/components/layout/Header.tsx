import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth';
import { useThemeStore } from '../../stores/theme';
import {
    Sun,
    Moon,
    Bell,
    ChevronDown,
    User,
    Settings,
    LogOut,
} from 'lucide-react';
import SearchBar from './SearchBar';

export default function Header() {
    const navigate = useNavigate();
    const { user, logout } = useAuthStore();
    const { isDark, toggleTheme } = useThemeStore();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // 点击外部关闭菜单
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowUserMenu(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <header className="h-16 bg-white dark:bg-dark-800 border-b border-dark-200 dark:border-dark-700 flex items-center justify-between px-6">
            {/* 左侧：搜索 */}
            <SearchBar />

            {/* 右侧：操作按钮、用户菜单 */}
            <div className="flex items-center gap-4">
                {/* 主题切换 */}
                <button
                    onClick={toggleTheme}
                    className="p-2 rounded-lg text-dark-500 dark:text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
                    title={isDark ? '切换到浅色模式' : '切换到深色模式'}
                >
                    {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>

                {/* 通知 */}
                <button className="p-2 rounded-lg text-dark-500 dark:text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors relative">
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                </button>

                {/* 用户菜单 */}
                <div className="relative" ref={menuRef}>
                    <button
                        onClick={() => setShowUserMenu(!showUserMenu)}
                        className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
                    >
                        <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white font-medium">
                            {user?.display_name?.[0] || user?.username?.[0] || 'U'}
                        </div>
                        <ChevronDown className="w-4 h-4 text-dark-500 dark:text-dark-400" />
                    </button>

                    {showUserMenu && (
                        <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-dark-800 rounded-lg shadow-lg border border-dark-200 dark:border-dark-700 py-1 z-50 animate-scaleIn">
                            <div className="px-4 py-3 border-b border-dark-200 dark:border-dark-700">
                                <div className="font-medium text-dark-900 dark:text-dark-100">
                                    {user?.display_name || user?.username}
                                </div>
                                <div className="text-sm text-dark-500 dark:text-dark-400">{user?.email}</div>
                            </div>
                            <button
                                onClick={() => {
                                    setShowUserMenu(false);
                                    navigate('/settings');
                                }}
                                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-dark-700 dark:text-dark-200 hover:bg-dark-100 dark:hover:bg-dark-700"
                            >
                                <User className="w-4 h-4" />
                                个人资料
                            </button>
                            <button
                                onClick={() => {
                                    setShowUserMenu(false);
                                    navigate('/settings');
                                }}
                                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-dark-700 dark:text-dark-200 hover:bg-dark-100 dark:hover:bg-dark-700"
                            >
                                <Settings className="w-4 h-4" />
                                设置
                            </button>
                            <div className="border-t border-dark-200 dark:border-dark-700 my-1" />
                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
                            >
                                <LogOut className="w-4 h-4" />
                                退出登录
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
