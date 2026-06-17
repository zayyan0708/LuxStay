/**
 * Chat Hub — Admin ↔ Staff ticket chat
 * GO_API:
 *   GET  /api/tickets/:id/chat    → ChatMessage[]
 *   POST /api/tickets/:id/chat    → send message
 *   Gateway publishes to MQTT: hotel/chat/{ticketId}
 *   Real-time: SSE stream pushes chat_message events to browser
 */
import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useRole } from '@/lib/roleContext';
import { Send, MessageSquare, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StatusBadge, CategoryBadge } from '@/components/tickets/StatusBadge';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

export default function ChatHub() {
  const { currentUser } = useRole();
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const bottomRef = useRef(null);

  // Load tickets (admin sees all, staff sees assigned)
  useEffect(() => {
    const load = async () => {
      // GO_API: admin → goFetch(GO_API.TICKETS.LIST), staff → goFetch(GO_API.TICKETS.BY_STAFF(id))
      const data = currentUser?.role === 'admin'
        ? await base44.entities.Ticket.list('-updated_date', 50)
        : await base44.entities.Ticket.filter({ assigned_to_id: currentUser?.id });
      setTickets(data);
      if (data.length > 0 && !selectedTicket) setSelectedTicket(data[0]);
    };
    load();
  }, [currentUser?.id]);

  // Load messages for selected ticket
  useEffect(() => {
    if (!selectedTicket?.id) return;
    // GO_API: goFetch(GO_API.CHAT.MESSAGES(selectedTicket.id))
    base44.entities.ChatMessage.filter({ ticket_id: selectedTicket.id })
      .then(msgs => setMessages(msgs.sort((a, b) => new Date(a.created_date) - new Date(b.created_date))))
      .catch(() => {});

    // GO_API: replace with connectGoSSE() listening for chat_message events
    const unsub = base44.entities.ChatMessage.subscribe((event) => {
      if (event.data?.ticket_id === selectedTicket.id && event.type === 'create') {
        setMessages(p => [...p, event.data]);
      }
    });
    return unsub;
  }, [selectedTicket?.id]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || !selectedTicket) return;
    setSending(true);
    try {
      // GO_API: goFetch(GO_API.CHAT.SEND(selectedTicket.id), { method:'POST', body:{ content: input } })
      // Gateway will save and publish to MQTT: hotel/chat/{ticketId}
      await base44.entities.ChatMessage.create({
        ticket_id: selectedTicket.id,
        sender_name: currentUser?.name,
        sender_role: currentUser?.role,
        content: input,
      });
      // Simulate MQTT event log
      await base44.entities.EventLog.create({
        event_type: 'chat_message',
        mqtt_topic: `hotel/chat/${selectedTicket.id}`,
        ticket_id: selectedTicket.id,
        ticket_number: selectedTicket.ticket_number,
        actor: currentUser?.name,
        payload: input.slice(0, 60),
        service_source: 'gateway',
      });
      setInput('');
    } catch {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const filteredTickets = tickets.filter(t =>
    !search || t.title?.toLowerCase().includes(search.toLowerCase()) ||
    t.room_number?.includes(search)
  );

  return (
    <div className="h-[calc(100vh-8rem)] flex rounded-2xl border border-border/50 overflow-hidden"
      style={{ background: 'hsl(var(--card))' }}>

      {/* Left: Ticket list */}
      <div className="w-72 flex-shrink-0 border-r border-border/30 flex flex-col">
        <div className="p-3 border-b border-border/30">
          <p className="font-heading text-sm font-bold mb-2">Ticket Chat</p>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search tickets..."
              className="pl-8 h-7 text-xs bg-secondary border-border/50" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border/20">
          {filteredTickets.map(t => {
            const isActive = selectedTicket?.id === t.id;
            return (
              <button key={t.id} onClick={() => setSelectedTicket(t)}
                className={`w-full text-left p-3 transition-all hover:bg-secondary/50 ${
                  isActive ? 'bg-secondary' : ''
                }`}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold truncate ${isActive ? 'text-primary' : ''}`}>
                      {t.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[10px] text-muted-foreground">R.{t.room_number}</span>
                      <StatusBadge status={t.status} />
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
          {filteredTickets.length === 0 && (
            <div className="p-6 text-center text-xs text-muted-foreground">
              {tickets.length === 0 ? 'No tickets available' : 'No matches'}
            </div>
          )}
        </div>
      </div>

      {/* Right: Chat pane */}
      {selectedTicket ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Chat header */}
          <div className="px-5 py-3.5 border-b border-border/30 flex-shrink-0"
            style={{ background: 'hsl(222 24% 10%)' }}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{selectedTicket.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">Room {selectedTicket.room_number}</span>
                  <StatusBadge status={selectedTicket.status} />
                  <CategoryBadge category={selectedTicket.category} />
                </div>
              </div>
              <span className="text-xs font-mono text-muted-foreground">
                #{selectedTicket.ticket_number || selectedTicket.id?.slice(-6).toUpperCase()}
              </span>
            </div>
            {selectedTicket.assigned_to_name && (
              <p className="text-xs text-muted-foreground mt-1">
                Assigned to: <span className="text-foreground">{selectedTicket.assigned_to_name}</span>
                {/* GO_API: Chat MQTT topic: hotel/chat/{selectedTicket.id} */}
              </p>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No messages yet</p>
                  <p className="text-xs text-muted-foreground/60">Start the conversation below</p>
                </div>
              </div>
            ) : (
              messages.map(msg => {
                const isMe = msg.sender_name === currentUser?.name;
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    {!isMe && (
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold mr-2 flex-shrink-0 self-end mb-1"
                        style={{ background: 'hsl(var(--primary))', color: 'hsl(222 28% 8%)' }}>
                        {msg.sender_name?.[0]}
                      </div>
                    )}
                    <div className={`max-w-[70%]`}>
                      <div className={`rounded-2xl px-3.5 py-2.5 ${
                        isMe
                          ? 'rounded-br-sm bg-primary/20 border border-primary/30'
                          : 'rounded-bl-sm bg-secondary border border-border/40'
                      }`}>
                        <p className="text-xs">{msg.content}</p>
                      </div>
                      <div className={`flex items-center gap-1.5 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <span className="text-[10px] text-muted-foreground/60">
                          {msg.sender_name}
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full capitalize ${
                          msg.sender_role === 'admin' ? 'bg-yellow-500/15 text-yellow-500'
                          : 'bg-blue-500/15 text-blue-400'
                        }`}>{msg.sender_role}</span>
                        <span className="text-[10px] text-muted-foreground/40">
                          {msg.created_date
                            ? formatDistanceToNow(new Date(msg.created_date), { addSuffix: true })
                            : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-border/30 flex gap-2 flex-shrink-0">
            <Input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="Type a message..."
              className="bg-secondary border-border/50 text-sm" />
            <Button onClick={send} disabled={sending || !input.trim()}
              className="px-4 flex-shrink-0"
              style={{ background: 'hsl(var(--primary))', color: 'hsl(222 28% 8%)' }}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <MessageSquare className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Select a ticket to start chatting</p>
          </div>
        </div>
      )}
    </div>
  );
}