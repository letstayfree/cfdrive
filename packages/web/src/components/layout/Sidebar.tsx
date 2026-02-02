import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth';
import {
    HardDrive,
    Star,
    Trash2,
    Share2,
    Settings,
    Users,
    Cloud,
} from 'lucide-react';
import clsx from 'clsx';

const navItems = [
    { path: '/drive', icon: HardDrive, label: '我的网盘' },
    { path: '/favorites', icon: Star, label: '收藏' },
    { path: '/shares', icon: Share2, label: '我的分享' },
    { path: '/trash', icon: Trash2, label: '回收站' },
];

const adminItems = [
    { path: '/users', icon: Users, label: '用户管理' },
];

const bottomItems = [
    { path: '/settings', icon: Settings, label: '设置' },
];

export default function Sidebar() {
    const { user } = useAuthStore();

    const isAdmin = user?.role === 'superadmin';

    return (
        <aside className="w-64 bg-white dark:bg-dark-800 border-r border-dark-200 dark:border-dark-700 flex flex-col">
            {/* Logo */}
            <div className="h-16 flex items-center gap-3 px-6 border-b border-dark-200 dark:border-dark-700">
                <Cloud className="w-8 h-8 text-primary-600" />
                <span className="text-xl font-bold text-dark-900 dark:text-dark-100">CFDrive</span>
            </div>

            {/* 导航菜单 */}
            <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            clsx(
                                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                                isActive
                                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                                    : 'text-dark-600 dark:text-dark-300 hover:bg-dark-100 dark:hover:bg-dark-700'
                            )
                        }
                    >
                        <item.icon className="w-5 h-5" />
                        {item.label}
                    </NavLink>
                ))}

                {/* 管理员菜单 */}
                {isAdmin && (
                    <>
                        <div className="pt-4 pb-2 px-3">
                            <span className="text-xs font-semibold text-dark-400 dark:text-dark-500 uppercase tracking-wider">
                                管理
                            </span>
                        </div>
                        {adminItems.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                className={({ isActive }) =>
                                    clsx(
                                        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                                        isActive
                                            ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                                            : 'text-dark-600 dark:text-dark-300 hover:bg-dark-100 dark:hover:bg-dark-700'
                                    )
                                }
                            >
                                <item.icon className="w-5 h-5" />
                                {item.label}
                            </NavLink>
                        ))}
                    </>
                )}
            </nav>

            {/* 底部菜单 */}
            <div className="py-4 px-3 border-t border-dark-200 dark:border-dark-700">
                {bottomItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            clsx(
                                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                                isActive
                                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                                    : 'text-dark-600 dark:text-dark-300 hover:bg-dark-100 dark:hover:bg-dark-700'
                            )
                        }
                    >
                        <item.icon className="w-5 h-5" />
                        {item.label}
                    </NavLink>
                ))}
            </div>

            {/* 存储空间指示器 */}
            <div className="p-4 border-t border-dark-200 dark:border-dark-700">
                <div className="text-sm text-dark-500 dark:text-dark-400 mb-2">存储空间</div>
                <div className="h-2 bg-dark-200 dark:bg-dark-700 rounded-full overflow-hidden">
                    <div className="h-full w-1/3 bg-primary-500 rounded-full" />
                </div>
                <div className="mt-2 text-xs text-dark-400 dark:text-dark-500">
                    已使用 33 GB / 100 GB
                </div>
            </div>
        </aside>
    );
}
