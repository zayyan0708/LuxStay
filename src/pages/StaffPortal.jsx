/**
 * Staff Portal — Staff role view
 * GO_API: GET /api/tickets?assigned_to={staffId}  (Gateway Service)
 * Staff can only see tickets assigned to them.
 * Status flow: OPEN → IN_PROGRESS → RESOLVED
 * GO_API: PATCH /api/tickets/:id/status  { status }
 */
import { useState, useEffect } from 'react';
import { luxStay } from '@/api/Client';
import { useRole } from '@/lib/roleContext';
import { Wrench, Clock, CheckCircle2, ArrowRight, RefreshCw } from 'lucide-react';
import { StatusBadge, PriorityBadge, CategoryBadge } from '@/components/tickets/StatusBadge';
import TicketDetailModal from '@/components/tickets/TicketDetailModal';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';

export default function StaffPortal() {
  const { currentUser } = useRole();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [updating, setUpdating] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      // GO_API: goFetch(GO_API.TICKETS.BY_STAFF(currentUser.id))
      // Staff only sees assigned tickets — enforced at Gateway level
      const all = await luxStay.entities.Ticket.filter({ assigned_to_id: currentUser?.id });
      setTickets(all);
    } catch {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (currentUser?.id) load(); }, [currentUser?.id]);

  // GO_API: Replace with SSE stream
  useEffect(() => {
    const unsub = luxStay.entities.Ticket.subscribe((event) => {
      if (event.type === 'update' && event.data?.assigned_to_id === currentUser?.id) {
        setTickets(p => p.map(t => t.id === event.id ? event.data : t));
      }
      if (event.type === 'create' && event.data?.assigned_to_id === currentUser?.id) {
        setTickets(p => [event.data, ...p]);
      }
    });
    return unsub;
  }, [currentUser?.id]);

  const advanceStatus = async (ticket) => {
    const next = { OPEN: 'IN_PROGRESS', IN_PROGRESS: 'RESOLVED' }[ticket.status];
    if (!next) return;
    setUpdating(ticket.id);
    try {
      // GO_API: goFetch(GO_API.TICKETS.STATUS(ticket.id), { method:'PATCH', body:{ status: next } })
      const updated = await luxStay.entities.Ticket.update(ticket.id, {
        status: next,
        ...(next === 'RESOLVED' ? { resolved_at: new Date().toISOString() } : {}),
      });
      await luxStay.entities.EventLog.create({
        event_type: 'status_updated',
        mqtt_topic: 'hotel/tickets/status_updated',
        ticket_id: ticket.id,
        ticket_number: ticket.ticket_number,
        actor: currentUser?.name,
        payload: JSON.stringify({ from: ticket.status, to: next }),
        service_source: 'gateway',
      });
      setTickets(p => p.map(t => t.id === updated.id ? updated : t));
      toast.success(`Ticket moved to ${next.replace('_', ' ')}`);
    } catch {
      toast.error('Failed to update status');
    } finally {
      setUpdating(null);
    }
  };

  const LANES = [
    { key: 'OPEN',        label: 'To Do',      color: '#f59e0b', icon: Clock },
    { key: 'IN_PROGRESS', label: 'In Progress', color: '#3b82f6', icon: Wrench },
    { key: 'RESOLVED',    label: 'Resolved',    color: '#22c55e', icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">My Tasks</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {currentUser?.name} · {tickets.length} assigned tickets
          </p>
        </div>
        <button onClick={load}
          className="p-2.5 rounded-xl border border-border/50 hover:bg-secondary transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Kanban lanes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {LANES.map(lane => {
          const laneTickets = tickets.filter(t => t.status === lane.key);
          const Icon = lane.icon;
          return (
            <div key={lane.key} className="rounded-xl border border-border/50 overflow-hidden"
              style={{ background: 'hsl(var(--card))' }}>
              <div className="px-4 py-3 border-b border-border/30 flex items-center gap-2"
                style={{ borderTop: `3px solid ${lane.color}` }}>
                <Icon className="w-4 h-4" style={{ color: lane.color }} />
                <span className="text-sm font-semibold">{lane.label}</span>
                <span className="ml-auto w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{ background: `${lane.color}20`, color: lane.color }}>
                  {laneTickets.length}
                </span>
              </div>

              <div className="p-3 space-y-2 min-h-32">
                {loading ? (
                  [...Array(2)].map((_, i) => (
                    <div key={i} className="h-20 rounded-lg bg-secondary/50 animate-pulse" />
                  ))
                ) : laneTickets.length === 0 ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">Empty</div>
                ) : (
                  laneTickets.map(ticket => (
                    <motion.div key={ticket.id}
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="rounded-lg border border-border/40 p-3 cursor-pointer hover:border-primary/30 transition-all"
                      style={{ background: 'hsl(222 20% 13%)' }}>
                      <div onClick={() => setSelected(ticket)}>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="text-[10px] font-mono text-muted-foreground">
                            #{ticket.ticket_number || ticket.id?.slice(-6).toUpperCase()}
                          </span>
                          <PriorityBadge priority={ticket.priority} />
                        </div>
                        <p className="text-xs font-semibold mb-1.5 line-clamp-2">{ticket.title}</p>
                        <div className="flex items-center gap-1.5 mb-2">
                          <CategoryBadge category={ticket.category} />
                          <span className="text-[10px] text-muted-foreground">R.{ticket.room_number}</span>
                        </div>
                        {ticket.created_date && (
                          <p className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(ticket.created_date), { addSuffix: true })}
                          </p>
                        )}
                      </div>

                      {/* Advance button */}
                      {lane.key !== 'RESOLVED' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); advanceStatus(ticket); }}
                          disabled={updating === ticket.id}
                          className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] font-semibold border transition-all hover:opacity-80"
                          style={{ borderColor: lane.color, color: lane.color, background: `${lane.color}10` }}>
                          {updating === ticket.id ? 'Updating...' : (
                            <>
                              {lane.key === 'OPEN' ? 'Start Work' : 'Mark Resolved'}
                              <ArrowRight className="w-3 h-3" />
                            </>
                          )}
                        </button>
                      )}
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selected && (
        <TicketDetailModal
          ticket={selected}
          onClose={() => setSelected(null)}
          onUpdated={(u) => { setTickets(p => p.map(t => t.id === u.id ? u : t)); setSelected(u); }}
          staffList={[]}
        />
      )}
    </div>
  );
}