import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function AppLayout() {
    return (
        <div className="min-h-screen flex bg-dark-50 dark:bg-dark-900">
            {/* 侧边栏 */}
            <Sidebar />

            {/* 主内容区 */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* 顶部导航 */}
                <Header />

                {/* 页面内容 */}
                <main className="flex-1 overflow-auto p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
