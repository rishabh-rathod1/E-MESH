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
          <h2 style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--text-main)' }}>
            Operational Overview
          </h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
            Mesh network status and active operations
          </p>
        </div>
        <button onClick={loadData} disabled={loading} className="btn btn-sm">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Emergency SOS Banner (Visible if active alerts exist) */}
      {activeSOSList.length > 0 && (
        <div className="emergency-banner">
          <div className="flex items-center gap-3">
            <div
              style={{
                padding: '0.5rem',
                background: 'var(--accent-red)',
                borderRadius: '50%',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AlertOctagon size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--accent-red)' }}>
                Active SOS Alert ({activeSOSList.length} Distress Signal{activeSOSList.length > 1 ? 's' : ''})
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Immediate responder dispatch required. People affected: {activeSOSList.reduce((acc, s) => acc + s.people_count, 0)}
              </div>
            </div>
          </div>
          <button onClick={() => setActiveTab('sos')} className="btn btn-danger btn-sm">
            Triage SOS <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="metric-card border-red">
          <div className="flex justify-between items-start">
            <div>
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Active SOS Calls</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.25rem', color: 'var(--accent-red)', fontFamily: 'var(--font-mono)' }}>{analytics?.sos.active ?? 0}</div>
            </div>
            <div style={{ padding: '0.5rem', background: 'rgba(201, 130, 130, 0.1)', borderRadius: '8px' }}>
              <AlertOctagon size={18} style={{ color: 'var(--accent-red)' }} />
            </div>
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', marginTop: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Total Logged: {analytics?.sos.total ?? 0}</span>
            <span style={{ color: 'var(--accent-red)', fontWeight: 600 }}>Priority: Max</span>
          </div>
        </div>

        <div className="metric-card border-amber">
          <div className="flex justify-between items-start">
            <div>
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Active Incidents</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.25rem', color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>{analytics?.incidents.active ?? 0}</div>
            </div>
            <div style={{ padding: '0.5rem', background: 'rgba(216, 184, 120, 0.1)', borderRadius: '8px' }}>
              <AlertTriangle size={18} style={{ color: 'var(--accent-amber)' }} />
            </div>
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', marginTop: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Resolved: {analytics?.incidents.resolved ?? 0}</span>
            <span style={{ color: 'var(--accent-amber)', fontWeight: 600 }}>Triage Required</span>
          </div>
        </div>

        <div className="metric-card border-emerald">
          <div className="flex justify-between items-start">
            <div>
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Mesh Nodes Online</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.25rem', color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>
                {analytics?.mesh.online_nodes ?? 0} / {analytics?.mesh.total_nodes ?? 0}
              </div>
            </div>
            <div style={{ padding: '0.5rem', background: 'rgba(136, 179, 148, 0.1)', borderRadius: '8px' }}>
              <Radio size={18} style={{ color: 'var(--accent-emerald)' }} />
            </div>
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', marginTop: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Mesh Health: {analytics?.mesh.health_pct ?? 100}%</span>
            <span className="flex items-center gap-1" style={{ color: 'var(--accent-emerald)' }}>
              <BatteryCharging size={12} /> Avg {analytics?.mesh.avg_battery_pct ?? 100}%
            </span>
          </div>
        </div>

        <div className="metric-card border-blue">
          <div className="flex justify-between items-start">
            <div>
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Field Responders</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.25rem', color: 'var(--accent-blue)', fontFamily: 'var(--font-mono)' }}>
                {analytics?.responders.available ?? 0} <span style={{ fontSize: '0.8125rem', fontWeight: 400, color: 'var(--text-dim)' }}>Avail</span>
              </div>
            </div>
            <div style={{ padding: '0.5rem', background: 'rgba(113, 137, 166, 0.1)', borderRadius: '8px' }}>
              <Shield size={18} style={{ color: 'var(--accent-blue)' }} />
            </div>
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', marginTop: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Deployed: {analytics?.responders.deployed ?? 0}</span>
            <span>Total: {analytics?.responders.total ?? 0}</span>
          </div>
        </div>
      </div>

      {/* Quick Action Bar */}
      <div className="card mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Zap size={15} style={{ color: 'var(--accent-amber)' }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-main)' }}>Quick Actions</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setActiveTab('announcements')} className="btn btn-sm">
              <Megaphone size={13} style={{ color: 'var(--accent-amber)' }} /> Broadcast
            </button>
            <button onClick={() => setActiveTab('responders')} className="btn btn-sm">
              <Shield size={13} style={{ color: 'var(--accent-blue)' }} /> Responders
            </button>
            <button onClick={() => setActiveTab('nodes')} className="btn btn-sm">
              <Cpu size={13} style={{ color: 'var(--accent-cyan)' }} /> Add Node
            </button>
            <button onClick={() => setActiveTab('topology')} className="btn btn-sm btn-primary">
              <Activity size={13} /> Network Map
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
                <AlertTriangle size={16} style={{ color: 'var(--accent-amber)' }} />
                <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-main)' }}>Recent Incidents</h3>
              </div>
              <button
                onClick={() => setActiveTab('incidents')}
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--accent-blue)',
                  fontWeight: 600,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
              >
                View All <ArrowRight size={12} />
              </button>
            </div>

            {recentIncidents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                No incidents currently reported.
              </div>
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
                          <td style={{ fontWeight: 600 }}>{inc.category.replace(/_/g, ' ')}</td>
                          <td style={{ color: 'var(--text-muted)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {inc.description}
                          </td>
                          <td><span className={`badge ${statusColor}`}>{inc.status.replace(/_/g, ' ')}</span></td>
                          <td style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
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
            <h3 className="flex items-center gap-2" style={{ fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-main)' }}>
              <Activity size={15} style={{ color: 'var(--accent-blue)' }} /> Severity Breakdown
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
                    <div className="flex justify-between" style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                      <span>{prio}</span>
                      <span style={{ fontFamily: 'var(--font-mono)' }}>{count} ({pct}%)</span>
                    </div>
                    <div style={{ height: '5px', background: 'var(--bg-surface-elevated)', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '999px' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card">
            <h3 className="flex items-center gap-2" style={{ fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-main)' }}>
              <Radio size={15} style={{ color: 'var(--accent-emerald)' }} /> Gateway Simulator
            </h3>
            <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              <div className="flex justify-between py-1" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <span>LAYER:</span> <span style={{ color: 'var(--accent-emerald)' }}>Software Emulation</span>
              </div>
              <div className="flex justify-between py-1" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <span>HARDWARE:</span> <span style={{ color: 'var(--text-main)' }}>ESP32-WROOM-32</span>
              </div>
              <div className="flex justify-between py-1" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <span>PACKET LOSS:</span> <span style={{ color: 'var(--accent-emerald)' }}>0.02%</span>
              </div>
              <div className="flex justify-between py-1">
                <span>HOP LIMIT:</span> <span style={{ color: 'var(--text-main)' }}>7 Hops Max</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
