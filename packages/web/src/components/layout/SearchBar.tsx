import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, File, Folder, Loader2 } from 'lucide-react';
import { fileService } from '../../services/api';
import type { DriveItem } from '../../stores/files';
import { formatFileSize } from '../../utils/file';

export default function SearchBar() {
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [results, setResults] = useState<DriveItem[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // 点击外部关闭
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // 搜索
    useEffect(() => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        if (!query.trim()) {
            setResults([]);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);
        searchTimeoutRef.current = setTimeout(async () => {
            try {
                const response = await fileService.search(query);
                if (response.success && response.data) {
                    const data = response.data as { items: DriveItem[] };
                    setResults(data.items || []);
                }
            } catch (error) {
                console.error('Search error:', error);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [query]);

    const handleResultClick = (item: DriveItem) => {
        if (item.folder) {
            navigate(`/drive/${item.id}`);
        } else if (item.parentReference?.id) {
            navigate(`/drive/${item.parentReference.id}`);
        }
        setIsOpen(false);
        setQuery('');
    };

    const handleClear = () => {
        setQuery('');
        setResults([]);
        inputRef.current?.focus();
    };

    return (
        <div ref={containerRef} className="relative flex-1 max-w-lg">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    placeholder="搜索文件和文件夹..."
                    className="w-full pl-10 pr-10 py-2 bg-dark-100 dark:bg-dark-700 border border-transparent focus:border-primary-500 focus:bg-white dark:focus:bg-dark-800 rounded-lg text-dark-900 dark:text-dark-100 placeholder-dark-400 transition-colors"
                />
                {query && (
                    <button
                        onClick={handleClear}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-dark-200 dark:hover:bg-dark-600"
                    >
                        <X className="w-4 h-4 text-dark-400" />
                    </button>
                )}
            </div>

            {/* 搜索结果下拉 */}
            {isOpen && query.trim() && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-dark-800 rounded-xl shadow-lg border border-dark-200 dark:border-dark-700 overflow-hidden z-50 max-h-96 overflow-y-auto">
                    {isSearching ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
                        </div>
                    ) : results.length === 0 ? (
                        <div className="py-8 text-center text-dark-500">
                            <p>未找到 "{query}" 相关的文件</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-dark-100 dark:divide-dark-700">
                            {results.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => handleResultClick(item)}
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-dark-50 dark:hover:bg-dark-700/50 transition-colors text-left"
                                >
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${item.folder
                                            ? 'bg-yellow-100 dark:bg-yellow-900/30'
                                            : 'bg-blue-100 dark:bg-blue-900/30'
                                        }`}>
                                        {item.folder ? (
                                            <Folder className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                                        ) : (
                                            <File className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-dark-900 dark:text-dark-100 truncate">
                                            {item.name}
                                        </p>
                                        <p className="text-sm text-dark-500 truncate">
                                            {item.parentReference?.path?.replace('/drive/root:', '') || '/'}
                                            {!item.folder && ` · ${formatFileSize(item.size)}`}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
