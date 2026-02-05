import { X } from 'lucide-react';

interface Tag {
    id: string;
    name: string;
    color: string;
}

interface TagBadgeProps {
    tag: Tag;
    onRemove?: () => void;
    onClick?: () => void;
    size?: 'sm' | 'md';
}

export default function TagBadge({ tag, onRemove, onClick, size = 'sm' }: TagBadgeProps) {
    const sizeClasses = {
        sm: 'text-xs px-2 py-0.5',
        md: 'text-sm px-3 py-1',
    };

    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full font-medium ${sizeClasses[size]} ${onClick ? 'cursor-pointer hover:opacity-80' : ''
                }`}
            style={{
                backgroundColor: `${tag.color}20`,
                color: tag.color,
                border: `1px solid ${tag.color}40`,
            }}
            onClick={onClick}
        >
            {tag.name}
            {onRemove && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove();
                    }}
                    className="hover:bg-black/10 dark:hover:bg-white/10 rounded-full p-0.5"
                >
                    <X className="w-3 h-3" />
                </button>
            )}
        </span>
    );
}
