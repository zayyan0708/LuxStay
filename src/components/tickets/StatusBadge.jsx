import { cn } from '@/lib/utils';

const CONFIG = {
  OPEN:        { label: 'Open',        cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30 status-open' },
  IN_PROGRESS: { label: 'In Progress', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/30 status-inprogress' },
  RESOLVED:    { label: 'Resolved',    cls: 'bg-green-500/15 text-green-400 border-green-500/30 status-resolved' },
};

const PRIORITY = {
  low:    'bg-slate-500/15 text-slate-400 border-slate-500/30',
  medium: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  high:   'bg-orange-500/15 text-orange-400 border-orange-500/30',
  urgent: 'bg-red-500/15 text-red-400 border-red-500/30',
};

export function StatusBadge({ status }) {
  const cfg = CONFIG[status] || CONFIG.OPEN;
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border', cfg.cls)}>
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-80" />
      {cfg.label}
    </span>
  );
}

export function PriorityBadge({ priority }) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border capitalize', PRIORITY[priority] || PRIORITY.medium)}>
      {priority}
    </span>
  );
}

const CATEGORY_ICONS = {
  wifi: '📶', plumbing: '🔧', ac: '❄️', noise: '🔊',
  electricity: '⚡', housekeeping: '🧹', elevator: '🛗', other: '📋',
};

export function CategoryBadge({ category }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border border-border/50 bg-secondary text-muted-foreground capitalize">
      <span>{CATEGORY_ICONS[category] || '📋'}</span>
      {category?.replace('_', ' ')}
    </span>
  );
}