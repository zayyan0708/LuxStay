import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useRole } from '@/lib/roleContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

// GO_API: Replace base44 calls with:
//   import { goFetch, GO_API } from '@/lib/goApiConfig';
//   await goFetch(GO_API.TICKETS.CREATE, { method: 'POST', body: ticketData });
// The Gateway will persist to SQLite and publish to MQTT topic: hotel/tickets/created

const CATEGORIES = [
  { value: 'wifi', label: '📶 Wi-Fi' },
  { value: 'plumbing', label: '🔧 Plumbing' },
  { value: 'ac', label: '❄️ Air Conditioning' },
  { value: 'noise', label: '🔊 Noise Complaint' },
  { value: 'electricity', label: '⚡ Electricity' },
  { value: 'housekeeping', label: '🧹 Housekeeping' },
  { value: 'elevator', label: '🛗 Elevator' },
  { value: 'other', label: '📋 Other' },
];

export default function CreateTicketModal({ onClose, onCreated, presetRoom }) {
  const { currentUser } = useRole();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '',
    priority: 'medium',
    // GO_API: room_number is enforced by Auth Service for guest role
    room_number: presetRoom || currentUser?.room_number || '',
    guest_name: currentUser?.name || '',
    ticket_number: `TKT-${Date.now().toString().slice(-6)}`,
    status: 'OPEN',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.category || !form.title || !form.room_number) {
      toast.error('Please fill all required fields');
      return;
    }
    setLoading(true);
    try {
      // GO_API: swap with goFetch(GO_API.TICKETS.CREATE, { method:'POST', body: form })
      const created = await base44.entities.Ticket.create(form);

      // GO_API: The Go Gateway will publish this event to MQTT automatically.
      // For now we simulate it by creating an EventLog entry:
      await base44.entities.EventLog.create({
        event_type: 'ticket_created',
        mqtt_topic: 'hotel/tickets/created',
        ticket_id: created.id,
        ticket_number: form.ticket_number,
        actor: currentUser?.name,
        payload: JSON.stringify({ room: form.room_number, category: form.category }),
        service_source: 'gateway',
      });

      toast.success('Ticket created successfully');
      onCreated?.(created);
      onClose();
    } catch (err) {
      toast.error('Failed to create ticket');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-lg rounded-2xl border border-border/50 overflow-hidden"
        style={{ background: 'hsl(var(--card))' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
          <div>
            <h2 className="font-heading text-lg font-bold">New Maintenance Ticket</h2>
            {currentUser?.role === 'guest' && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Room {currentUser.room_number} · {currentUser.name}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Room Number — locked for guests */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Room Number *</Label>
              <Input value={form.room_number}
                onChange={e => set('room_number', e.target.value)}
                placeholder="101"
                disabled={currentUser?.role === 'guest'}
                className="bg-secondary border-border/50"
              />
              {currentUser?.role === 'guest' && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  {/* GO_API: room lock enforced by Auth Service */}
                  Locked to your room
                </p>
              )}
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Priority</Label>
              <Select value={form.priority} onValueChange={v => set('priority', v)}>
                <SelectTrigger className="bg-secondary border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">🚨 Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Category */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Issue Category *</Label>
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIES.map(c => (
                <button key={c.value} type="button"
                  onClick={() => set('category', c.value)}
                  className={`p-2.5 rounded-xl border text-xs flex flex-col items-center gap-1 transition-all ${
                    form.category === c.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border/50 bg-secondary text-muted-foreground hover:border-border hover:text-foreground'
                  }`}>
                  <span className="text-lg">{c.label.split(' ')[0]}</span>
                  <span>{c.label.split(' ').slice(1).join(' ')}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Title *</Label>
            <Input value={form.title} onChange={e => set('title', e.target.value)}
              placeholder="Brief description of the issue"
              className="bg-secondary border-border/50" />
          </div>

          {/* Description */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Details</Label>
            <Textarea value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="Provide more details about the maintenance issue..."
              rows={3} className="bg-secondary border-border/50 resize-none" />
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 border-border/50">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1 font-semibold"
              style={{ background: 'hsl(var(--primary))', color: 'hsl(222 28% 8%)' }}>
              {loading ? 'Creating...' : 'Submit Ticket'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}