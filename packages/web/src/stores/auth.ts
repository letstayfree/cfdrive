import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../services/api';

export interface User {
    id: string;
    username: string;
    email: string;
    display_name: string | null;
    role: 'superadmin' | 'collaborator' | 'customer' | 'guest';
    avatar_url: string | null;
}

interface AuthState {
    token: string | null;
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;

    // Actions
    login: (username: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    checkAuth: () => Promise<void>;
    updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            token: null,
            user: null,
            isAuthenticated: false,
            isLoading: true,

            login: async (username: string, password: string) => {
                const response = await api.post<{
                    token: string;
                    user: User;
                }>('/auth/login', { username, password });

                if (response.success && response.data) {
                    set({
                        token: response.data.token,
                        user: response.data.user,
                        isAuthenticated: true,
                    });
                } else {
                    throw new Error(response.error?.message || '登录失败');
                }
            },

            logout: async () => {
                try {
                    await api.post('/auth/logout');
                } catch {
                    // 忽略登出错误
                }
                set({
                    token: null,
                    user: null,
                    isAuthenticated: false,
                });
            },

            checkAuth: async () => {
                const { token } = get();
                if (!token) {
                    set({ isLoading: false });
                    return;
                }

                try {
                    const response = await api.get<User>('/auth/me');
                    if (response.success && response.data) {
                        set({
                            user: response.data,
                            isAuthenticated: true,
                            isLoading: false,
                        });
                    } else {
                        set({
                            token: null,
                            user: null,
                            isAuthenticated: false,
                            isLoading: false,
                        });
                    }
                } catch {
                    set({
                        token: null,
                        user: null,
                        isAuthenticated: false,
                        isLoading: false,
                    });
                }
            },

            updateUser: (userData) => {
                const { user } = get();
                if (user) {
                    set({ user: { ...user, ...userData } });
                }
            },
        }),
        {
            name: 'cfdrive-auth',
            partialize: (state) => ({ token: state.token }),
        }
    )
);
