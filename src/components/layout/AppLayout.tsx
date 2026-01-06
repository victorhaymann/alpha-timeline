import { Outlet } from 'react-router-dom';
import { TopNav } from './TopNav';

export function AppLayout() {
  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="px-4 sm:px-6 lg:px-8 xl:px-12 py-6">
        <Outlet />
      </main>
    </div>
  );
}
