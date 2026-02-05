import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth';
import { useThemeStore } from './stores/theme';
import { useEffect } from 'react';

// Pages
import LoginPage from './pages/LoginPage';
import SetupPage from './pages/SetupPage';
import DrivePage from './pages/DrivePage';
import ShareViewPage from './pages/ShareViewPage';
import SharesPage from './pages/SharesPage';
import FavoritesPage from './pages/FavoritesPage';
import TrashPage from './pages/TrashPage';
import SettingsPage from './pages/SettingsPage';
import UsersPage from './pages/UsersPage';
import TagsPage from './pages/TagsPage';
import LogsPage from './pages/LogsPage';

// Layout
import AppLayout from './components/layout/AppLayout';

// Auth guard component
function PrivateRoute({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isLoading } = useAuthStore();

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return <>{children}</>;
}

// Admin guard component
function AdminRoute({ children }: { children: React.ReactNode }) {
    const { user } = useAuthStore();

    if (user?.role !== 'superadmin') {
        return <Navigate to="/drive" replace />;
    }

    return <>{children}</>;
}

export default function App() {
    const { isDark } = useThemeStore();
    const { checkAuth } = useAuthStore();

    useEffect(() => {
        // 应用主题
        if (isDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }

        // 设置 toast 颜色变量
        document.documentElement.style.setProperty(
            '--toast-bg',
            isDark ? '#1e293b' : '#ffffff'
        );
        document.documentElement.style.setProperty(
            '--toast-color',
            isDark ? '#f1f5f9' : '#0f172a'
        );
    }, [isDark]);

    useEffect(() => {
        // 检查认证状态
        checkAuth();
    }, [checkAuth]);

    return (
        <BrowserRouter>
            <Routes>
                {/* 公开路由 */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/setup" element={<SetupPage />} />
                <Route path="/s/:code" element={<ShareViewPage />} />

                {/* 需要认证的路由 */}
                <Route
                    path="/"
                    element={
                        <PrivateRoute>
                            <AppLayout />
                        </PrivateRoute>
                    }
                >
                    <Route index element={<Navigate to="/drive" replace />} />
                    <Route path="drive" element={<DrivePage />} />
                    <Route path="drive/:folderId" element={<DrivePage />} />
                    <Route path="favorites" element={<FavoritesPage />} />
                    <Route path="trash" element={<TrashPage />} />
                    <Route path="tags" element={<TagsPage />} />
                    <Route path="shares" element={<SharesPage />} />
                    <Route path="settings" element={<SettingsPage />} />

                    {/* 管理员路由 */}
                    <Route
                        path="users"
                        element={
                            <AdminRoute>
                                <UsersPage />
                            </AdminRoute>
                        }
                    />
                    <Route
                        path="logs"
                        element={
                            <AdminRoute>
                                <LogsPage />
                            </AdminRoute>
                        }
                    />
                </Route>

                {/* 404 */}
                <Route
                    path="*"
                    element={
                        <div className="min-h-screen flex items-center justify-center">
                            <div className="text-center">
                                <h1 className="text-4xl font-bold text-dark-900 dark:text-dark-100">404</h1>
                                <p className="mt-2 text-dark-500">页面不存在</p>
                            </div>
                        </div>
                    }
                />
            </Routes>
        </BrowserRouter>
    );
}
