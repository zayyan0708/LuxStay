import { Clock, User, MessageSquare, ChevronRight } from 'lucide-react';
import { StatusBadge, PriorityBadge, CategoryBadge } from './StatusBadge';
import { formatDistanceToNow } from 'date-fns';

export default function TicketCard({ ticket, onClick, compact = false }) {
  const createdAgo = ticket.created_date
    ? formatDistanceToNow(new Date(ticket.created_date), { addSuffix: true })
    : 'just now';

  return (
    <div
      onClick={() => onClick?.(ticket)}
      className="group rounded-xl border border-border/50 p-4 cursor-pointer transition-all duration-200 hover:border-primary/40 hover:shadow-lg"
      style={{ background: 'hsl(var(--card))' }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-muted-foreground">
              #{ticket.ticket_number || ticket.id?.slice(-6).toUpperCase()}
            </span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs font-medium text-muted-foreground">Room {ticket.room_number}</span>
          </div>
          <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-1 group-hover:text-primary transition-colors">
            {ticket.title}
          </h3>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors flex-shrink-0 mt-0.5" />
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <StatusBadge status={ticket.status} />
        <PriorityBadge priority={ticket.priority} />
        <CategoryBadge category={ticket.category} />
      </div>

      {!compact && (
        <>
          {ticket.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
              {ticket.description}
            </p>
          )}
          {/* Footer */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{createdAgo}</span>
            </div>
            {ticket.assigned_to_name && (
              <div className="flex items-center gap-1">
                <User className="w-3 h-3" />
                <span>{ticket.assigned_to_name}</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}