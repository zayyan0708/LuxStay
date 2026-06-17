import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { RoleProvider, useRole } from '@/lib/roleContext';
import AppLayout from '@/components/layout/AppLayout';
import AdminDashboard from '@/pages/AdminDashboard';
import AllTickets from '@/pages/AllTickets';
import StaffManagement from '@/pages/StaffManagement';
import StaffPortal from '@/pages/StaffPortal';
import GuestPortal from '@/pages/GuestPortal';
import ChatHub from '@/pages/ChatHub';
import EventLog from '@/pages/EventLog';

function RoleGate({ adminEl, staffEl, guestEl }) {
  const { currentUser } = useRole();
  const role = currentUser?.role;
  if (role === 'admin') return adminEl;
  if (role === 'staff') return staffEl;
  if (role === 'guest') return guestEl;
  return null;
}

function RoleRouter() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={
          <RoleGate
            adminEl={<AdminDashboard />}
            staffEl={<Navigate to="/staff-portal" replace />}
            guestEl={<Navigate to="/guest-portal" replace />}
          />
        } />
        <Route path="/tickets"      element={<RoleGate adminEl={<AllTickets />}      staffEl={<Navigate to="/" replace />} guestEl={<Navigate to="/" replace />} />} />
        <Route path="/staff"        element={<RoleGate adminEl={<StaffManagement />} staffEl={<Navigate to="/" replace />} guestEl={<Navigate to="/" replace />} />} />
        <Route path="/chat"         element={<RoleGate adminEl={<ChatHub />}         staffEl={<ChatHub />}                 guestEl={<Navigate to="/" replace />} />} />
        <Route path="/events"       element={<RoleGate adminEl={<EventLog />}        staffEl={<EventLog />}                guestEl={<Navigate to="/" replace />} />} />
        <Route path="/staff-portal" element={<RoleGate adminEl={<Navigate to="/" replace />} staffEl={<StaffPortal />}    guestEl={<Navigate to="/" replace />} />} />
        <Route path="/guest-portal" element={<RoleGate adminEl={<Navigate to="/" replace />} staffEl={<Navigate to="/" replace />} guestEl={<GuestPortal />} />} />
        <Route path="*" element={<PageNotFound />} />
      </Route>
    </Routes>
  );
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: 'hsl(222 28% 8%)' }}>
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-border border-t-primary rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading SmartHotel...</p>
        </div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') return <UserNotRegisteredError />;
    else if (authError.type === 'auth_required') { navigateToLogin(); return null; }
  }

  return (
    <RoleProvider>
      <RoleRouter />
    </RoleProvider>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;