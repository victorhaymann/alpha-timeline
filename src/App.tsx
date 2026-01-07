import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { ErrorBoundary } from "@/components/errors/ErrorBoundary";
import { LoadingTransition } from "@/components/ui/BrandedLoader";

import Auth from "./pages/Auth";
import Projects from "./pages/Projects";
import NewProject from "./pages/NewProject";
import ProjectDetail from "./pages/ProjectDetail";
import Templates from "./pages/Templates";
import SettingsPage from "./pages/SettingsPage";
import Clients from "./pages/Clients";
import ClientDetail from "./pages/ClientDetail";
import ClientPortal from "./pages/ClientPortal";
import ClientProjectView from "./pages/ClientProjectView";
import SharedProjectView from "./pages/SharedProjectView";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (!loading && !user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <LoadingTransition loading={loading}>
      {children}
    </LoadingTransition>
  );
}

// Root route wrapper - handles auth loading for home page only
function RootRoute() {
  const { user, loading } = useAuth();

  const content = user ? <Navigate to="/projects" replace /> : <Auth />;

  return (
    <LoadingTransition loading={loading}>
      {content}
    </LoadingTransition>
  );
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes - render immediately without waiting for auth */}
      <Route path="/" element={<RootRoute />} />
      <Route path="/share/:token" element={<SharedProjectView />} />
      
      {/* Protected routes with layout */}
      <Route element={
        <ProtectedRoute>
          <AppLayout />
        </ProtectedRoute>
      }>
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/new" element={<NewProject />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/clients/:id" element={<ClientDetail />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/settings" element={<SettingsPage />} />
        
        {/* Client Portal routes */}
        <Route path="/portal" element={<ClientPortal />} />
        <Route path="/portal/projects/:id" element={<ClientProjectView />} />
      </Route>
      
      {/* Catch-all */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ErrorBoundary>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
