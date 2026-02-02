import { useState, useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface RenameModalProps {
    isOpen: boolean;
    itemName: string;
    itemType: 'file' | 'folder';
    onClose: () => void;
    onConfirm: (newName: string) => void;
    isLoading?: boolean;
}

export default function RenameModal({
    isOpen,
    itemName,
    itemType,
    onClose,
    onConfirm,
    isLoading = false,
}: RenameModalProps) {
    const [newName, setNewName] = useState(itemName);
    const [error, setError] = useState('');

    useEffect(() => {
        setNewName(itemName);
        setError('');
    }, [itemName, isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const trimmedName = newName.trim();

        if (!trimmedName) {
            setError('名称不能为空');
            return;
        }

        if (trimmedName === itemName) {
            onClose();
            return;
        }

        // 检查非法字符
        if (/[<>:"/\\|?*]/.test(trimmedName)) {
            setError('名称包含非法字符: < > : " / \\ | ? *');
            return;
        }

        onConfirm(trimmedName);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fadeIn">
            <div className="bg-white dark:bg-dark-800 rounded-xl shadow-xl w-full max-w-md mx-4">
                <div className="flex items-center justify-between p-4 border-b border-dark-200 dark:border-dark-700">
                    <h3 className="text-lg font-semibold text-dark-900 dark:text-dark-100">
                        重命名{itemType === 'folder' ? '文件夹' : '文件'}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
                    >
                        <X className="w-5 h-5 text-dark-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4">
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                            新名称
                        </label>
                        <input
                            type="text"
                            value={newName}
                            onChange={(e) => {
                                setNewName(e.target.value);
                                setError('');
                            }}
                            className="input w-full"
                            autoFocus
                            disabled={isLoading}
                        />
                        {error && (
                            <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                                <AlertTriangle className="w-4 h-4" />
                                {error}
                            </p>
                        )}
                    </div>

                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn btn-secondary"
                            disabled={isLoading}
                        >
                            取消
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={isLoading}
                        >
                            {isLoading ? '重命名中...' : '确认'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
