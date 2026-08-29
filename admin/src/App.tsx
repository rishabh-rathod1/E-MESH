import React from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginView } from './views/LoginView';

const MainContent: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ minHeight: '100vh', background: 'var(--bg-app)' }}
      >
        <div className="flex flex-col items-center gap-3">
          <div
            className="pulse-dot online"
            style={{ width: '16px', height: '16px' }}
          />
          <div className="text-xs font-mono text-muted tracking-widest uppercase">
            Initializing E-Mesh NOC Console...
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginView />;
  }

  return <AppLayout />;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
};
