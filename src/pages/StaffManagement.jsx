/**
 * Staff Management — Admin only
 * GO_API: GET/POST/PUT /api/staff (Gateway Service)
 */
import { useState, useEffect } from 'react';
import { luxStay } from '@/api/Client';
import { Plus, X, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const SPECIALTIES = ['electrical', 'plumbing', 'hvac', 'general', 'housekeeping', 'it'];

const STATUS_CFG = {
  available:  { cls: 'bg-green-500/15 text-green-400 border-green-500/30', label: 'Available' },
  busy:       { cls: 'bg-orange-500/15 text-orange-400 border-orange-500/30', label: 'Busy' },
  off_duty:   { cls: 'bg-slate-500/15 text-slate-400 border-slate-500/30', label: 'Off Duty' },
};

function StaffForm({ onSave, onCancel }) {
  const [form, setForm] = useState({ name: '', employee_id: '', specialty: '', status: 'available' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.specialty) { toast.error('Name and specialty required'); return; }
    setSaving(true);
    try {
      // GO_API: goFetch(GO_API.STAFF.CREATE, { method:'POST', body: form })
      await luxStay.entities.StaffMember.create({ ...form, active_tickets: 0 });
      toast.success('Staff member added');
      onSave();
    } catch { toast.error('Failed to add staff'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-md rounded-2xl border border-border/50 p-6"
        style={{ background: 'hsl(var(--card))' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-heading text-lg font-bold">Add Staff Member</h2>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-secondary"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Full Name *</Label>
            <Input value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="e.g. John Smith" className="bg-secondary border-border/50" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Employee ID</Label>
            <Input value={form.employee_id} onChange={e => set('employee_id', e.target.value)}
              placeholder="e.g. EMP-001" className="bg-secondary border-border/50" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Specialty *</Label>
            <Select value={form.specialty} onValueChange={v => set('specialty', v)}>
              <SelectTrigger className="bg-secondary border-border/50"><SelectValue placeholder="Select specialty" /></SelectTrigger>
              <SelectContent>
                {SPECIALTIES.map(s => (
                  <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onCancel} className="flex-1 border-border/50">Cancel</Button>
            <Button type="submit" disabled={saving} className="flex-1"
              style={{ background: 'hsl(var(--primary))', color: 'hsl(222 28% 8%)' }}>
              {saving ? 'Saving...' : 'Add Staff'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function StaffManagement() {
  const [staff, setStaff] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [s, t] = await Promise.all([
      // GO_API: goFetch(GO_API.STAFF.LIST), goFetch(GO_API.TICKETS.LIST)
      luxStay.entities.StaffMember.list(),
      luxStay.entities.Ticket.list(),
    ]);
    setStaff(s);
    setTickets(t);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (staffId, newStatus) => {
    // GO_API: goFetch(GO_API.STAFF.UPDATE(staffId), { method:'PUT', body:{ status: newStatus } })
    await luxStay.entities.StaffMember.update(staffId, { status: newStatus });
    setStaff(p => p.map(s => s.id === staffId ? { ...s, status: newStatus } : s));
    toast.success('Status updated');
  };

  const deleteStaff = async (staffId) => {
    await luxStay.entities.StaffMember.delete(staffId);
    setStaff(p => p.filter(s => s.id !== staffId));
    toast.success('Staff member removed');
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Staff Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{staff.length} team members</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
          style={{ background: 'hsl(var(--primary))', color: 'hsl(222 28% 8%)' }}>
          <Plus className="w-4 h-4" /> Add Staff
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-40 rounded-xl bg-card border border-border/50 animate-pulse" />)}
        </div>
      ) : staff.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/50 p-16 text-center">
          <Wrench className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No staff members yet.</p>
          <button onClick={() => setShowForm(true)} className="mt-3 text-primary text-sm hover:underline">
            Add your first staff member
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {staff.map(s => {
            const activeTickets = tickets.filter(t => t.assigned_to_id === s.id && t.status !== 'RESOLVED');
            const resolved = tickets.filter(t => t.assigned_to_id === s.id && t.status === 'RESOLVED').length;
            const sc = STATUS_CFG[s.status] || STATUS_CFG.available;
            return (
              <div key={s.id} className="rounded-xl border border-border/50 p-5"
                style={{ background: 'hsl(var(--card))' }}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                      style={{ background: 'hsl(var(--primary))', color: 'hsl(222 28% 8%)' }}>
                      {s.name[0]}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{s.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{s.specialty}</p>
                      {s.employee_id && <p className="text-[10px] text-muted-foreground/60">{s.employee_id}</p>}
                    </div>
                  </div>
                  <button onClick={() => deleteStaff(s.id)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex gap-2 mb-4">
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${sc.cls}`}>
                    {sc.label}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-4 text-center">
                  <div className="rounded-lg p-2" style={{ background: 'hsl(var(--secondary))' }}>
                    <p className="text-lg font-heading font-bold text-blue-400">{activeTickets.length}</p>
                    <p className="text-[10px] text-muted-foreground">Active</p>
                  </div>
                  <div className="rounded-lg p-2" style={{ background: 'hsl(var(--secondary))' }}>
                    <p className="text-lg font-heading font-bold text-green-400">{resolved}</p>
                    <p className="text-[10px] text-muted-foreground">Resolved</p>
                  </div>
                </div>

                <Select value={s.status} onValueChange={v => updateStatus(s.id, v)}>
                  <SelectTrigger className="h-7 text-xs bg-secondary border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="busy">Busy</SelectItem>
                    <SelectItem value="off_duty">Off Duty</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
      )}

      {showForm && <StaffForm onSave={() => { setShowForm(false); load(); }} onCancel={() => setShowForm(false)} />}
    </div>
  );
}