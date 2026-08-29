import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Battery,
  Boxes,
  Cpu,
  Layers,
  RefreshCw,
  Shield,
  Users,
} from 'lucide-react';
import { api } from '../api/client';
import { AnalyticsSummary } from '../api/types';

export const AnalyticsView: React.FC = () => {
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.getAnalyticsSummary();
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to load analytics', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">OPERATIONAL ANALYTICS & KPIS</h2>
          <p className="text-xs text-muted font-mono mt-0.5">
            HISTORICAL AGGREGATES • RESPONSE DURATION • SYSTEM PERFORMANCE METRICS
          </p>
        </div>

        <button onClick={loadData} disabled={loading} className="btn btn-sm">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh Metrics
        </button>
      </div>

      {/* Primary KPI row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="metric-card border-blue">
          <div className="text-xs font-bold text-muted uppercase">Incident Clearance Rate</div>
          <div className="text-3xl font-extrabold mt-1 text-blue font-mono">
            {analytics?.incidents.total
              ? Math.round((analytics.incidents.resolved / analytics.incidents.total) * 100)
              : 100}
            %
          </div>
          <div className="text-xs text-dim mt-2">
            {analytics?.incidents.resolved ?? 0} of {analytics?.incidents.total ?? 0} Resolved
          </div>
        </div>

        <div className="metric-card border-red">
          <div className="text-xs font-bold text-muted uppercase">Distress Resolution</div>
          <div className="text-3xl font-extrabold mt-1 text-red font-mono">
            {analytics?.sos.total
              ? Math.round(((analytics.sos.total - analytics.sos.active) / analytics.sos.total) * 100)
              : 100}
            %
          </div>
          <div className="text-xs text-dim mt-2">
            {analytics?.sos.active ?? 0} Pending Immediate Action
          </div>
        </div>

        <div className="metric-card border-emerald">
          <div className="text-xs font-bold text-muted uppercase">Mesh Packet Reliability</div>
          <div className="text-3xl font-extrabold mt-1 text-emerald font-mono">
            {analytics?.mesh.health_pct ?? 100}%
          </div>
          <div className="text-xs text-dim mt-2">
            {analytics?.mesh.online_nodes ?? 0} Relays In Direct Contact
          </div>
        </div>

        <div className="metric-card border-amber">
          <div className="text-xs font-bold text-muted uppercase">Responder Mobilization</div>
          <div className="text-3xl font-extrabold mt-1 text-amber font-mono">
            {analytics?.responders.total
              ? Math.round((analytics.responders.deployed / analytics.responders.total) * 100)
              : 0}
            %
          </div>
          <div className="text-xs text-dim mt-2">
            {analytics?.responders.deployed ?? 0} Active Deployments
          </div>
        </div>
      </div>

      {/* Category Breakdown & Performance Panels */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-6">
          <div className="card">
            <h3 className="text-base font-bold mb-4 flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber" /> INCIDENTS BY CATEGORY
            </h3>

            {Object.keys(analytics?.incidents.by_category || {}).length === 0 ? (
              <div className="text-center py-8 text-muted text-sm">No incidents recorded yet.</div>
            ) : (
              <div className="space-y-3">
                {Object.entries(analytics?.incidents.by_category || {}).map(([cat, count]) => {
                  const total = analytics?.incidents.total || 1;
                  const pct = Math.round((count / total) * 100);
                  return (
                    <div key={cat}>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span className="text-main">{cat.replace(/_/g, ' ')}</span>
                        <span className="font-mono text-cyan">{count} incidents ({pct}%)</span>
                      </div>
                      <div style={{ height: '6px', background: 'var(--bg-surface-elevated)', borderRadius: '999px', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent-blue)', borderRadius: '999px' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-6">
          <div className="card">
            <h3 className="text-base font-bold mb-4 flex items-center gap-2">
              <Cpu size={18} className="text-emerald" /> MESH HEALTH & POWER TELEMETRY
            </h3>

            <div className="space-y-4 text-xs font-mono text-muted">
              <div className="p-3" style={{ background: 'var(--bg-app)', borderRadius: 'var(--radius-sm)' }}>
                <div className="flex justify-between text-sm font-bold text-main mb-1">
                  <span>AVERAGE NODE BATTERY</span>
                  <span className="text-emerald">{analytics?.mesh.avg_battery_pct ?? 100}%</span>
                </div>
                <div style={{ height: '8px', background: 'var(--bg-surface)', borderRadius: '999px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${analytics?.mesh.avg_battery_pct ?? 100}%`,
                      height: '100%',
                      background: 'var(--accent-emerald)',
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3" style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div className="text-dim">TOTAL RELAYS</div>
                  <div className="text-2xl font-bold text-main mt-1">{analytics?.mesh.total_nodes ?? 0}</div>
                </div>
                <div className="p-3" style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div className="text-dim">DEVICES IN FIELD</div>
                  <div className="text-2xl font-bold text-cyan mt-1">{analytics?.users.total ?? 0}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
