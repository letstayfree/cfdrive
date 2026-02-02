import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ThemeState {
    isDark: boolean;
    toggleTheme: () => void;
    setDark: (isDark: boolean) => void;
    setTheme: (theme: 'light' | 'dark') => void;
}

export const useThemeStore = create<ThemeState>()(
    persist(
        (set) => ({
            isDark: typeof window !== 'undefined'
                ? window.matchMedia('(prefers-color-scheme: dark)').matches
                : false,

            toggleTheme: () => set((state) => ({ isDark: !state.isDark })),

            setDark: (isDark) => set({ isDark }),

            setTheme: (theme) => set({ isDark: theme === 'dark' }),
        }),
        {
            name: 'cfdrive-theme',
        }
    )
);
