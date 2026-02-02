import { Link } from 'react-router-dom';
import { useFilesStore } from '../../stores/files';
import { ChevronRight, Home } from 'lucide-react';

export default function Breadcrumb() {
    const { currentPath } = useFilesStore();

    return (
        <nav className="flex items-center gap-1 text-sm">
            <Link
                to="/drive"
                className="flex items-center gap-1 px-2 py-1 rounded text-dark-500 dark:text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
            >
                <Home className="w-4 h-4" />
            </Link>

            {currentPath.map((item, index) => (
                <div key={item.id} className="flex items-center">
                    <ChevronRight className="w-4 h-4 text-dark-400" />
                    {index === currentPath.length - 1 ? (
                        <span className="px-2 py-1 font-medium text-dark-900 dark:text-dark-100">
                            {item.name}
                        </span>
                    ) : (
                        <Link
                            to={item.id === 'root' ? '/drive' : `/drive/${item.id}`}
                            className="px-2 py-1 rounded text-dark-600 dark:text-dark-300 hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
                        >
                            {item.name}
                        </Link>
                    )}
                </div>
            ))}
        </nav>
    );
}
