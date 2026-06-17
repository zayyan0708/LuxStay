/**
 * Admin Dashboard
 * GO_API integration points:
 *   - Tickets: GET /api/tickets (Gateway)
 *   - Staff:   GET /api/staff   (Gateway)
 *   - Events:  EventSource GET /api/events/stream (Gateway SSE → MQTT bridge)
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useRole } from '@/lib/roleContext';
import { Plus, TrendingUp, Clock, CheckCircle2, AlertCircle, Users, Zap } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import CreateTicketModal from '@/components/tickets/CreateTicketModal';
import TicketCard from '@/components/tickets/TicketCard';
import TicketDetailModal from '@/components/tickets/TicketDetailModal';
import { motion } from 'framer-motion';

// GO_API: import { goFetch, GO_API } from '@/lib/goApiConfig';
// Replace base44 calls:
//   base44.entities.Ticket.list() → goFetch(GO_API.TICKETS.LIST)
//   base44.entities.StaffMember.list() → goFetch(GO_API.STAFF.LIST)

function StatCard({ label, value, icon: Icon, color, sub }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border/50 p-5"
      style={{ background: 'hsl(var(--card))' }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground mb-1">{label}</p>
          <p className="text-3xl font-heading font-bold" style={{ color }}>{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: `${color}18` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
    </motion.div>
  );
}

const STATUS_COLORS = {
  OPEN: '#f59e0b',
  IN_PROGRESS: '#3b82f6',
  RESOLVED: '#22c55e',
};

export default function AdminDashboard() {
  const { currentUser } = useRole();
  const [tickets, setTickets] = useState([]);
  const [staff, setStaff] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    // GO_API: replace with goFetch(GO_API.TICKETS.LIST) and goFetch(GO_API.STAFF.LIST)
    const [t, s] = await Promise.all([
      base44.entities.Ticket.list('-created_date', 50),
      base44.entities.StaffMember.list(),
    ]);
    setTickets(t);
    setStaff(s);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  // GO_API: Replace with connectGoSSE() from goApiConfig for real MQTT → SSE events
  useEffect(() => {
    const unsub = base44.entities.Ticket.subscribe((event) => {
      if (event.type === 'create') setTickets(p => [event.data, ...p]);
      else if (event.type === 'update') setTickets(p => p.map(t => t.id === event.id ? event.data : t));
      else if (event.type === 'delete') setTickets(p => p.filter(t => t.id !== event.id));
    });
    return unsub;
  }, []);

  const stats = {
    open: tickets.filter(t => t.status === 'OPEN').length,
    inprogress: tickets.filter(t => t.status === 'IN_PROGRESS').length,
    resolved: tickets.filter(t => t.status === 'RESOLVED').length,
    urgent: tickets.filter(t => t.priority === 'urgent').length,
  };

  const pieData = Object.entries(STATUS_COLORS).map(([key, color]) => ({
    name: key.replace('_', ' '),
    value: tickets.filter(t => t.status === key).length,
    color,
  })).filter(d => d.value > 0);

  const categoryData = ['wifi', 'plumbing', 'ac', 'noise', 'electricity', 'housekeeping', 'elevator', 'other']
    .map(cat => ({ name: cat, count: tickets.filter(t => t.category === cat).length }))
    .filter(d => d.count > 0)
    .sort((a, b) => b.count - a.count);

  const recentTickets = tickets.slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold gold-shimmer">Operations Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            SmartHotel · Admin Control Center
          </p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
          style={{ background: 'hsl(var(--primary))', color: 'hsl(222 28% 8%)' }}>
          <Plus className="w-4 h-4" />
          New Ticket
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Open Tickets"       value={stats.open}       icon={AlertCircle}  color="#f59e0b" sub={`${tickets.length} total`} />
        <StatCard label="In Progress"         value={stats.inprogress} icon={Clock}         color="#3b82f6" sub="being handled" />
        <StatCard label="Resolved"            value={stats.resolved}   icon={CheckCircle2}  color="#22c55e" sub="completed" />
        <StatCard label="Urgent Issues"       value={stats.urgent}     icon={Zap}           color="#ef4444" sub="need attention" />
      </div>

      {/* Charts + Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Status Pie */}
        <div className="rounded-xl border border-border/50 p-5" style={{ background: 'hsl(var(--card))' }}>
          <h3 className="font-heading text-sm font-semibold mb-4">Status Overview</h3>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65}
                    dataKey="value" paddingAngle={3}>
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} opacity={0.85} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {pieData.map(d => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                      <span className="text-muted-foreground capitalize">{d.name}</span>
                    </div>
                    <span className="font-medium">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
              No tickets yet
            </div>
          )}
        </div>

        {/* Category Bar */}
        <div className="rounded-xl border border-border/50 p-5" style={{ background: 'hsl(var(--card))' }}>
          <h3 className="font-heading text-sm font-semibold mb-4">Issues by Category</h3>
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={categoryData} layout="vertical">
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 10, fill: '#8b8b8b' }} />
                <Tooltip
                  contentStyle={{ background: 'hsl(222 24% 11%)', border: '1px solid hsl(222 18% 18%)', borderRadius: '8px', fontSize: '12px' }}
                  labelStyle={{ color: '#e5dcc8' }}
                  itemStyle={{ color: '#c9a84c' }}
                />
                <Bar dataKey="count" fill="hsl(43 74% 55%)" radius={[0, 4, 4, 0]} opacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
              No data yet
            </div>
          )}
        </div>

        {/* Staff Overview */}
        <div className="rounded-xl border border-border/50 p-5" style={{ background: 'hsl(var(--card))' }}>
          <h3 className="font-heading text-sm font-semibold mb-4">
            Staff · {staff.length} members
          </h3>
          <div className="space-y-2">
            {staff.slice(0, 5).map(s => {
              const assigned = tickets.filter(t => t.assigned_to_id === s.id && t.status !== 'RESOLVED').length;
              return (
                <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/50">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: 'hsl(var(--primary))', color: 'hsl(222 28% 8%)' }}>
                    {s.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{s.name}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">{s.specialty}</p>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    assigned > 0 ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'
                  }`}>
                    {assigned > 0 ? `${assigned} active` : 'free'}
                  </span>
                </div>
              );
            })}
            {staff.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No staff added yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Tickets */}
      <div>
        <h3 className="font-heading text-sm font-semibold mb-3">Recent Tickets</h3>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1,2,3].map(i => (
              <div key={i} className="h-32 rounded-xl bg-card border border-border/50 animate-pulse" />
            ))}
          </div>
        ) : recentTickets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/50 p-12 text-center">
            <p className="text-muted-foreground text-sm">No tickets yet. Create the first one!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentTickets.map(t => (
              <TicketCard key={t.id} ticket={t}
                onClick={setSelected}
                staffList={staff}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreate && (
        <CreateTicketModal
          onClose={() => setShowCreate(false)}
          onCreated={() => loadData()}
        />
      )}
      {selected && (
        <TicketDetailModal
          ticket={selected}
          onClose={() => setSelected(null)}
          onUpdated={(updated) => {
            setTickets(p => p.map(t => t.id === updated.id ? updated : t));
            setSelected(updated);
          }}
          staffList={staff}
        />
      )}
    </div>
  );
}