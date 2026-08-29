import React, { useEffect, useState } from 'react';
import { LogOut, Radio, User as UserIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="app-header">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '9999px' }}>
          <span className="pulse-dot online" />
          <span className="text-xs font-semibold text-emerald uppercase tracking-wider">Gateway Online</span>
          <span className="text-xs text-dim">| Sim-Mesh</span>
        </div>

        <div className="hidden md:flex items-center gap-2 text-xs font-mono text-muted">
          <Radio size={14} className="text-cyan" />
          <span>FREQ: 2.4 GHz (ESP-NOW)</span>
        </div>
      </div>

      <div className="flex items-center gap-5">
        <div className="text-xs font-mono text-muted hidden sm:block">
          <span className="text-dim">SYS TIME:</span> {timeStr}
        </div>

        <div className="flex items-center gap-3 pl-3" style={{ borderLeft: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-2">
            <div className="p-1.5" style={{ background: 'var(--bg-surface-elevated)', borderRadius: '50%', border: '1px solid var(--border-strong)' }}>
              <UserIcon size={16} className="text-blue" />
            </div>
            <div>
              <div className="text-sm font-semibold leading-none">{user?.full_name || user?.username}</div>
              <div className="text-xs text-dim mt-0.5">{user?.role}</div>
            </div>
          </div>

          <button onClick={logout} className="btn-icon" title="Sign out of NOC">
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
};
