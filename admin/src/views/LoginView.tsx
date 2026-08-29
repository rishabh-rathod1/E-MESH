import React, { useState } from 'react';
import { AlertCircle, Lock, Radio, Shield, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('Admin@Mesh2025');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const setCredentials = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div className="flex items-center justify-center" style={{ minHeight: '100vh', background: 'radial-gradient(circle at 50% 30%, #151e30 0%, #080b11 70%)', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: '440px', background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-lg)', padding: '2rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)' }}>
        <div className="flex flex-col items-center text-center mb-6">
          <div className="p-3 mb-3" style={{ background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '16px' }}>
            <Radio size={32} className="text-blue" />
          </div>
          <h1 className="text-2xl font-extrabold" style={{ letterSpacing: '0.5px' }}>E-MESH COMMAND CENTER</h1>
          <p className="text-xs text-muted mt-1 uppercase tracking-widest">Self-Healing Emergency Response Network</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 mb-4 text-xs font-semibold text-red" style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-sm)' }}>
            <AlertCircle size={16} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label flex items-center gap-1.5">
              <User size={14} className="text-blue" /> Operator Username
            </label>
            <input
              type="text"
              required
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. admin"
            />
          </div>

          <div className="form-group">
            <label className="form-label flex items-center gap-1.5">
              <Lock size={14} className="text-blue" /> Security Key / Password
            </label>
            <input
              type="password"
              required
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
            />
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary w-full mt-2" style={{ padding: '0.75rem' }}>
            {loading ? 'Authenticating Operator...' : 'Authenticate & Access NOC'}
          </button>
        </form>

        <div className="mt-6 pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <div className="text-xs font-bold text-dim uppercase tracking-wider mb-2 text-center">
            Quick Operator Profiles
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setCredentials('admin', 'Admin@Mesh2025')}
              style={{ fontSize: '0.75rem' }}
            >
              <Shield size={12} className="text-amber" /> System Admin
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setCredentials('manager', 'Manager@Mesh2025')}
              style={{ fontSize: '0.75rem' }}
            >
              <User size={12} className="text-blue" /> Incident Manager
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
