import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Clock,
  Cpu,
  Layers,
  Network,
  Power,
  Radio,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Wifi,
  Zap,
} from 'lucide-react';
import { api } from '../api/client';
import { AnalyticsMetrics, SimulatedNode, TimelineEvent } from '../api/types';
import { useMeshEvent } from '../api/ws';

export const NetworkAnalyticsView: React.FC = () => {
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [nodes, setNodes] = useState<SimulatedNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Failure Simulation Form State
  const [selectedParentId, setSelectedParentId] = useState<string>('EM-01');
  const [selectedNodeOfflineId, setSelectedNodeOfflineId] = useState<string>('EM-03');
  const [degradeSrc, setDegradeSrc] = useState<string>('EM-01');
  const [degradeDst, setDegradeDst] = useState<string>('EM-04');
  const [degradeLoss, setDegradeLoss] = useState<number>(65);
  const [degradeLatency, setDegradeLatency] = useState<number>(140);

  const loadData = async () => {
    setLoading(true);
    try {
      const [m, tl, n] = await Promise.all([
        api.getSimulationAnalytics(),
        api.getSimulationTimeline(40),
        api.getSimulationNodes(),
      ]);
      setMetrics(m);
      setTimeline(tl);
      setNodes(n);
    } catch (err) {
      console.error('Failed to load network analytics', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useMeshEvent('simulation.updated', () => loadData());
  useMeshEvent('simulation.event', () => loadData());
  useMeshEvent('node.offline', () => loadData());
  useMeshEvent('node.online', () => loadData());

  const showFeedback = (msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 4000);
  };

  const handleSimulateParentFailure = async () => {
    try {
      await api.simulateEvent({
        event_type: 'NODE_FAILURE',
        target_id: selectedParentId,
      });
      showFeedback(`Simulated failure on ${selectedParentId}`);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleNodeOffline = async () => {
    try {
      await api.simulateEvent({
        event_type: 'TOGGLE_NODE_POWER',
        target_id: selectedNodeOfflineId,
      });
      showFeedback(`Toggled power on ${selectedNodeOfflineId}`);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSimulateGatewayFailure = async () => {
    if (!confirm('WARNING: Simulating Gateway failure will trigger a full mesh partition and force all nodes into ISOLATED mode. Proceed?')) return;
    try {
      await api.simulateEvent({
        event_type: 'GATEWAY_FAILURE',
        target_id: 'GATEWAY',
      });
      showFeedback('Gateway crash simulated');
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRestoreFullNetwork = async () => {
    try {
      await api.simulateEvent({
        event_type: 'RESTORE_NETWORK',
      });
      showFeedback('Full network restoration triggered');
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDegradeLink = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.simulateEvent({
        event_type: 'DEGRADE_LINK',
        target_id: degradeSrc,
        details: {
          destination_id: degradeDst,
          packet_loss: degradeLoss,
          latency_ms: degradeLatency,
        },
      });
      showFeedback(`Link degraded: ${degradeSrc} -> ${degradeDst}`);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Activity size={24} style={{ color: 'var(--accent-primary)' }} />
            <h2 style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--text-main)' }}>Network Analytics</h2>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
            Application-level simulator, self-healing tree reconfiguration, and recovery time measurement
          </p>
        </div>

        <div className="flex items-center gap-3">
          {actionFeedback && (
            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald)', background: 'rgba(136, 179, 148, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
              ✓ {actionFeedback}
            </span>
          )}
          <button onClick={handleRestoreFullNetwork} className="btn btn-sm btn-primary">
            <RotateCcw size={14} /> Reset Network
          </button>
          <button onClick={loadData} disabled={loading} className="btn btn-sm">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <div className="card p-3\.5">
            <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Node Availability</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.25rem', fontFamily: 'var(--font-mono)' }} className="flex items-center gap-1\.5 text-main">
              {metrics.node_availability_percent}%
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 400 }}>
                ({metrics.online_nodes}/{metrics.total_nodes})
              </span>
            </div>
            <div style={{ width: '100%', height: '6px', background: 'var(--bg-surface-elevated)', borderRadius: '999px', marginTop: '0.5rem', overflow: 'hidden' }}>
              <div
                style={{ height: '100%', background: 'var(--accent-emerald)', borderRadius: '999px', transition: 'all 0.5s', width: `${metrics.node_availability_percent}%` }}
              />
            </div>
          </div>

          <div className="card p-3\.5">
            <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Packet Delivery Ratio</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.25rem', color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>
              {metrics.packet_delivery_ratio}%
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>Loss: {metrics.packet_loss_percent}%</div>
          </div>

          <div className="card p-3\.5">
            <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Average Latency</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.25rem', color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
              {metrics.average_latency_ms} <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 400 }}>ms</span>
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>End-to-end multi-hop</div>
          </div>

          <div className="card p-3\.5">
            <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Average Hop Count</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.25rem', color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
              {metrics.average_hop_count} <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 400 }}>hops</span>
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>To Root Gateway</div>
          </div>

          <div className="card p-3\.5">
            <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Topology Changes</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.25rem', color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>
              {metrics.topology_changes_count}
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>Self-healing events</div>
          </div>

          <div className="card p-3\.5" style={{ background: 'rgba(136, 179, 148, 0.05)', borderColor: 'rgba(136, 179, 148, 0.3)' }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--accent-emerald)', textTransform: 'uppercase' }}>Latest Recovery Time</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.25rem', color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>
              {metrics.latest_recovery_time_ms} <span style={{ fontSize: '0.75rem', opacity: 0.7, fontWeight: 400 }}>ms</span>
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>Avg: {metrics.average_recovery_time_ms}ms</div>
          </div>
        </div>
      )}

      {/* Recovery Time Formula Visualizer */}
      <div className="card mb-6 p-4" style={{ background: 'var(--bg-surface)' }}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div style={{ padding: '0.5rem', borderRadius: '8px', background: 'rgba(113, 137, 166, 0.1)', color: 'var(--accent-primary)' }}>
              <Clock size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                RECOVERY TIME METRIC DEFINITION
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', fontFamily: 'var(--font-mono)' }}>
                <code style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                  recovery_time = Timestamp(Communication Re-established) − Timestamp(Failure Detected)
                </code>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4" style={{ fontSize: '0.75rem' }}>
            <div className="text-right">
              <span style={{ color: 'var(--text-muted)', display: 'block' }}>Measured Window:</span>
              <strong style={{ color: 'var(--text-main)' }}>
                {metrics ? `${(metrics.latest_recovery_time_ms / 1000).toFixed(2)} seconds` : '—'}
              </strong>
            </div>
            <div className="text-right pl-4" style={{ borderLeft: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)', display: 'block' }}>Autonomous Re-parenting:</span>
              <strong style={{ color: 'var(--accent-emerald)' }}>ACTIVE</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* NETWORK SIMULATOR Action Console */}
        <div className="col-span-12 lg:col-span-5 space-y-6">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4 pb-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <Zap size={18} style={{ color: 'var(--accent-primary)' }} />
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 700 }}>Network Simulator Control</h3>
            </div>

            <div className="space-y-4" style={{ fontSize: '0.75rem' }}>
              {/* Scenario 1 */}
              <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>1. Simulate Parent Failure</span>
                  <span className="badge badge-amber" style={{ fontSize: '0.625rem' }}>SCENARIO</span>
                </div>
                <p style={{ color: 'var(--text-muted)', marginBottom: '0.625rem', fontSize: '0.75rem' }}>
                  Disables a parent relay node. Affected child nodes will detect orphan state and automatically discover a new parent.
                </p>

                <div className="flex gap-2">
                  <select
                    value={selectedParentId}
                    onChange={(e) => setSelectedParentId(e.target.value)}
                    className="form-input"
                    style={{ fontSize: '0.75rem' }}
                  >
                    {nodes
                      .filter((n) => n.node_id !== 'GATEWAY' && n.children.length > 0)
                      .map((n) => (
                        <option key={n.node_id} value={n.node_id}>
                          {n.node_id} ({n.children.length} children • {n.status})
                        </option>
                      ))}
                  </select>

                  <button onClick={handleSimulateParentFailure} className="btn btn-sm btn-warning flex-shrink-0">
                    Fail Parent
                  </button>
                </div>
              </div>

              {/* Scenario 2 */}
              <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>2. Single Node Offline Toggle</span>
                </div>
                <p style={{ color: 'var(--text-muted)', marginBottom: '0.625rem', fontSize: '0.75rem' }}>
                  Simulate individual node battery depletion, shutdown, or field power recovery.
                </p>

                <div className="flex gap-2">
                  <select
                    value={selectedNodeOfflineId}
                    onChange={(e) => setSelectedNodeOfflineId(e.target.value)}
                    className="form-input"
                    style={{ fontSize: '0.75rem' }}
                  >
                    {nodes.map((n) => (
                      <option key={n.node_id} value={n.node_id}>
                        {n.node_id} ({n.status} • Layer {n.layer})
                      </option>
                    ))}
                  </select>

                  <button onClick={handleToggleNodeOffline} className="btn btn-sm flex-shrink-0">
                    <Power size={13} /> Toggle State
                  </button>
                </div>
              </div>

              {/* Scenario 3 */}
              <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>3. Link Degradation Injection</span>
                </div>

                <form onSubmit={handleDegradeLink} className="space-y-2\.5 mt-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.6875rem', marginBottom: '0.125rem' }}>Source Node:</label>
                      <select
                        value={degradeSrc}
                        onChange={(e) => setDegradeSrc(e.target.value)}
                        className="form-input"
                        style={{ fontSize: '0.75rem' }}
                      >
                        {nodes.map((n) => (
                          <option key={n.node_id} value={n.node_id}>
                            {n.node_id}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.6875rem', marginBottom: '0.125rem' }}>Target Node:</label>
                      <select
                        value={degradeDst}
                        onChange={(e) => setDegradeDst(e.target.value)}
                        className="form-input"
                        style={{ fontSize: '0.75rem' }}
                      >
                        {nodes.map((n) => (
                          <option key={n.node_id} value={n.node_id}>
                            {n.node_id}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.6875rem', marginBottom: '0.125rem' }}>Drop Rate ({degradeLoss}%):</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={degradeLoss}
                        onChange={(e) => setDegradeLoss(parseInt(e.target.value, 10))}
                        className="form-input"
                        style={{ fontSize: '0.75rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.6875rem', marginBottom: '0.125rem' }}>Latency ({degradeLatency}ms):</label>
                      <input
                        type="number"
                        min="5"
                        max="2000"
                        value={degradeLatency}
                        onChange={(e) => setDegradeLatency(parseInt(e.target.value, 10))}
                        className="form-input"
                        style={{ fontSize: '0.75rem' }}
                      />
                    </div>
                  </div>

                  <button type="submit" className="btn btn-sm btn-warning w-full mt-1">
                    Inject Link Noise
                  </button>
                </form>
              </div>

              {/* Scenario 4 */}
              <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(201, 130, 130, 0.05)', border: '1px solid rgba(201, 130, 130, 0.3)' }}>
                <div style={{ fontWeight: 700, color: 'var(--accent-red)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>4. Root Gateway Failure Simulation</span>
                  <AlertOctagon size={14} />
                </div>
                <p style={{ color: 'var(--text-muted)', marginBottom: '0.625rem', fontSize: '0.75rem' }}>
                  Simulates complete root coordinator failure. All mesh nodes lose upstream gateway connectivity and enter ISOLATED mode.
                </p>

                <button onClick={handleSimulateGatewayFailure} className="btn btn-sm btn-danger w-full">
                  Simulate Gateway Crash
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Live Timeline */}
        <div className="col-span-12 lg:col-span-7">
          <div className="card p-5 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4 pb-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center gap-2">
                <Layers size={18} style={{ color: 'var(--accent-primary)' }} />
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 700 }}>Live Event Timeline</h3>
              </div>
              <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{timeline.length} Events</span>
            </div>

            <div style={{ overflowY: 'auto', maxHeight: '560px', paddingRight: '0.25rem' }} className="space-y-2\.5">
              {timeline.length > 0 ? (
                timeline.map((evt, idx) => {
                  let badgeClass = 'badge-gray';
                  let borderClass = 'var(--border-subtle)';
                  let bgClass = 'transparent';
                  
                  if (evt.level === 'CRITICAL') {
                    badgeClass = 'badge-red';
                    borderClass = 'rgba(201, 130, 130, 0.3)';
                    bgClass = 'rgba(201, 130, 130, 0.05)';
                  } else if (evt.level === 'WARNING') {
                    badgeClass = 'badge-amber';
                    borderClass = 'rgba(216, 184, 120, 0.3)';
                    bgClass = 'rgba(216, 184, 120, 0.05)';
                  } else if (evt.level === 'SUCCESS') {
                    badgeClass = 'badge-emerald';
                    borderClass = 'rgba(136, 179, 148, 0.3)';
                    bgClass = 'rgba(136, 179, 148, 0.05)';
                  }

                  return (
                    <div
                      key={`${evt.timestamp}-${idx}`}
                      style={{ padding: '0.75rem', borderRadius: '8px', border: `1px solid ${borderClass}`, background: bgClass }}
                      className="flex items-start justify-between gap-3"
                    >
                      <div className="flex items-start gap-2\.5">
                        <span style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-muted)', marginTop: '0.125rem' }} className="shrink-0">
                          {evt.timestamp}
                        </span>

                        <div>
                          <div className="flex items-center gap-2">
                            <span style={{ fontWeight: 700, fontSize: '0.8125rem', color: 'var(--text-main)' }}>{evt.node_id}</span>
                            <span className={`badge ${badgeClass}`} style={{ fontSize: '0.625rem' }}>
                              {evt.event_type}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{evt.message}</div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  No network events recorded yet. Trigger a failure scenario above to observe live logs.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
