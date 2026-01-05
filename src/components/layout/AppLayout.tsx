import { Outlet } from 'react-router-dom';
import { TopNav } from './TopNav';

export function AppLayout() {
  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="container py-8">
        <Outlet />
      </main>
    </div>
  );
}
