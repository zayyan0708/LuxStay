import { Link, useLocation } from 'react-router-dom';
import { useRole } from '@/lib/roleContext';
import {
  Ticket, LayoutDashboard, MessageSquare, Activity,
  Users, LogOut, Hotel, ChevronRight, Wrench
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = {
  admin: [
    { label: 'Dashboard',   path: '/',          icon: LayoutDashboard },
    { label: 'All Tickets', path: '/tickets',    icon: Ticket },
    { label: 'Staff',       path: '/staff',      icon: Users },
    { label: 'Chat',        path: '/chat',       icon: MessageSquare },
    { label: 'Event Log',   path: '/events',     icon: Activity },
  ],
  staff: [
    { label: 'My Tasks',    path: '/staff-portal', icon: Wrench },
    { label: 'Chat',        path: '/chat',          icon: MessageSquare },
    { label: 'Event Log',   path: '/events',        icon: Activity },
  ],
  guest: [
    { label: 'My Tickets',  path: '/guest-portal',  icon: Ticket },
  ],
};

export default function Sidebar() {
  const { currentUser, login, logout, DEMO_USERS } = useRole();
  const location = useLocation();
  const navItems = NAV_ITEMS[currentUser?.role] || [];

  return (
    <aside className="fixed top-0 left-0 h-full w-64 flex flex-col z-40"
      style={{ background: 'hsl(222 30% 6%)' }}>
      {/* Logo */}
      <div className="px-6 py-6 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'hsl(var(--primary))' }}>
            <Hotel className="w-5 h-5" style={{ color: 'hsl(222 28% 8%)' }} />
          </div>
          <div>
            <h1 className="font-heading text-sm font-bold tracking-wide"
              style={{ color: 'hsl(var(--primary))' }}>SmartHotel</h1>
            <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
              Maintenance System
            </p>
          </div>
        </div>
      </div>

      {/* Current User */}
      <div className="px-4 py-3 mx-3 mt-4 rounded-xl" style={{ background: 'hsl(222 20% 12%)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
            style={{ background: 'hsl(var(--primary))', color: 'hsl(222 28% 8%)' }}>
            {currentUser?.avatar}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{currentUser?.name}</p>
            <span className={cn(
              'text-xs px-2 py-0.5 rounded-full font-medium capitalize',
              currentUser?.role === 'admin' && 'bg-yellow-500/20 text-yellow-400',
              currentUser?.role === 'staff' && 'bg-blue-500/20 text-blue-400',
              currentUser?.role === 'guest' && 'bg-green-500/20 text-green-400',
            )}>
              {currentUser?.role}
              {currentUser?.room_number && ` · Room ${currentUser.room_number}`}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 mt-4 space-y-1 overflow-y-auto">
        {navItems.map(({ label, path, icon: Icon }) => {
          const active = location.pathname === path;
          return (
            <Link key={path} to={path}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group',
                active
                  ? 'text-[hsl(222_28%_8%)]'
                  : 'text-[hsl(45_10%_55%)] hover:text-[hsl(45_20%_85%)] hover:bg-[hsl(222_20%_14%)]'
              )}
              style={active ? { background: 'hsl(var(--primary))' } : {}}>
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-medium">{label}</span>
              {active && <ChevronRight className="w-3 h-3 ml-auto" />}
            </Link>
          );
        })}
      </nav>

      {/* Switch User (demo) */}
      <div className="px-3 pb-4 border-t border-border/30 pt-3">
        <p className="text-xs px-3 mb-2" style={{ color: 'hsl(var(--muted-foreground))' }}>
          Switch Demo User
        </p>
        <div className="space-y-1">
          {DEMO_USERS.slice(0, 5).map(u => (
            <button key={u.id} onClick={() => login(u.id)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all',
                currentUser?.id === u.id
                  ? 'bg-primary/20 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              )}>
              <span className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                style={{ background: 'hsl(var(--border))' }}>{u.avatar}</span>
              <span className="truncate">{u.name}</span>
              <span className={cn(
                'ml-auto text-[10px] px-1.5 py-0.5 rounded-full capitalize',
                u.role === 'admin' && 'bg-yellow-500/20 text-yellow-400',
                u.role === 'staff' && 'bg-blue-500/20 text-blue-400',
                u.role === 'guest' && 'bg-green-500/20 text-green-400',
              )}>{u.role}</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}