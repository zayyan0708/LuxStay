/**
 * Guest Portal — Guest role view
 * GO_API: GET /api/tickets?room={room_number} (Gateway)
 * Guests can ONLY create/view tickets for their own room.
 * Room constraint is enforced by Auth Service on the Go side.
 */
import { useState, useEffect } from 'react';
import { luxStay } from '@/api/Client';
import { useRole } from '@/lib/roleContext';
import { Plus, Hotel, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import CreateTicketModal from '@/components/tickets/CreateTicketModal';
import TicketCard from '@/components/tickets/TicketCard';
import TicketDetailModal from '@/components/tickets/TicketDetailModal';
import { StatusBadge } from '@/components/tickets/StatusBadge';
import { motion } from 'framer-motion';

export default function GuestPortal() {
  const { currentUser } = useRole();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      // GO_API: goFetch(GO_API.TICKETS.BY_ROOM(currentUser.room_number))
      // Auth Service enforces room_number matches the logged-in guest's room
      const data = await luxStay.entities.Ticket.filter({ room_number: currentUser?.room_number });
      setTickets(data.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (currentUser?.room_number) load(); }, [currentUser?.room_number]);

  // GO_API: Replace with SSE stream
  useEffect(() => {
    const unsub = luxStay.entities.Ticket.subscribe((event) => {
      if (event.data?.room_number !== currentUser?.room_number) return;
      if (event.type === 'create') setTickets(p => [event.data, ...p]);
      else if (event.type === 'update') setTickets(p => p.map(t => t.id === event.id ? event.data : t));
    });
    return unsub;
  }, [currentUser?.room_number]);

  const open = tickets.filter(t => t.status === 'OPEN').length;
  const inProgress = tickets.filter(t => t.status === 'IN_PROGRESS').length;
  const resolved = tickets.filter(t => t.status === 'RESOLVED').length;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border/50 p-6 relative overflow-hidden"
        style={{ background: 'hsl(var(--card))' }}>
        <div className="absolute inset-0 opacity-5"
          style={{ background: 'radial-gradient(circle at 70% 50%, hsl(43 74% 55%), transparent 60%)' }} />
        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'hsl(var(--primary))' }}>
              <Hotel className="w-5 h-5" style={{ color: 'hsl(222 28% 8%)' }} />
            </div>
            <div>
              <h1 className="font-heading text-xl font-bold">Welcome to SmartHotel</h1>
              <p className="text-sm text-muted-foreground">
                Room <span className="text-primary font-semibold">{currentUser?.room_number}</span> ·{' '}
                {currentUser?.name}
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Report any maintenance issues in your room and track their resolution in real time.
          </p>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
            style={{ background: 'hsl(var(--primary))', color: 'hsl(222 28% 8%)' }}>
            <Plus className="w-4 h-4" />
            Report an Issue
          </button>
        </div>
      </motion.div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Open', value: open, color: '#f59e0b', icon: AlertCircle },
          { label: 'In Progress', value: inProgress, color: '#3b82f6', icon: Clock },
          { label: 'Resolved', value: resolved, color: '#22c55e', icon: CheckCircle2 },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-border/50 p-4 text-center"
            style={{ background: 'hsl(var(--card))' }}>
            <Icon className="w-4 h-4 mx-auto mb-1" style={{ color }} />
            <p className="text-2xl font-heading font-bold" style={{ color }}>{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Tickets */}
      <div>
        <h2 className="font-heading text-base font-bold mb-3">Your Tickets</h2>
        {loading ? (
          <div className="space-y-3">
            {[1,2].map(i => <div key={i} className="h-28 rounded-xl bg-card border border-border/50 animate-pulse" />)}
          </div>
        ) : tickets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/50 p-12 text-center">
            <p className="text-sm text-muted-foreground">No maintenance tickets yet.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Tap "Report an Issue" to create your first ticket.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map(t => (
              <TicketCard key={t.id} ticket={t} onClick={setSelected} />
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateTicketModal
          onClose={() => setShowCreate(false)}
          onCreated={load}
          presetRoom={currentUser?.room_number}
        />
      )}
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