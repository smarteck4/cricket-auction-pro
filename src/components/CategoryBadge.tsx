import { PlayerCategory, CATEGORY_COLORS, CATEGORY_LABELS } from '@/lib/types';
import { cn } from '@/lib/utils';

interface CategoryBadgeProps {
  category: PlayerCategory;
  className?: string;
}

export function CategoryBadge({ category, className }: CategoryBadgeProps) {
  const colors = CATEGORY_COLORS[category];
  
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        colors.bg,
        colors.text,
        colors.border,
        className
      )}
    >
      {CATEGORY_LABELS[category]}
    </span>
  );
}
