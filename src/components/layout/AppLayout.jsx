import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function AppLayout() {
  return (
    <div className="min-h-screen flex" style={{ background: 'hsl(var(--background))' }}>
      <Sidebar />
      <div className="flex-1 flex flex-col ml-64 min-h-screen">
        <TopBar />
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}