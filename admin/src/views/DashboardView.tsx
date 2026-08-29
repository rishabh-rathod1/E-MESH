import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  BatteryCharging,
  Cpu,
  Megaphone,
  Radio,
  RefreshCw,
  Shield,
  Zap,
} from 'lucide-react';
import { api } from '../api/client';
import { AnalyticsSummary, Incident, SOS } from '../api/types';
import { ActiveTab } from '../components/layout/Sidebar';

import { useMeshEvent } from '../api/ws';

interface DashboardViewProps {
  setActiveTab: (tab: ActiveTab) => void;
  onSelectIncident?: (id: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ setActiveTab }) => {
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [activeSOSList, setActiveSOSList] = useState<SOS[]>([]);
  const [recentIncidents, setRecentIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [stats, sosResp, incResp] = await Promise.all([
        api.getAnalyticsSummary(),
        api.getSOSList({ status: 'ACTIVE', page_size: 5 }),
        api.getIncidents({ page_size: 6 }),
      ]);
      setAnalytics(stats);
      setActiveSOSList(sosResp.data);
      setRecentIncidents(incResp.data);
    } catch (err) {
      console.error('Failed to fetch dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Real-time event subscriptions
  useMeshEvent('sos.created', () => loadData());
  useMeshEvent('incident.created', () => loadData());
  useMeshEvent('incident.updated', () => loadData());
  useMeshEvent('incident.resolved', () => loadData());
  useMeshEvent('node.online', () => loadData());
  useMeshEvent('node.offline', () => loadData());

  return (
    <div>
      {/* Top Title & Refresh */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">OPERATIONAL COMMAND OVERVIEW</h2>
          <p className="text-xs text-muted font-mono mt-0.5">MESH ROUTING LAYER • ACTIVE TELEMETRY MONITOR</p>
        </div>
        <button onClick={loadData} disabled={loading} className="btn btn-sm">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh Stream
        </button>
      </div>

      {/* Emergency SOS Banner (Visible if active alerts exist) */}
      {activeSOSList.length > 0 && (
        <div className="emergency-banner">
          <div className="flex items-center gap-3">
            <div className="p-2" style={{ background: 'var(--accent-red)', borderRadius: '50%', color: '#fff' }}>
              <AlertOctagon size={20} />
            </div>
            <div>
              <div className="text-sm font-bold text-red uppercase tracking-wider">
                CRITICAL SOS ALERT IN PROGRESS ({activeSOSList.length} Active Distress Signal{activeSOSList.length > 1 ? 's' : ''})
              </div>
              <div className="text-xs text-muted">
                Immediate responder dispatch required. People affected: {activeSOSList.reduce((acc, s) => acc + s.people_count, 0)}
              </div>
            </div>
          </div>
          <button onClick={() => setActiveTab('sos')} className="btn btn-danger btn-sm">
            Triage SOS Queue <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="metric-card border-red">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs font-bold text-muted uppercase tracking-wider">Active SOS Calls</div>
              <div className="text-3xl font-extrabold mt-1 text-red font-mono">{analytics?.sos.active ?? 0}</div>
            </div>
            <div className="p-2" style={{ background: 'rgba(239, 68, 68, 0.15)', borderRadius: '8px' }}>
              <AlertOctagon size={20} className="text-red" />
            </div>
          </div>
          <div className="text-xs text-dim mt-3 flex items-center justify-between">
            <span>Total Logged: {analytics?.sos.total ?? 0}</span>
            <span className="text-red font-semibold">Priority: Max</span>
          </div>
        </div>

        <div className="metric-card border-amber">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs font-bold text-muted uppercase tracking-wider">Active Incidents</div>
              <div className="text-3xl font-extrabold mt-1 text-amber font-mono">{analytics?.incidents.active ?? 0}</div>
            </div>
            <div className="p-2" style={{ background: 'rgba(245, 158, 11, 0.15)', borderRadius: '8px' }}>
              <AlertTriangle size={20} className="text-amber" />
            </div>
          </div>
          <div className="text-xs text-dim mt-3 flex items-center justify-between">
            <span>Resolved: {analytics?.incidents.resolved ?? 0}</span>
            <span className="text-amber font-semibold">Triage Required</span>
          </div>
        </div>

        <div className="metric-card border-emerald">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs font-bold text-muted uppercase tracking-wider">Mesh Nodes Online</div>
              <div className="text-3xl font-extrabold mt-1 text-emerald font-mono">
                {analytics?.mesh.online_nodes ?? 0} / {analytics?.mesh.total_nodes ?? 0}
              </div>
            </div>
            <div className="p-2" style={{ background: 'rgba(16, 185, 129, 0.15)', borderRadius: '8px' }}>
              <Radio size={20} className="text-emerald" />
            </div>
          </div>
          <div className="text-xs text-dim mt-3 flex items-center justify-between">
            <span>Mesh Health: {analytics?.mesh.health_pct ?? 100}%</span>
            <span className="flex items-center gap-1 text-emerald">
              <BatteryCharging size={12} /> Avg {analytics?.mesh.avg_battery_pct ?? 100}%
            </span>
          </div>
        </div>

        <div className="metric-card border-blue">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs font-bold text-muted uppercase tracking-wider">Field Responders</div>
              <div className="text-3xl font-extrabold mt-1 text-blue font-mono">
                {analytics?.responders.available ?? 0} <span className="text-sm font-normal text-dim">Avail</span>
              </div>
            </div>
            <div className="p-2" style={{ background: 'rgba(59, 130, 246, 0.15)', borderRadius: '8px' }}>
              <Shield size={20} className="text-blue" />
            </div>
          </div>
          <div className="text-xs text-dim mt-3 flex items-center justify-between">
            <span>Deployed: {analytics?.responders.deployed ?? 0}</span>
            <span>Total: {analytics?.responders.total ?? 0}</span>
          </div>
        </div>
      </div>

      {/* Quick Action Bar */}
      <div className="card mb-6" style={{ background: 'var(--bg-surface)' }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-amber" />
            <span className="text-xs font-bold uppercase tracking-wider">Quick Dispatch Actions</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setActiveTab('announcements')} className="btn btn-sm">
              <Megaphone size={14} className="text-amber" /> Broadcast Notice
            </button>
            <button onClick={() => setActiveTab('responders')} className="btn btn-sm">
              <Shield size={14} className="text-blue" /> Mobilize Responders
            </button>
            <button onClick={() => setActiveTab('nodes')} className="btn btn-sm">
              <Cpu size={14} className="text-cyan" /> Add Mesh Node
            </button>
            <button onClick={() => setActiveTab('topology')} className="btn btn-sm btn-primary">
              <Activity size={14} /> View Live Network Map
            </button>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Recent Incidents & Mesh Health Summary */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left: Incident Feed */}
        <div className="col-span-12 lg:col-span-8">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-amber" />
                <h3 className="text-base font-bold">LIVE INCIDENT STREAM</h3>
              </div>
              <button onClick={() => setActiveTab('incidents')} className="text-xs text-blue font-semibold flex items-center gap-1">
                View All Incidents <ArrowRight size={12} />
              </button>
            </div>

            {recentIncidents.length === 0 ? (
              <div className="text-center py-8 text-muted text-sm">No incidents currently reported. Mesh is calm.</div>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Priority</th>
                      <th>Category</th>
                      <th>Description</th>
                      <th>Status</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentIncidents.map((inc) => {
                      const priorityColor =
                        inc.priority === 'CRITICAL'
                          ? 'badge-red'
                          : inc.priority === 'HIGH'
                          ? 'badge-amber'
                          : inc.priority === 'MEDIUM'
                          ? 'badge-blue'
                          : 'badge-gray';

                      const statusColor =
                        inc.status === 'SUBMITTED'
                          ? 'badge-amber'
                          : inc.status === 'IN_PROGRESS'
                          ? 'badge-blue'
                          : inc.status === 'RESOLVED'
                          ? 'badge-emerald'
                          : 'badge-gray';

                      return (
                        <tr key={inc.id} style={{ cursor: 'pointer' }} onClick={() => setActiveTab('incidents')}>
                          <td><span className={`badge ${priorityColor}`}>{inc.priority}</span></td>
                          <td className="font-semibold">{inc.category.replace(/_/g, ' ')}</td>
                          <td className="text-muted" style={{ maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {inc.description}
                          </td>
                          <td><span className={`badge ${statusColor}`}>{inc.status.replace(/_/g, ' ')}</span></td>
                          <td className="text-xs font-mono text-dim">
                            {new Date(inc.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right: Operational Status Panels */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
          <div className="card">
            <h3 className="text-sm font-bold mb-3 uppercase tracking-wider flex items-center gap-2">
              <Activity size={16} className="text-blue" /> Severity Breakdown
            </h3>
            <div className="flex flex-col gap-3">
              {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((prio) => {
                const count = analytics?.incidents.by_priority[prio] ?? 0;
                const total = analytics?.incidents.total || 1;
                const pct = Math.round((count / total) * 100);
                const color =
                  prio === 'CRITICAL'
                    ? 'var(--accent-red)'
                    : prio === 'HIGH'
                    ? 'var(--accent-amber)'
                    : prio === 'MEDIUM'
                    ? 'var(--accent-blue)'
                    : 'var(--text-dim)';

                return (
                  <div key={prio}>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span>{prio}</span>
                      <span className="font-mono">{count} ({pct}%)</span>
                    </div>
                    <div style={{ height: '6px', background: 'var(--bg-surface-elevated)', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '999px' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card">
            <h3 className="text-sm font-bold mb-3 uppercase tracking-wider flex items-center gap-2">
              <Radio size={16} className="text-emerald" /> Gateway Simulator
            </h3>
            <div className="text-xs text-muted space-y-2 font-mono">
              <div className="flex justify-between py-1" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <span>LAYER:</span> <span className="text-emerald">Software Emulation</span>
              </div>
              <div className="flex justify-between py-1" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <span>HARDWARE:</span> <span>ESP32-WROOM-32</span>
              </div>
              <div className="flex justify-between py-1" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <span>PACKET LOSS:</span> <span className="text-emerald">0.02%</span>
              </div>
              <div className="flex justify-between py-1">
                <span>HOP LIMIT:</span> <span>7 Hops Max</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
