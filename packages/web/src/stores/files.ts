import { create } from 'zustand';

export interface DriveItem {
    id: string;
    name: string;
    size: number;
    createdDateTime: string;
    lastModifiedDateTime: string;
    webUrl: string;
    parentReference?: {
        id: string;
        path: string;
    };
    folder?: {
        childCount: number;
    };
    file?: {
        mimeType: string;
    };
    thumbnails?: Array<{
        id: string;
        large?: { url: string };
        medium?: { url: string };
        small?: { url: string };
    }>;
}

export type ViewMode = 'list' | 'grid' | 'details';
export type SortField = 'name' | 'size' | 'lastModifiedDateTime';
export type SortOrder = 'asc' | 'desc';

interface FilesState {
    // 当前目录
    currentFolderId: string;
    currentPath: Array<{ id: string; name: string }>;

    // 文件列表
    items: DriveItem[];
    isLoading: boolean;

    // 选择状态
    selectedIds: Set<string>;

    // 视图设置
    viewMode: ViewMode;
    sortField: SortField;
    sortOrder: SortOrder;

    // 搜索
    searchQuery: string;
    isSearching: boolean;

    // Actions
    setCurrentFolder: (folderId: string, path: Array<{ id: string; name: string }>) => void;
    setItems: (items: DriveItem[]) => void;
    setLoading: (isLoading: boolean) => void;

    selectItem: (id: string) => void;
    deselectItem: (id: string) => void;
    toggleSelectItem: (id: string) => void;
    selectAll: () => void;
    clearSelection: () => void;

    setViewMode: (mode: ViewMode) => void;
    setSort: (field: SortField, order: SortOrder) => void;

    setSearchQuery: (query: string) => void;
    setSearching: (isSearching: boolean) => void;

    // 文件操作后更新
    addItem: (item: DriveItem) => void;
    updateItem: (id: string, updates: Partial<DriveItem>) => void;
    removeItem: (id: string) => void;
}

export const useFilesStore = create<FilesState>((set, get) => ({
    currentFolderId: 'root',
    currentPath: [{ id: 'root', name: '我的网盘' }],
    items: [],
    isLoading: false,
    selectedIds: new Set(),
    viewMode: 'list',
    sortField: 'name',
    sortOrder: 'asc',
    searchQuery: '',
    isSearching: false,

    setCurrentFolder: (folderId, path) => {
        set({
            currentFolderId: folderId,
            currentPath: path,
            selectedIds: new Set(),
        });
    },

    setItems: (items) => set({ items }),
    setLoading: (isLoading) => set({ isLoading }),

    selectItem: (id) => {
        const { selectedIds } = get();
        const newSelected = new Set(selectedIds);
        newSelected.add(id);
        set({ selectedIds: newSelected });
    },

    deselectItem: (id) => {
        const { selectedIds } = get();
        const newSelected = new Set(selectedIds);
        newSelected.delete(id);
        set({ selectedIds: newSelected });
    },

    toggleSelectItem: (id) => {
        const { selectedIds } = get();
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        set({ selectedIds: newSelected });
    },

    selectAll: () => {
        const { items } = get();
        set({ selectedIds: new Set(items.map((item) => item.id)) });
    },

    clearSelection: () => set({ selectedIds: new Set() }),

    setViewMode: (viewMode) => set({ viewMode }),

    setSort: (sortField, sortOrder) => set({ sortField, sortOrder }),

    setSearchQuery: (searchQuery) => set({ searchQuery }),
    setSearching: (isSearching) => set({ isSearching }),

    addItem: (item) => {
        const { items } = get();
        set({ items: [...items, item] });
    },

    updateItem: (id, updates) => {
        const { items } = get();
        set({
            items: items.map((item) =>
                item.id === id ? { ...item, ...updates } : item
            ),
        });
    },

    removeItem: (id) => {
        const { items, selectedIds } = get();
        const newSelected = new Set(selectedIds);
        newSelected.delete(id);
        set({
            items: items.filter((item) => item.id !== id),
            selectedIds: newSelected,
        });
    },
}));
