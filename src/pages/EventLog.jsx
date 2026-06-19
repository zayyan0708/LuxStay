/**
 * Event Log — Notifier Service view
 *
 * GO_API INTEGRATION:
 *   Real events come from: GET http://localhost:8082/notifier/events
 *   That Go Notifier Service independently subscribes to MQTT topics:
 *     hotel/tickets/#  and  hotel/chat/#
 *   and keeps an in-memory ring buffer of the last N events.
 *
 *   To switch to real Go Notifier:
 *     import { goFetch, GO_API } from '@/lib/goApiConfig';
 *     const events = await goFetch(GO_API.NOTIFIER.EVENTS);
 *     const health = await goFetch(GO_API.NOTIFIER.HEALTH);
 *
 *   For real-time SSE from Gateway:
 *     import { connectGoSSE } from '@/lib/goApiConfig';
 *     connectGoSSE((type, data) => addEvent(type, data));
 */
import { useState, useEffect, useRef } from 'react';
import { luxStay } from '@/api/Client';
import { Activity, Wifi, MessageSquare, Tag, ArrowUpCircle, CheckCircle2, RefreshCw, Radio } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

const EVENT_CFG = {
  ticket_created:   { icon: Tag,           color: '#f59e0b', label: 'Ticket Created',   topic: 'hotel/tickets/created' },
  ticket_assigned:  { icon: ArrowUpCircle, color: '#3b82f6', label: 'Ticket Assigned',  topic: 'hotel/tickets/assigned' },
  status_updated:   { icon: CheckCircle2,  color: '#a855f7', label: 'Status Updated',   topic: 'hotel/tickets/status_updated' },
  chat_message:     { icon: MessageSquare, color: '#06b6d4', label: 'Chat Message',      topic: 'hotel/chat/...' },
  ticket_resolved:  { icon: CheckCircle2,  color: '#22c55e', label: 'Ticket Resolved',  topic: 'hotel/tickets/resolved' },
};

const SERVICE_CFG = {
  gateway:  { cls: 'bg-yellow-500/15 text-yellow-400',  label: 'Gateway' },
  auth:     { cls: 'bg-blue-500/15 text-blue-400',      label: 'Auth' },
  notifier: { cls: 'bg-purple-500/15 text-purple-400',  label: 'Notifier' },
};

export default function EventLog() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [liveCount, setLiveCount] = useState(0);
  const bottomRef = useRef(null);

  const load = async () => {
    setLoading(true);
    // GO_API: goFetch(GO_API.NOTIFIER.EVENTS) — from Notifier Service
    const data = await luxStay.entities.EventLog.list('-created_date', 100);
    setEvents(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // GO_API: Replace with connectGoSSE((type, data) => setEvents(p => [data, ...p].slice(0, 100)))
  useEffect(() => {
    const unsub = luxStay.entities.EventLog.subscribe((event) => {
      if (event.type === 'create') {
        setEvents(p => [event.data, ...p].slice(0, 100));
        setLiveCount(c => c + 1);
      }
    });
    return unsub;
  }, []);

  const filtered = filter === 'all' ? events : events.filter(e => e.event_type === filter);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Event Stream</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {/* GO_API: This mirrors the Notifier Service's MQTT subscriber log */}
            Notifier Service · MQTT Event Buffer
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Live indicator */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border border-border/50"
            style={{ background: 'hsl(var(--card))' }}>
            <span className="w-2 h-2 rounded-full bg-green-400 pulse-dot" />
            <span className="text-green-400 font-medium">Live · {liveCount} new</span>
          </div>
          <button onClick={load}
            className="p-2.5 rounded-xl border border-border/50 hover:bg-secondary transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* MQTT Topics info bar */}
      {/* GO_API: This shows which MQTT topics the Go Notifier Service subscribes to */}
      <div className="rounded-xl border border-border/50 p-4"
        style={{ background: 'hsl(var(--card))' }}>
        <div className="flex items-center gap-2 mb-2">
          <Radio className="w-4 h-4 text-primary" />
          <p className="text-xs font-semibold text-primary">MQTT Topics Subscribed (Go Notifier Service)</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {['hotel/tickets/created', 'hotel/tickets/assigned', 'hotel/tickets/status_updated', 'hotel/chat/#'].map(t => (
            <span key={t} className="text-[10px] font-mono px-2 py-1 rounded-md border border-border/30 bg-secondary text-muted-foreground">
              {t}
            </span>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          {/* GO_API: Notifier at localhost:8082 subscribes via paho.mqtt.golang (Mosquitto broker) */}
          Go Notifier Service (port 8082) subscribes via paho.mqtt.golang → Mosquitto broker
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {[{ key: 'all', label: 'All Events' }, ...Object.entries(EVENT_CFG).map(([k, v]) => ({ key: k, label: v.label }))].map(tab => (
          <button key={tab.key} onClick={() => setFilter(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              filter === tab.key
                ? 'border-primary/50 bg-primary/10 text-primary'
                : 'border-border/30 text-muted-foreground hover:text-foreground hover:border-border'
            }`}>
            {tab.label}
            {tab.key !== 'all' && (
              <span className="ml-1.5 opacity-60">
                ({events.filter(e => e.event_type === tab.key).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Event feed */}
      <div className="rounded-xl border border-border/50 overflow-hidden"
        style={{ background: 'hsl(var(--card))' }}>
        <div className="px-4 py-3 border-b border-border/30 flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">
            {filtered.length} events
          </span>
        </div>

        <div className="divide-y divide-border/20 max-h-[60vh] overflow-y-auto">
          {loading ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-4 animate-pulse">
                <div className="w-8 h-8 rounded-lg bg-secondary flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-32 bg-secondary rounded" />
                  <div className="h-2.5 w-64 bg-secondary/50 rounded" />
                </div>
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Activity className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-30" />
              <p className="text-sm text-muted-foreground">No events yet.</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Create or update tickets to see events here.
              </p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {filtered.map(event => {
                const cfg = EVENT_CFG[event.event_type] || EVENT_CFG.ticket_created;
                const Icon = cfg.icon;
                const svcCfg = SERVICE_CFG[event.service_source] || SERVICE_CFG.gateway;
                return (
                  <motion.div key={event.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: `${cfg.color}18` }}>
                      <Icon className="w-4 h-4" style={{ color: cfg.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-xs font-semibold" style={{ color: cfg.color }}>
                          {cfg.label}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${svcCfg.cls}`}>
                          {svcCfg.label}
                        </span>
                        {event.ticket_number && (
                          <span className="text-[10px] font-mono text-muted-foreground/60">
                            #{event.ticket_number}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="font-mono opacity-70">{cfg.topic}</span>
                        {event.actor && (
                          <>
                            <span>·</span>
                            <span>{event.actor}</span>
                          </>
                        )}
                      </div>
                      {event.payload && (
                        <p className="text-[10px] text-muted-foreground/60 font-mono mt-0.5 truncate">
                          {event.payload}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">
                      {event.created_date
                        ? formatDistanceToNow(new Date(event.created_date), { addSuffix: true })
                        : 'just now'}
                    </span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </div>
      <div ref={bottomRef} />
    </div>
  );
}