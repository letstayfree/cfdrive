import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { logService } from '../services/api';
import {
    FileText,
    Download,
    Upload,
    Trash2,
    Edit,
    Eye,
    Share2,
    User,
    Calendar,
    Filter,
    BarChart3
} from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

const ACTION_ICONS: Record<string, any> = {
    view: Eye,
    download: Download,
    upload: Upload,
    edit: Edit,
    delete: Trash2,
    share: Share2,
    create: FileText,
};

const ACTION_LABELS: Record<string, string> = {
    view: '查看',
    download: '下载',
    upload: '上传',
    edit: '编辑',
    delete: '删除',
    share: '分享',
    create: '创建',
    move: '移动',
    copy: '复制',
    rename: '重命名',
};

const RESOURCE_TYPE_LABELS: Record<string, string> = {
    file: '文件',
    folder: '文件夹',
    share: '分享',
    user: '用户',
};

export default function LogsPage() {
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState({
        action: '',
        resource_type: '',
        start_date: '',
        end_date: '',
    });
    const [showStats, setShowStats] = useState(false);

    // 获取日志列表
    const { data: logsData, isLoading } = useQuery({
        queryKey: ['logs', page, filters],
        queryFn: async () => {
            const response = await logService.getLogs({
                page,
                limit: 20,
                ...filters,
            });
            return response.data;
        },
    });

    // 获取统计数据
    const { data: statsData } = useQuery({
        queryKey: ['logs-stats', filters.start_date, filters.end_date],
        queryFn: async () => {
            const response = await logService.getStats({
                start_date: filters.start_date || undefined,
                end_date: filters.end_date || undefined,
            });
            return response.data;
        },
        enabled: showStats,
    });

    const handleFilterChange = (key: string, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setPage(1); // 重置页码
    };

    const clearFilters = () => {
        setFilters({
            action: '',
            resource_type: '',
            start_date: '',
            end_date: '',
        });
        setPage(1);
    };

    const formatDate = (dateString: string) => {
        return format(new Date(dateString), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN });
    };

    if (isLoading && !logsData) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    const logs = logsData?.logs || [];
    const pagination = logsData?.pagination;

    return (
        <div className="p-6">
            <div className="max-w-7xl mx-auto">
                {/* 页头 */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-dark-900 dark:text-dark-100">
                                访问日志
                            </h1>
                            <p className="text-sm text-dark-500 dark:text-dark-400">
                                {pagination && `共 ${pagination.total} 条记录`}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowStats(!showStats)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                    >
                        <BarChart3 className="w-4 h-4" />
                        {showStats ? '隐藏' : '显示'}统计
                    </button>
                </div>

                {/* 统计面板 */}
                {showStats && statsData && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        {/* 按操作统计 */}
                        <div className="bg-white dark:bg-dark-800 rounded-xl p-4 shadow-sm border border-dark-200 dark:border-dark-700">
                            <h3 className="text-sm font-semibold text-dark-700 dark:text-dark-300 mb-3">
                                操作统计
                            </h3>
                            <div className="space-y-2">
                                {statsData.by_action.slice(0, 5).map(stat => (
                                    <div key={stat.action} className="flex items-center justify-between text-sm">
                                        <span className="text-dark-600 dark:text-dark-400">
                                            {ACTION_LABELS[stat.action] || stat.action}
                                        </span>
                                        <span className="font-medium text-dark-900 dark:text-dark-100">
                                            {stat.count}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 按资源类型统计 */}
                        <div className="bg-white dark:bg-dark-800 rounded-xl p-4 shadow-sm border border-dark-200 dark:border-dark-700">
                            <h3 className="text-sm font-semibold text-dark-700 dark:text-dark-300 mb-3">
                                资源类型统计
                            </h3>
                            <div className="space-y-2">
                                {statsData.by_resource.map(stat => (
                                    <div key={stat.resource_type} className="flex items-center justify-between text-sm">
                                        <span className="text-dark-600 dark:text-dark-400">
                                            {RESOURCE_TYPE_LABELS[stat.resource_type] || stat.resource_type}
                                        </span>
                                        <span className="font-medium text-dark-900 dark:text-dark-100">
                                            {stat.count}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 按用户统计 */}
                        <div className="bg-white dark:bg-dark-800 rounded-xl p-4 shadow-sm border border-dark-200 dark:border-dark-700">
                            <h3 className="text-sm font-semibold text-dark-700 dark:text-dark-300 mb-3">
                                活跃用户 TOP 5
                            </h3>
                            <div className="space-y-2">
                                {statsData.by_user.slice(0, 5).map(stat => (
                                    <div key={stat.user_id} className="flex items-center justify-between text-sm">
                                        <span className="text-dark-600 dark:text-dark-400 truncate">
                                            {stat.user?.username || '未知'}
                                        </span>
                                        <span className="font-medium text-dark-900 dark:text-dark-100">
                                            {stat.count}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* 筛选器 */}
                <div className="bg-white dark:bg-dark-800 rounded-xl p-4 shadow-sm border border-dark-200 dark:border-dark-700 mb-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Filter className="w-4 h-4 text-dark-500" />
                        <h3 className="text-sm font-semibold text-dark-700 dark:text-dark-300">
                            筛选
                        </h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <select
                            value={filters.action}
                            onChange={(e) => handleFilterChange('action', e.target.value)}
                            className="px-3 py-2 bg-dark-50 dark:bg-dark-700 border border-dark-200 dark:border-dark-600 rounded-lg focus:outline-none focus:border-primary-500 text-sm"
                        >
                            <option value="">所有操作</option>
                            {Object.entries(ACTION_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>

                        <select
                            value={filters.resource_type}
                            onChange={(e) => handleFilterChange('resource_type', e.target.value)}
                            className="px-3 py-2 bg-dark-50 dark:bg-dark-700 border border-dark-200 dark:border-dark-600 rounded-lg focus:outline-none focus:border-primary-500 text-sm"
                        >
                            <option value="">所有资源类型</option>
                            {Object.entries(RESOURCE_TYPE_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>

                        <input
                            type="date"
                            value={filters.start_date}
                            onChange={(e) => handleFilterChange('start_date', e.target.value)}
                            className="px-3 py-2 bg-dark-50 dark:bg-dark-700 border border-dark-200 dark:border-dark-600 rounded-lg focus:outline-none focus:border-primary-500 text-sm"
                            placeholder="开始日期"
                        />

                        <input
                            type="date"
                            value={filters.end_date}
                            onChange={(e) => handleFilterChange('end_date', e.target.value)}
                            className="px-3 py-2 bg-dark-50 dark:bg-dark-700 border border-dark-200 dark:border-dark-600 rounded-lg focus:outline-none focus:border-primary-500 text-sm"
                            placeholder="结束日期"
                        />
                    </div>
                    {(filters.action || filters.resource_type || filters.start_date || filters.end_date) && (
                        <button
                            onClick={clearFilters}
                            className="mt-3 text-sm text-primary600 hover:text-primary-700 transition-colors"
                        >
                            清除筛选
                        </button>
                    )}
                </div>

                {/* 日志列表 */}
                <div className="bg-white dark:bg-dark-800 rounded-xl shadow-sm border border-dark-200 dark:border-dark-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-dark-50 dark:bg-dark-700/50 border-b border-dark-200 dark:border-dark-700">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wider">
                                        时间
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wider">
                                        用户
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wider">
                                        操作
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wider">
                                        资源
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wider">
                                        IP 地址
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-dark-100 dark:divide-dark-700">
                                {logs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center text-dark-500">
                                            暂无日志记录
                                        </td>
                                    </tr>
                                ) : (
                                    logs.map((log) => {
                                        const Icon = ACTION_ICONS[log.action] || FileText;
                                        return (
                                            <tr key={log.id} className="hover:bg-dark-50 dark:hover:bg-dark-700/30 transition-colors">
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-dark-600 dark:text-dark-400">
                                                    <div className="flex items-center gap-2">
                                                        <Calendar className="w-3 h-3" />
                                                        {formatDate(log.created_at)}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm">
                                                    {log.user ? (
                                                        <div className="flex items-center gap-2">
                                                            <User className="w-3 h-3 text-dark-400" />
                                                            <span className="text-dark-900 dark:text-dark-100">
                                                                {log.user.username}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-dark-500">匿名</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm">
                                                    <div className="flex items-center gap-2">
                                                        <Icon className="w-4 h-4 text-primary-600" />
                                                        <span className="text-dark-900 dark:text-dark-100">
                                                            {ACTION_LABELS[log.action] || log.action}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-sm">
                                                    <div>
                                                        <span className="text-dark-500 text-xs">
                                                            {RESOURCE_TYPE_LABELS[log.resource_type] || log.resource_type}
                                                        </span>
                                                        {log.resource_path && (
                                                            <div className="text-dark-900 dark:text-dark-100 truncate max-w-xs">
                                                                {log.resource_path}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-dark-600 dark:text-dark-400">
                                                    {log.ip_address || '-'}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* 分页 */}
                    {pagination && pagination.pages > 1 && (
                        <div className="px-4 py-3 border-t border-dark-200 dark:border-dark-700 flex items-center justify-between">
                            <div className="text-sm text-dark-500">
                                第 {pagination.page} 页，共 {pagination.pages} 页
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="px-3 py-1 rounded border border-dark-300 dark:border-dark-600 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-dark-50 dark:hover:bg-dark-700"
                                >
                                    上一页
                                </button>
                                <button
                                    onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                                    disabled={page === pagination.pages}
                                    className="px-3 py-1 rounded border border-dark-300 dark:border-dark-600 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-dark-50 dark:hover:bg-dark-700"
                                >
                                    下一页
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
