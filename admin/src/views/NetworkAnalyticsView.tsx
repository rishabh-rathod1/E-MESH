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

  // Real-time updates via WebSockets
  useMeshEvent('topology.updated', () => loadData());
  useMeshEvent('node.online', () => loadData());
  useMeshEvent('node.offline', () => loadData());
  useMeshEvent('node.updated', () => loadData());
  useMeshEvent('route.changed', () => loadData());
  useMeshEvent('system.alert', () => loadData());

  const showToast = (msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 4000);
  };

  const handleSimulateParentFailure = async () => {
    try {
      const res = await api.failSimulationParent({ parent_node_id: selectedParentId, auto_reheal: true });
      showToast(`Parent failure simulated on ${selectedParentId}. Self-healing re-parented ${res.affected_children?.length || 0} nodes in ${res.recovery_time_ms}ms!`);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSimulateGatewayFailure = async () => {
    if (!confirm('Simulate Root Gateway failure? This will sever all routes across the entire mesh.')) return;
    try {
      await api.failSimulationGateway();
      showToast('Root Gateway failure simulated! All mesh nodes entered ISOLATED/DEGRADED state.');
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRestoreFullNetwork = async () => {
    try {
      await api.restoreSimulationNetwork();
      showToast('Full Mesh Network restored to healthy operational baseline!');
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleNodeOffline = async () => {
    const node = nodes.find((n) => n.node_id === selectedNodeOfflineId);
    if (!node) return;
    try {
      if (node.status === 'ONLINE') {
        await api.takeSimulationNodeOffline(selectedNodeOfflineId);
        showToast(`Node ${selectedNodeOfflineId} taken OFFLINE`);
      } else {
        await api.bringSimulationNodeOnline(selectedNodeOfflineId);
        showToast(`Node ${selectedNodeOfflineId} brought back ONLINE`);
      }
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDegradeLink = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.degradeSimulationLink({
        source_node_id: degradeSrc,
        target_node_id: degradeDst,
        packet_loss_percent: degradeLoss,
        latency_ms: degradeLatency,
      });
      showToast(`Link noise injected between ${degradeSrc} and ${degradeDst}`);
      loadData();
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
            <Activity size={24} className="text-cyan" />
            <h2 className="text-2xl font-extrabold tracking-tight">MESH FAILURE, RECOVERY & NETWORK ANALYTICS</h2>
          </div>
          <p className="text-xs text-muted font-mono mt-0.5">
            APPLICATION-LEVEL SIMULATOR • SELF-HEALING TREE RECONFIGURATION • RECOVERY TIME MEASUREMENT
          </p>
        </div>

        <div className="flex items-center gap-3">
          {actionFeedback && (
            <span className="badge badge-success animate-fade-in font-mono text-xs">
              ✓ {actionFeedback}
            </span>
          )}
          <button onClick={handleRestoreFullNetwork} className="btn btn-sm btn-primary">
            <RotateCcw size={14} /> Restore Full Network
          </button>
          <button onClick={loadData} disabled={loading} className="btn btn-sm">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh Metrics
          </button>
        </div>
      </div>

      {/* KPI Metrics Deck */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6 font-mono">
          <div className="card p-3.5">
            <span className="text-xs text-muted block mb-1">Node Availability</span>
            <div className="text-2xl font-extrabold text-white flex items-center gap-1.5">
              {metrics.node_availability_percent}%
              <span className="text-xs text-emerald-400 font-normal">
                ({metrics.online_nodes}/{metrics.total_nodes})
              </span>
            </div>
            <div className="w-full bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${metrics.node_availability_percent}%` }}
              />
            </div>
          </div>

          <div className="card p-3.5">
            <span className="text-xs text-muted block mb-1">Packet Delivery Ratio</span>
            <div className="text-2xl font-extrabold text-cyan">
              {metrics.packet_delivery_ratio}%
            </div>
            <div className="text-[11px] text-muted mt-1">Loss: {metrics.packet_loss_percent}%</div>
          </div>

          <div className="card p-3.5">
            <span className="text-xs text-muted block mb-1">Average Latency</span>
            <div className="text-2xl font-extrabold text-white">
              {metrics.average_latency_ms} <span className="text-xs font-normal text-muted">ms</span>
            </div>
            <div className="text-[11px] text-muted mt-1">End-to-end multi-hop</div>
          </div>

          <div className="card p-3.5">
            <span className="text-xs text-muted block mb-1">Average Hop Count</span>
            <div className="text-2xl font-extrabold text-white">
              {metrics.average_hop_count} <span className="text-xs font-normal text-muted">hops</span>
            </div>
            <div className="text-[11px] text-muted mt-1">To Root Gateway</div>
          </div>

          <div className="card p-3.5">
            <span className="text-xs text-muted block mb-1">Topology Changes</span>
            <div className="text-2xl font-extrabold text-amber-400">
              {metrics.topology_changes_count}
            </div>
            <div className="text-[11px] text-muted mt-1">Self-healing events</div>
          </div>

          <div className="card p-3.5 bg-gradient-to-br from-slate-900 to-emerald-950/40 border-emerald-500/30">
            <span className="text-xs text-emerald-400 font-bold block mb-1">Latest Recovery Time</span>
            <div className="text-2xl font-extrabold text-emerald-400">
              {metrics.latest_recovery_time_ms} <span className="text-xs font-normal text-muted">ms</span>
            </div>
            <div className="text-[11px] text-muted mt-1">Avg: {metrics.average_recovery_time_ms}ms</div>
          </div>
        </div>
      )}

      {/* Recovery Time Formula Visualizer */}
      <div className="card mb-6 p-4 bg-surface border-strong font-mono text-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-cyan/10 text-cyan">
              <Clock size={20} />
            </div>
            <div>
              <div className="font-bold text-sm text-white flex items-center gap-2">
                RECOVERY TIME METRIC DEFINITION & FORMULA
              </div>
              <div className="text-muted mt-0.5">
                <code className="text-cyan font-bold">
                  recovery_time = Timestamp(Communication Re-established) − Timestamp(Failure Detected)
                </code>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="text-right">
              <span className="text-muted block">Measured Window:</span>
              <strong className="text-white">
                {metrics ? `${(metrics.latest_recovery_time_ms / 1000).toFixed(2)} seconds` : '—'}
              </strong>
            </div>
            <div className="text-right border-l border-strong pl-4">
              <span className="text-muted block">Autonomous Re-parenting:</span>
              <strong className="text-emerald-400">ACTIVE</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* NETWORK SIMULATOR Action Console */}
        <div className="col-span-12 lg:col-span-5 space-y-6">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-strong">
              <Zap size={18} className="text-cyan" />
              <h3 className="text-base font-bold">NETWORK SIMULATOR CONTROL CONSOLE</h3>
            </div>

            <div className="space-y-4 font-mono text-xs">
              {/* Scenario 1: Parent Node Failure & Self-Healing */}
              <div className="p-3 rounded-lg bg-surface border border-strong">
                <div className="font-bold text-white mb-1 flex items-center justify-between">
                  <span>1. Simulate Parent Failure & Self-Healing</span>
                  <span className="badge badge-warning text-[10px]">SCENARIO</span>
                </div>
                <p className="text-muted text-[11px] mb-2.5">
                  Disables a parent relay node. Affected child nodes will detect orphan state, automatically discover a new parent, and re-establish upstream route.
                </p>

                <div className="flex gap-2">
                  <select
                    value={selectedParentId}
                    onChange={(e) => setSelectedParentId(e.target.value)}
                    className="form-input text-xs"
                  >
                    {nodes
                      .filter((n) => n.node_id !== 'GATEWAY' && n.children.length > 0)
                      .map((n) => (
                        <option key={n.node_id} value={n.node_id}>
                          {n.node_id} ({n.children.length} children • {n.status})
                        </option>
                      ))}
                  </select>

                  <button onClick={handleSimulateParentFailure} className="btn btn-sm btn-warning shrink-0">
                    Fail Parent
                  </button>
                </div>
              </div>

              {/* Scenario 2: Single Node Toggle */}
              <div className="p-3 rounded-lg bg-surface border border-strong">
                <div className="font-bold text-white mb-1 flex items-center justify-between">
                  <span>2. Single Node Offline / Recovery Toggle</span>
                </div>
                <p className="text-muted text-[11px] mb-2.5">
                  Simulate individual node battery depletion, shutdown, or field power recovery.
                </p>

                <div className="flex gap-2">
                  <select
                    value={selectedNodeOfflineId}
                    onChange={(e) => setSelectedNodeOfflineId(e.target.value)}
                    className="form-input text-xs"
                  >
                    {nodes.map((n) => (
                      <option key={n.node_id} value={n.node_id}>
                        {n.node_id} ({n.status} • Layer {n.layer})
                      </option>
                    ))}
                  </select>

                  <button onClick={handleToggleNodeOffline} className="btn btn-sm shrink-0">
                    <Power size={13} /> Toggle State
                  </button>
                </div>
              </div>

              {/* Scenario 3: Link Degradation Injector */}
              <div className="p-3 rounded-lg bg-surface border border-strong">
                <div className="font-bold text-white mb-1 flex items-center justify-between">
                  <span>3. Link Degradation & Latency Injection</span>
                </div>

                <form onSubmit={handleDegradeLink} className="space-y-2.5 mt-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-muted block text-[10px] mb-0.5">Source Node:</label>
                      <select
                        value={degradeSrc}
                        onChange={(e) => setDegradeSrc(e.target.value)}
                        className="form-input text-xs"
                      >
                        {nodes.map((n) => (
                          <option key={n.node_id} value={n.node_id}>
                            {n.node_id}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-muted block text-[10px] mb-0.5">Target Node:</label>
                      <select
                        value={degradeDst}
                        onChange={(e) => setDegradeDst(e.target.value)}
                        className="form-input text-xs"
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
                      <label className="text-muted block text-[10px] mb-0.5">Drop Rate ({degradeLoss}%):</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={degradeLoss}
                        onChange={(e) => setDegradeLoss(parseInt(e.target.value, 10))}
                        className="form-input text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-muted block text-[10px] mb-0.5">Latency ({degradeLatency}ms):</label>
                      <input
                        type="number"
                        min="5"
                        max="2000"
                        value={degradeLatency}
                        onChange={(e) => setDegradeLatency(parseInt(e.target.value, 10))}
                        className="form-input text-xs"
                      />
                    </div>
                  </div>

                  <button type="submit" className="btn btn-sm btn-warning w-full mt-1">
                    Inject Link Noise
                  </button>
                </form>
              </div>

              {/* Scenario 4: Root Gateway Failure */}
              <div className="p-3 rounded-lg bg-red-950/20 border border-red-500/30">
                <div className="font-bold text-red-400 mb-1 flex items-center justify-between">
                  <span>4. Root Gateway Failure Simulation</span>
                  <AlertOctagon size={14} />
                </div>
                <p className="text-muted text-[11px] mb-2.5">
                  Simulates complete root coordinator failure. All mesh nodes lose upstream gateway connectivity and enter ISOLATED mode.
                </p>

                <button onClick={handleSimulateGatewayFailure} className="btn btn-sm btn-danger w-full">
                  Simulate Gateway Crash
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Live Failure & Recovery Event Timeline */}
        <div className="col-span-12 lg:col-span-7">
          <div className="card p-5 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-strong">
              <div className="flex items-center gap-2">
                <Layers size={18} className="text-cyan" />
                <h3 className="text-base font-bold">LIVE FAILURE & RECOVERY EVENT TIMELINE</h3>
              </div>
              <span className="text-xs text-muted font-mono">{timeline.length} Events Logged</span>
            </div>

            {/* Timeline Stream */}
            <div className="space-y-2.5 overflow-y-auto max-h-[560px] pr-1 font-mono text-xs">
              {timeline.length > 0 ? (
                timeline.map((evt, idx) => {
                  let badgeClass = 'badge-subtle';
                  let borderClass = 'border-strong';
                  if (evt.level === 'CRITICAL') {
                    badgeClass = 'badge-danger';
                    borderClass = 'border-red-500/40 bg-red-950/10';
                  } else if (evt.level === 'WARNING') {
                    badgeClass = 'badge-warning';
                    borderClass = 'border-amber-500/40 bg-amber-950/10';
                  } else if (evt.level === 'SUCCESS') {
                    badgeClass = 'badge-success';
                    borderClass = 'border-emerald-500/40 bg-emerald-950/10';
                  }

                  return (
                    <div
                      key={`${evt.timestamp}-${idx}`}
                      className={`p-3 rounded-lg border ${borderClass} flex items-start justify-between gap-3 transition-all`}
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="text-muted font-bold text-[11px] shrink-0 mt-0.5">
                          {evt.timestamp}
                        </span>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{evt.node_id}</span>
                            <span className={`badge ${badgeClass} text-[10px]`}>
                              {evt.event_type}
                            </span>
                          </div>
                          <div className="text-muted text-[11px] mt-1">{evt.message}</div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-12 text-muted text-xs">
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
