import { Bell, Wifi, WifiOff } from 'lucide-react';
import { useRole } from '@/lib/roleContext';
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export default function TopBar() {
  const { currentUser } = useRole();
  const [sseStatus] = useState('simulated'); // GO_API: change to 'connected'/'disconnected' when real SSE is live
  const [recentCount, setRecentCount] = useState(0);

  // GO_API: Replace this with real SSE connection:
  // import { connectGoSSE } from '@/lib/goApiConfig';
  // useEffect(() => connectGoSSE((type, data) => setRecentCount(c => c+1)), []);

  useEffect(() => {
    const unsub = base44.entities.EventLog.subscribe((event) => {
      if (event.type === 'create') setRecentCount(c => c + 1);
    });
    return unsub;
  }, []);

  const roleColor = {
    admin: 'text-yellow-400',
    staff: 'text-blue-400',
    guest: 'text-green-400',
  }[currentUser?.role];

  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-border/50 flex-shrink-0"
      style={{ background: 'hsl(222 24% 10%)' }}>
      <div>
        <span className="text-sm font-medium" style={{ color: 'hsl(var(--muted-foreground))' }}>
          Hotel Maintenance Ticketing System
        </span>
      </div>

      <div className="flex items-center gap-4">
        {/* SSE / MQTT Status indicator */}
        {/* GO_API: This shows 'MQTT via SSE' when real Go Gateway SSE is connected */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs"
          style={{ background: 'hsl(var(--muted))' }}>
          {sseStatus === 'connected' ? (
            <>
              <Wifi className="w-3 h-3 text-green-400" />
              <span className="text-green-400">MQTT Live</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-yellow-400 pulse-dot inline-block" />
              <span className="text-yellow-400">Real-time Active</span>
            </>
          )}
        </div>

        {/* Notifications */}
        <button className="relative p-2 rounded-lg hover:bg-secondary transition-colors">
          <Bell className="w-4 h-4" style={{ color: 'hsl(var(--muted-foreground))' }} />
          {recentCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold"
              style={{ background: 'hsl(var(--primary))', color: 'hsl(222 28% 8%)' }}>
              {recentCount > 9 ? '9+' : recentCount}
            </span>
          )}
        </button>

        {/* User pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
          style={{ background: 'hsl(var(--secondary))' }}>
          <div className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold"
            style={{ background: 'hsl(var(--primary))', color: 'hsl(222 28% 8%)' }}>
            {currentUser?.avatar}
          </div>
          <span className={`text-xs font-medium capitalize ${roleColor}`}>
            {currentUser?.role}
          </span>
        </div>
      </div>
    </header>
  );
}