import React from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Boxes,
  Cpu,
  FileText,
  Layers,
  Megaphone,
  Network,
  Radio,
  Settings,
  Shield,
  Users,
} from 'lucide-react';

export type ActiveTab =
  | 'dashboard'
  | 'incidents'
  | 'sos'
  | 'topology'
  | 'nodes'
  | 'responders'
  | 'people'
  | 'resources'
  | 'announcements'
  | 'analytics'
  | 'network-analytics'
  | 'audit'
  | 'settings';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  activeSosCount: number;
  activeIncidentCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  activeSosCount,
  activeIncidentCount,
}) => {
  const navItems = [
    { id: 'dashboard' as ActiveTab, label: 'Command Center', icon: Activity },
    {
      id: 'sos' as ActiveTab,
      label: 'Emergency SOS',
      icon: AlertOctagon,
      badge: activeSosCount > 0 ? activeSosCount : undefined,
    },
    {
      id: 'incidents' as ActiveTab,
      label: 'Incidents & Triage',
      icon: AlertTriangle,
      badge: activeIncidentCount > 0 ? activeIncidentCount : undefined,
    },
    { id: 'topology' as ActiveTab, label: 'Mesh Topology', icon: Network },
    { id: 'nodes' as ActiveTab, label: 'Node Hardware', icon: Cpu },
    { id: 'responders' as ActiveTab, label: 'Responders Roster', icon: Shield },
    { id: 'people' as ActiveTab, label: 'People Directory', icon: Users },
    { id: 'resources' as ActiveTab, label: 'Asset Inventory', icon: Boxes },
    { id: 'announcements' as ActiveTab, label: 'Broadcasts', icon: Megaphone },
    { id: 'analytics' as ActiveTab, label: 'Incident KPIs', icon: Layers },
    { id: 'network-analytics' as ActiveTab, label: 'Failure & Recovery', icon: Activity },
    { id: 'audit' as ActiveTab, label: 'Audit Trail', icon: FileText },
    { id: 'settings' as ActiveTab, label: 'System & Simulation', icon: Settings },
  ];

  return (
    <aside className="app-sidebar">
      <div className="sidebar-header">
        <div className="flex items-center justify-center p-2" style={{ background: 'rgba(59, 130, 246, 0.15)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
          <Radio size={20} className="text-blue" />
        </div>
        <div>
          <div className="font-bold text-sm" style={{ letterSpacing: '0.5px' }}>E-MESH NOC</div>
          <div className="text-xs text-muted">Emergency Mesh Ops</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="text-xs font-bold text-dim px-3 py-1 mb-1 uppercase" style={{ letterSpacing: '1px' }}>
          Operations
        </div>
        {navItems.slice(0, 4).map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <div className="flex items-center gap-3">
                <Icon size={18} className={isActive ? 'text-blue' : 'text-muted'} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && <span className="nav-item-badge">{item.badge}</span>}
            </button>
          );
        })}

        <div className="text-xs font-bold text-dim px-3 py-1 mt-4 mb-1 uppercase" style={{ letterSpacing: '1px' }}>
          Infrastructure & Personnel
        </div>
        {navItems.slice(4, 9).map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <div className="flex items-center gap-3">
                <Icon size={18} className={isActive ? 'text-blue' : 'text-muted'} />
                <span>{item.label}</span>
              </div>
            </button>
          );
        })}

        <div className="text-xs font-bold text-dim px-3 py-1 mt-4 mb-1 uppercase" style={{ letterSpacing: '1px' }}>
          Administration
        </div>
        {navItems.slice(9).map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <div className="flex items-center gap-3">
                <Icon size={18} className={isActive ? 'text-blue' : 'text-muted'} />
                <span>{item.label}</span>
              </div>
            </button>
          );
        })}
      </nav>
    </aside>
  );
};
