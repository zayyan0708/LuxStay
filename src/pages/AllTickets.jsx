/**
 * All Tickets — Admin view
 * GO_API: GET /api/tickets (Gateway Service)
 * Filters map to query params: ?status=OPEN&priority=urgent&room=101
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Search, Filter, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import CreateTicketModal from '@/components/tickets/CreateTicketModal';
import TicketCard from '@/components/tickets/TicketCard';
import TicketDetailModal from '@/components/tickets/TicketDetailModal';
import { toast } from 'sonner';

export default function AllTickets() {
  const [tickets, setTickets] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      // GO_API: goFetch(GO_API.TICKETS.LIST) + goFetch(GO_API.STAFF.LIST)
      const [t, s] = await Promise.all([
        base44.entities.Ticket.list('-created_date', 100),
        base44.entities.StaffMember.list(),
      ]);
      setTickets(t);
      setStaff(s);
    } catch {
      toast.error('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // GO_API: Replace with SSE stream from Gateway
  useEffect(() => {
    const unsub = base44.entities.Ticket.subscribe((event) => {
      if (event.type === 'create') setTickets(p => [event.data, ...p]);
      else if (event.type === 'update') setTickets(p => p.map(t => t.id === event.id ? event.data : t));
      else if (event.type === 'delete') setTickets(p => p.filter(t => t.id !== event.id));
    });
    return unsub;
  }, []);

  const filtered = tickets.filter(t => {
    const q = search.toLowerCase();
    const matchSearch = !q || t.title?.toLowerCase().includes(q) ||
      t.room_number?.includes(q) || t.ticket_number?.toLowerCase().includes(q) ||
      t.guest_name?.toLowerCase().includes(q);
    const matchStatus = filterStatus === 'all' || t.status === filterStatus;
    const matchPriority = filterPriority === 'all' || t.priority === filterPriority;
    const matchCategory = filterCategory === 'all' || t.category === filterCategory;
    return matchSearch && matchStatus && matchPriority && matchCategory;
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">All Tickets</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} of {tickets.length} tickets
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load}
            className="p-2.5 rounded-xl border border-border/50 hover:bg-secondary transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
            style={{ background: 'hsl(var(--primary))', color: 'hsl(222 28% 8%)' }}>
            <Plus className="w-4 h-4" />
            New Ticket
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by title, room, ticket #..."
            className="pl-9 bg-secondary border-border/50 h-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 bg-secondary border-border/50 h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="OPEN">Open</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="RESOLVED">Resolved</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-36 bg-secondary border-border/50 h-9">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-40 bg-secondary border-border/50 h-9">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="wifi">Wi-Fi</SelectItem>
            <SelectItem value="plumbing">Plumbing</SelectItem>
            <SelectItem value="ac">AC</SelectItem>
            <SelectItem value="noise">Noise</SelectItem>
            <SelectItem value="electricity">Electricity</SelectItem>
            <SelectItem value="housekeeping">Housekeeping</SelectItem>
            <SelectItem value="elevator">Elevator</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tickets Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-36 rounded-xl bg-card border border-border/50 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/50 p-16 text-center">
          <p className="text-muted-foreground">No tickets match your filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(t => (
            <TicketCard key={t.id} ticket={t} onClick={setSelected} />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateTicketModal onClose={() => setShowCreate(false)} onCreated={load} />
      )}
      {selected && (
        <TicketDetailModal
          ticket={selected} onClose={() => setSelected(null)}
          onUpdated={(u) => { setTickets(p => p.map(t => t.id === u.id ? u : t)); setSelected(u); }}
          staffList={staff}
        />
      )}
    </div>
  );
}