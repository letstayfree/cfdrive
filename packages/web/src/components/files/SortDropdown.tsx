import { ArrowUpDown, ArrowUp, ArrowDown, Check } from 'lucide-react';
import { useFilesStore, SortField } from '../../stores/files';
import { useState, useRef, useEffect } from 'react';

const sortOptions: { field: SortField; label: string }[] = [
    { field: 'name', label: '名称' },
    { field: 'lastModifiedDateTime', label: '修改日期' },
    { field: 'size', label: '大小' },
    { field: 'type', label: '类型' },
];

export default function SortDropdown() {
    const { sortField, sortOrder, setSort } = useFilesStore();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // 点击外部关闭
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (field: SortField) => {
        if (field === sortField) {
            // 同字段切换排序方向
            setSort(field, sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            // 不同字段使用默认方向 (type 默认降序，其他默认升序)
            setSort(field, field === 'type' ? 'desc' : 'asc');
        }
        setIsOpen(false);
    };

    const currentLabel = sortOptions.find((o) => o.field === sortField)?.label || '名称';

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="btn btn-secondary flex items-center gap-2"
            >
                <ArrowUpDown className="w-4 h-4" />
                <span className="hidden sm:inline">{currentLabel}</span>
                {sortOrder === 'asc' ? (
                    <ArrowUp className="w-3 h-3" />
                ) : (
                    <ArrowDown className="w-3 h-3" />
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-dark-800 rounded-lg shadow-xl border border-dark-200 dark:border-dark-700 py-1 z-50">
                    <div className="px-3 py-2 text-xs font-medium text-dark-500 uppercase tracking-wider">
                        排序方式
                    </div>
                    {sortOptions.map((option) => (
                        <button
                            key={option.field}
                            onClick={() => handleSelect(option.field)}
                            className="w-full px-3 py-2 flex items-center justify-between text-left text-dark-900 dark:text-dark-100 hover:bg-dark-50 dark:hover:bg-dark-700 transition-colors"
                        >
                            <span>{option.label}</span>
                            <div className="flex items-center gap-1">
                                {sortField === option.field && (
                                    <>
                                        <Check className="w-4 h-4 text-primary-600" />
                                        {sortOrder === 'asc' ? (
                                            <ArrowUp className="w-3 h-3 text-primary-600" />
                                        ) : (
                                            <ArrowDown className="w-3 h-3 text-primary-600" />
                                        )}
                                    </>
                                )}
                            </div>
                        </button>
                    ))}
                    <div className="border-t border-dark-200 dark:border-dark-700 my-1" />
                    <div className="px-3 py-2 text-xs text-dark-500">
                        点击已选项切换升/降序
                    </div>
                </div>
            )}
        </div>
    );
}
