import { useState, useEffect } from 'react';
import { X, Send, User, Clock, ArrowRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useRole } from '@/lib/roleContext';
import { StatusBadge, PriorityBadge, CategoryBadge } from './StatusBadge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

// GO_API: Replace all base44 calls with goFetch():
//   PATCH GO_API.TICKETS.ASSIGN(id)  { staff_id, staff_name }
//   PATCH GO_API.TICKETS.STATUS(id)  { status }
//   GET/POST GO_API.CHAT.MESSAGES(id) / GO_API.CHAT.SEND(id)
// All mutations auto-publish to MQTT topics in the Go Gateway.

export default function TicketDetailModal({ ticket, onClose, onUpdated, staffList }) {
  const { currentUser } = useRole();
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);

  const isAdmin = currentUser?.role === 'admin';
  const isStaff = currentUser?.role === 'staff';
  const canChat = isAdmin || isStaff;

  // GO_API: Replace with goFetch(GO_API.CHAT.MESSAGES(ticket.id))
  useEffect(() => {
    if (!ticket?.id) return;
    base44.entities.ChatMessage.filter({ ticket_id: ticket.id })
      .then(setMessages).catch(() => {});

    // GO_API: Replace with connectGoSSE + listen for chat_message events for this ticket
    const unsub = base44.entities.ChatMessage.subscribe((event) => {
      if (event.data?.ticket_id === ticket.id) {
        setMessages(prev =>
          event.type === 'create' ? [...prev, event.data] : prev
        );
      }
    });
    return unsub;
  }, [ticket?.id]);

  const sendMessage = async () => {
    if (!chatInput.trim()) return;
    setSending(true);
    try {
      // GO_API: swap with goFetch(GO_API.CHAT.SEND(ticket.id), { method:'POST', body:{ content: chatInput } })
      await base44.entities.ChatMessage.create({
        ticket_id: ticket.id,
        sender_name: currentUser?.name,
        sender_role: currentUser?.role,
        content: chatInput,
      });
      // GO_API: Gateway publishes to MQTT topic: hotel/chat/{ticketId}
      await base44.entities.EventLog.create({
        event_type: 'chat_message',
        mqtt_topic: `hotel/chat/${ticket.id}`,
        ticket_id: ticket.id,
        ticket_number: ticket.ticket_number,
        actor: currentUser?.name,
        payload: chatInput.slice(0, 80),
        service_source: 'gateway',
      });
      setChatInput('');
    } catch {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const updateStatus = async (newStatus) => {
    setUpdating(true);
    try {
      // GO_API: swap with goFetch(GO_API.TICKETS.STATUS(ticket.id), { method:'PATCH', body:{ status: newStatus } })
      const updated = await base44.entities.Ticket.update(ticket.id, {
        status: newStatus,
        ...(newStatus === 'RESOLVED' ? { resolved_at: new Date().toISOString() } : {}),
      });
      await base44.entities.EventLog.create({
        event_type: 'status_updated',
        mqtt_topic: 'hotel/tickets/status_updated',
        ticket_id: ticket.id,
        ticket_number: ticket.ticket_number,
        actor: currentUser?.name,
        payload: JSON.stringify({ from: ticket.status, to: newStatus }),
        service_source: 'gateway',
      });
      toast.success(`Status updated to ${newStatus}`);
      onUpdated?.(updated);
    } catch {
      toast.error('Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const assignStaff = async (staffId) => {
    const staff = staffList?.find(s => s.id === staffId);
    if (!staff) return;
    setUpdating(true);
    try {
      // GO_API: swap with goFetch(GO_API.TICKETS.ASSIGN(ticket.id), { method:'PATCH', body:{ staff_id: staffId, staff_name: staff.name } })
      const updated = await base44.entities.Ticket.update(ticket.id, {
        assigned_to_id: staffId,
        assigned_to_name: staff.name,
        status: ticket.status === 'OPEN' ? 'IN_PROGRESS' : ticket.status,
      });
      await base44.entities.EventLog.create({
        event_type: 'ticket_assigned',
        mqtt_topic: 'hotel/tickets/assigned',
        ticket_id: ticket.id,
        ticket_number: ticket.ticket_number,
        actor: currentUser?.name,
        payload: JSON.stringify({ assigned_to: staff.name }),
        service_source: 'gateway',
      });
      toast.success(`Assigned to ${staff.name}`);
      onUpdated?.(updated);
    } catch {
      toast.error('Failed to assign ticket');
    } finally {
      setUpdating(false);
    }
  };

  if (!ticket) return null;

  const STATUS_FLOW = ['OPEN', 'IN_PROGRESS', 'RESOLVED'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-2xl rounded-2xl border border-border/50 flex flex-col max-h-[90vh]"
        style={{ background: 'hsl(var(--card))' }}>

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-border/50 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-muted-foreground">
                #{ticket.ticket_number || ticket.id?.slice(-6).toUpperCase()}
              </span>
              <span className="text-xs text-muted-foreground">· Room {ticket.room_number}</span>
            </div>
            <h2 className="font-heading text-lg font-bold">{ticket.title}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary transition-colors mt-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: Ticket Info */}
          <div className="w-64 flex-shrink-0 border-r border-border/50 p-4 overflow-y-auto space-y-4">
            <div className="flex flex-wrap gap-1.5">
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
              <CategoryBadge category={ticket.category} />
            </div>

            {ticket.description && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Description</p>
                <p className="text-sm">{ticket.description}</p>
              </div>
            )}

            {/* Assignee */}
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Assigned To</p>
              {isAdmin && staffList?.length > 0 ? (
                // GO_API: calls PATCH /api/tickets/:id/assign
                <Select value={ticket.assigned_to_id || ''} onValueChange={assignStaff} disabled={updating}>
                  <SelectTrigger className="bg-secondary border-border/50 h-8 text-xs">
                    <SelectValue placeholder="Assign staff..." />
                  </SelectTrigger>
                  <SelectContent>
                    {staffList.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} · {s.specialty}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm">{ticket.assigned_to_name || <span className="text-muted-foreground">Unassigned</span>}</p>
              )}
            </div>

            {/* Status progression */}
            {(isAdmin || isStaff) && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Update Status</p>
                <div className="space-y-1.5">
                  {STATUS_FLOW.map((s, i) => {
                    const current = STATUS_FLOW.indexOf(ticket.status);
                    const isNext = i === current + 1;
                    const isDone = i <= current;
                    return (
                      <button key={s} onClick={() => isNext && updateStatus(s)}
                        disabled={!isNext || updating}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                          isDone ? 'border-primary/30 bg-primary/10 text-primary' :
                          isNext ? 'border-border hover:border-primary/50 hover:bg-primary/5 text-foreground cursor-pointer' :
                          'border-border/30 text-muted-foreground/40 cursor-not-allowed'
                        }`}>
                        <span className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] ${
                          isDone ? 'bg-primary text-primary-foreground' : 'bg-secondary'
                        }`}>{i + 1}</span>
                        {s.replace('_', ' ')}
                        {isNext && <ArrowRight className="w-3 h-3 ml-auto" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <p className="text-xs text-muted-foreground mb-1">Guest</p>
              <p className="text-sm">{ticket.guest_name || 'Guest'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Created</p>
              <p className="text-sm">
                {ticket.created_date
                  ? formatDistanceToNow(new Date(ticket.created_date), { addSuffix: true })
                  : '—'}
              </p>
            </div>
          </div>

          {/* Right: Chat */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-border/30 flex-shrink-0">
              <p className="text-xs font-medium text-muted-foreground">
                {/* GO_API: Chat is backed by MQTT topic hotel/chat/{ticketId} */}
                Ticket Chat · Admin ↔ Staff
              </p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-xs text-muted-foreground">No messages yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Chat is admin & staff only</p>
                </div>
              ) : (
                messages.map(msg => {
                  const isMe = msg.sender_name === currentUser?.name;
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-xl px-3 py-2 ${
                        isMe
                          ? 'bg-primary/20 border border-primary/30'
                          : 'bg-secondary border border-border/30'
                      }`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[10px] font-medium text-muted-foreground capitalize">
                            {msg.sender_name}
                          </span>
                          <span className="text-[10px] text-muted-foreground/50 capitalize">
                            ({msg.sender_role})
                          </span>
                        </div>
                        <p className="text-xs text-foreground">{msg.content}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input */}
            {canChat ? (
              <div className="p-3 border-t border-border/30 flex gap-2 flex-shrink-0">
                <Input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder="Type a message..."
                  className="bg-secondary border-border/50 text-xs h-8"
                />
                <Button size="sm" onClick={sendMessage} disabled={sending || !chatInput.trim()}
                  style={{ background: 'hsl(var(--primary))', color: 'hsl(222 28% 8%)' }}
                  className="h-8 px-3 flex-shrink-0">
                  <Send className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <div className="p-3 border-t border-border/30">
                <p className="text-xs text-muted-foreground text-center">
                  Chat is available for admin & staff only
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}