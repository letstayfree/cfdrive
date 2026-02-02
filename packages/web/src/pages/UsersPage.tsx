import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userService } from '../services/api';
import {
    Users,
    UserPlus,
    Search,
    MoreVertical,
    Shield,
    User,
    UserCheck,
    UserX,
    Trash2,
    Key,
    X,
    Loader2,
    AlertTriangle,
} from 'lucide-react';

interface UserData {
    id: string;
    username: string;
    email: string;
    display_name: string;
    role: 'superadmin' | 'collaborator' | 'customer' | 'guest';
    status: 'active' | 'disabled';
    created_at: string;
    last_login_at: string | null;
}

interface CreateUserForm {
    username: string;
    email: string;
    password: string;
    display_name: string;
    role: 'collaborator' | 'customer' | 'guest';
}

export default function UsersPage() {
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
    const [actionMenuUser, setActionMenuUser] = useState<string | null>(null);

    // 获取用户列表
    const { data: usersData, isLoading } = useQuery({
        queryKey: ['users', searchQuery, roleFilter],
        queryFn: async () => {
            const response = await userService.list({
                search: searchQuery || undefined,
                role: roleFilter || undefined,
            });
            return response.data as { items: UserData[]; total: number };
        },
    });

    // 删除用户
    const deleteMutation = useMutation({
        mutationFn: (userId: string) => userService.delete(userId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            setSelectedUser(null);
        },
    });

    // 更新用户状态
    const updateStatusMutation = useMutation({
        mutationFn: ({ userId, status }: { userId: string; status: string }) =>
            userService.update(userId, { status }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
        },
    });

    const getRoleBadge = (role: string) => {
        const config = {
            superadmin: { label: '超级管理员', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
            collaborator: { label: '协作者', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
            customer: { label: '客户', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
            guest: { label: '访客', color: 'bg-dark-100 text-dark-700 dark:bg-dark-700 dark:text-dark-300' },
        };
        const { label, color } = config[role as keyof typeof config] || config.guest;
        return (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
                <Shield className="w-3 h-3" />
                {label}
            </span>
        );
    };

    const getStatusBadge = (status: string) => {
        if (status === 'active') {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                    <UserCheck className="w-3 h-3" />
                    启用
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                <UserX className="w-3 h-3" />
                禁用
            </span>
        );
    };

    return (
        <div className="p-6">
            {/* 头部 */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-dark-900 dark:text-dark-100 flex items-center gap-2">
                        <Users className="w-7 h-7" />
                        用户管理
                    </h1>
                    <p className="text-dark-500 mt-1">
                        共 {usersData?.total || 0} 个用户
                    </p>
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="btn btn-primary flex items-center gap-2"
                >
                    <UserPlus className="w-4 h-4" />
                    添加用户
                </button>
            </div>

            {/* 筛选栏 */}
            <div className="flex items-center gap-4 mb-6">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="搜索用户名或邮箱..."
                        className="input pl-10"
                    />
                </div>
                <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="input w-40"
                >
                    <option value="">所有角色</option>
                    <option value="superadmin">超级管理员</option>
                    <option value="collaborator">协作者</option>
                    <option value="customer">客户</option>
                    <option value="guest">访客</option>
                </select>
            </div>

            {/* 用户列表 */}
            <div className="bg-white dark:bg-dark-800 rounded-xl shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
                    </div>
                ) : usersData?.items?.length === 0 ? (
                    <div className="text-center py-12 text-dark-500">
                        <User className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>暂无用户数据</p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-dark-50 dark:bg-dark-700/50">
                            <tr>
                                <th className="px-4 py-3 text-left text-sm font-medium text-dark-500">用户</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-dark-500">角色</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-dark-500">状态</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-dark-500">创建时间</th>
                                <th className="px-4 py-3 text-right text-sm font-medium text-dark-500">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-100 dark:divide-dark-700">
                            {usersData?.items?.map((user) => (
                                <tr key={user.id} className="hover:bg-dark-50 dark:hover:bg-dark-700/50">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                                                <span className="text-primary-600 font-medium">
                                                    {user.display_name?.[0] || user.username[0]}
                                                </span>
                                            </div>
                                            <div>
                                                <p className="font-medium text-dark-900 dark:text-dark-100">
                                                    {user.display_name || user.username}
                                                </p>
                                                <p className="text-sm text-dark-500">{user.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">{getRoleBadge(user.role)}</td>
                                    <td className="px-4 py-3">{getStatusBadge(user.status)}</td>
                                    <td className="px-4 py-3 text-sm text-dark-500">
                                        {new Date(user.created_at).toLocaleDateString('zh-CN')}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="relative">
                                            <button
                                                onClick={() => setActionMenuUser(actionMenuUser === user.id ? null : user.id)}
                                                className="p-1.5 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-600"
                                                disabled={user.role === 'superadmin'}
                                            >
                                                <MoreVertical className="w-5 h-5 text-dark-400" />
                                            </button>
                                            {actionMenuUser === user.id && user.role !== 'superadmin' && (
                                                <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-dark-800 rounded-lg shadow-lg border border-dark-200 dark:border-dark-700 py-1 z-10">
                                                    <button
                                                        onClick={() => {
                                                            updateStatusMutation.mutate({
                                                                userId: user.id,
                                                                status: user.status === 'active' ? 'disabled' : 'active',
                                                            });
                                                            setActionMenuUser(null);
                                                        }}
                                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-dark-700 dark:text-dark-200 hover:bg-dark-100 dark:hover:bg-dark-700"
                                                    >
                                                        {user.status === 'active' ? (
                                                            <>
                                                                <UserX className="w-4 h-4" />
                                                                禁用用户
                                                            </>
                                                        ) : (
                                                            <>
                                                                <UserCheck className="w-4 h-4" />
                                                                启用用户
                                                            </>
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            // TODO: 重置密码
                                                            setActionMenuUser(null);
                                                        }}
                                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-dark-700 dark:text-dark-200 hover:bg-dark-100 dark:hover:bg-dark-700"
                                                    >
                                                        <Key className="w-4 h-4" />
                                                        重置密码
                                                    </button>
                                                    <div className="my-1 border-t border-dark-200 dark:border-dark-700" />
                                                    <button
                                                        onClick={() => {
                                                            setSelectedUser(user);
                                                            setActionMenuUser(null);
                                                        }}
                                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                        删除用户
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* 创建用户弹窗 */}
            {isCreateModalOpen && (
                <CreateUserModal
                    onClose={() => setIsCreateModalOpen(false)}
                    onSuccess={() => {
                        setIsCreateModalOpen(false);
                        queryClient.invalidateQueries({ queryKey: ['users'] });
                    }}
                />
            )}

            {/* 删除确认弹窗 */}
            {selectedUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white dark:bg-dark-800 rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-dark-900 dark:text-dark-100">
                                确认删除用户
                            </h3>
                        </div>
                        <p className="text-dark-600 dark:text-dark-400 mb-6">
                            确定要删除用户 <strong>{selectedUser.display_name || selectedUser.username}</strong> 吗？此操作不可撤销。
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setSelectedUser(null)}
                                className="btn btn-secondary"
                            >
                                取消
                            </button>
                            <button
                                onClick={() => deleteMutation.mutate(selectedUser.id)}
                                className="btn bg-red-600 hover:bg-red-700 text-white"
                                disabled={deleteMutation.isPending}
                            >
                                {deleteMutation.isPending ? '删除中...' : '删除'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// 创建用户弹窗组件
function CreateUserModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
    const [form, setForm] = useState<CreateUserForm>({
        username: '',
        email: '',
        password: '',
        display_name: '',
        role: 'customer',
    });
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const response = await userService.create(form);
            if (response.success) {
                onSuccess();
            } else {
                setError(response.error?.message || '创建失败');
            }
        } catch {
            setError('创建用户失败');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-dark-800 rounded-xl shadow-xl w-full max-w-md mx-4">
                <div className="flex items-center justify-between p-4 border-b border-dark-200 dark:border-dark-700">
                    <h3 className="text-lg font-semibold text-dark-900 dark:text-dark-100">
                        添加用户
                    </h3>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700">
                        <X className="w-5 h-5 text-dark-500" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
                            用户名 *
                        </label>
                        <input
                            type="text"
                            value={form.username}
                            onChange={(e) => setForm({ ...form, username: e.target.value })}
                            className="input"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
                            邮箱 *
                        </label>
                        <input
                            type="email"
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                            className="input"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
                            密码 *
                        </label>
                        <input
                            type="password"
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                            className="input"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
                            显示名称
                        </label>
                        <input
                            type="text"
                            value={form.display_name}
                            onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                            className="input"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
                            角色 *
                        </label>
                        <select
                            value={form.role}
                            onChange={(e) => setForm({ ...form, role: e.target.value as any })}
                            className="input"
                        >
                            <option value="collaborator">协作者</option>
                            <option value="customer">客户</option>
                            <option value="guest">访客</option>
                        </select>
                    </div>
                    {error && (
                        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                    )}
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose} className="btn btn-secondary">
                            取消
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={isLoading}>
                            {isLoading ? '创建中...' : '创建'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
