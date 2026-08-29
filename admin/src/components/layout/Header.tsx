import React, { useEffect, useState } from 'react';
import { LogOut, Menu, Radio, User as UserIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface HeaderProps {
  onMobileMenuToggle: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMobileMenuToggle }) => {
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
      <div className="flex items-center gap-3">
        <button className="mobile-menu-btn" onClick={onMobileMenuToggle} title="Toggle navigation">
          <Menu size={20} />
        </button>

        <div
          className="flex items-center gap-2"
          style={{
            padding: '0.25rem 0.625rem',
            background: 'rgba(136, 179, 148, 0.1)',
            border: '1px solid rgba(136, 179, 148, 0.25)',
            borderRadius: 'var(--radius-full)',
          }}
        >
          <span className="pulse-dot online" />
          <span
            style={{
              fontSize: '0.6875rem',
              fontWeight: 600,
              color: 'var(--accent-emerald)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Gateway Online
          </span>
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-dim)' }}>| Sim-Mesh</span>
        </div>

        <div
          className="hidden md:flex items-center gap-2"
          style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}
        >
          <Radio size={13} style={{ color: 'var(--accent-primary)' }} />
          <span>FREQ: 2.4 GHz (ESP-NOW)</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div
          className="hidden sm:block"
          style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}
        >
          <span style={{ color: 'var(--text-dim)' }}>SYS TIME:</span> {timeStr}
        </div>

        <div
          className="flex items-center gap-3"
          style={{ paddingLeft: '0.75rem', borderLeft: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center gap-2">
            <div
              style={{
                padding: '0.3rem',
                background: 'var(--bg-surface-elevated)',
                borderRadius: '50%',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <UserIcon size={14} style={{ color: 'var(--accent-primary)' }} />
            </div>
            <div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, lineHeight: 1, color: 'var(--text-main)' }}>
                {user?.full_name || user?.username}
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', marginTop: '0.125rem' }}>
                {user?.role}
              </div>
            </div>
          </div>

          <button onClick={logout} className="btn-icon" title="Sign out of NOC">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
};
