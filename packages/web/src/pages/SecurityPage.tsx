import { useState, useEffect } from 'react';
import { Shield, Plus, Trash2, ToggleLeft, ToggleRight, AlertCircle, Info } from 'lucide-react';
import { securityService } from '../services/api';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface IpWhitelistEntry {
    id: string;
    ip_pattern: string;
    description: string | null;
    is_active: number;
    created_at: string;
}

export default function SecurityPage() {
    const [enabled, setEnabled] = useState(false);
    const [items, setItems] = useState<IpWhitelistEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newIp, setNewIp] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [adding, setAdding] = useState(false);
    const [toggling, setToggling] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await securityService.getIpWhitelist();
            if (response.success && response.data) {
                setEnabled(response.data.enabled);
                setItems(response.data.items);
            }
        } catch (err) {
            setError('加载 IP 白名单失败');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = async () => {
        try {
            setToggling(true);
            const response = await securityService.toggleIpWhitelist(!enabled);
            if (response.success) {
                setEnabled(!enabled);
            }
        } catch (err: any) {
            setError(err.message || '切换失败');
        } finally {
            setToggling(false);
        }
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newIp.trim()) return;

        try {
            setAdding(true);
            setError(null);
            const response = await securityService.addIpWhitelist({
                ip_pattern: newIp.trim(),
                description: newDescription.trim() || undefined,
            });
            if (response.success && response.data) {
                setItems([
                    {
                        id: response.data.id,
                        ip_pattern: response.data.ip_pattern,
                        description: response.data.description,
                        is_active: 1,
                        created_at: new Date().toISOString(),
                    },
                    ...items,
                ]);
                setNewIp('');
                setNewDescription('');
                setShowAddForm(false);
            }
        } catch (err: any) {
            setError(err.message || '添加失败');
        } finally {
            setAdding(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('确定要删除这条 IP 规则吗？')) return;

        try {
            const response = await securityService.deleteIpWhitelist(id);
            if (response.success) {
                setItems(items.filter((item) => item.id !== id));
            }
        } catch (err: any) {
            setError(err.message || '删除失败');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Shield className="w-8 h-8 text-blue-500" />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">安全设置</h1>
                        <p className="text-gray-500 dark:text-gray-400">管理 IP 白名单和访问控制</p>
                    </div>
                </div>
            </div>

            {error && (
                <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-400">
                    <AlertCircle className="w-5 h-5" />
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
                        ✕
                    </button>
                </div>
            )}

            {/* IP 白名单开关 */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">IP 白名单</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            启用后，只有白名单中的 IP 地址可以访问系统
                        </p>
                    </div>
                    <button
                        onClick={handleToggle}
                        disabled={toggling}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${enabled
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                            }`}
                    >
                        {enabled ? (
                            <>
                                <ToggleRight className="w-6 h-6" />
                                <span>已启用</span>
                            </>
                        ) : (
                            <>
                                <ToggleLeft className="w-6 h-6" />
                                <span>已禁用</span>
                            </>
                        )}
                    </button>
                </div>

                {enabled && items.length === 0 && (
                    <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                        <AlertCircle className="w-5 h-5" />
                        <span>警告：白名单为空，所有访问将被阻止！请添加至少一条 IP 规则。</span>
                    </div>
                )}
            </div>

            {/* IP 规则列表 */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900 dark:text-white">IP 规则列表</h3>
                    <button
                        onClick={() => setShowAddForm(true)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        <span>添加规则</span>
                    </button>
                </div>

                {showAddForm && (
                    <form onSubmit={handleAdd} className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    IP 地址 / CIDR
                                </label>
                                <input
                                    type="text"
                                    value={newIp}
                                    onChange={(e) => setNewIp(e.target.value)}
                                    placeholder="如: 192.168.1.1 或 192.168.0.0/24"
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    备注（选填）
                                </label>
                                <input
                                    type="text"
                                    value={newDescription}
                                    onChange={(e) => setNewDescription(e.target.value)}
                                    placeholder="如: 公司办公室"
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-2 mt-4">
                            <button
                                type="submit"
                                disabled={adding}
                                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
                            >
                                {adding ? '添加中...' : '添加'}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowAddForm(false);
                                    setNewIp('');
                                    setNewDescription('');
                                }}
                                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                            >
                                取消
                            </button>
                        </div>
                        <div className="mt-3 flex items-start gap-2 text-sm text-gray-500 dark:text-gray-400">
                            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>支持格式：单个IP（192.168.1.1）、CIDR（192.168.0.0/24）、通配符（192.168.*）</span>
                        </div>
                    </form>
                )}

                {items.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                        <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>暂无 IP 规则</p>
                        <p className="text-sm">点击上方"添加规则"按钮添加允许访问的 IP 地址</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                        {items.map((item) => (
                            <div
                                key={item.id}
                                className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                            >
                                <div>
                                    <div className="font-mono text-gray-900 dark:text-white">{item.ip_pattern}</div>
                                    {item.description && (
                                        <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                                            {item.description}
                                        </div>
                                    )}
                                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                        添加于 {format(new Date(item.created_at), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDelete(item.id)}
                                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                    title="删除"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
