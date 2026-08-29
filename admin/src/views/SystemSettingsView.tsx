import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Battery,
  Cpu,
  Heart,
  Layers,
  Network,
  Power,
  Plus,
  Radio,
  RefreshCw,
  RotateCcw,
  Sliders,
  Trash2,
  Wifi,
  Zap,
} from 'lucide-react';
import { api } from '../api/client';
import { SimulatedNode, SimulationNetworkStatus } from '../api/types';
import { useMeshEvent } from '../api/ws';

export const SystemSettingsView: React.FC = () => {
  const [networkStatus, setNetworkStatus] = useState<SimulationNetworkStatus | null>(null);
  const [nodes, setNodes] = useState<SimulatedNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('EM-01');
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Parameter sliders for selected node
  const [parentSelection, setParentSelection] = useState<string>('');
  const [batterySlider, setBatterySlider] = useState<number>(100);
  const [rssiSlider, setRssiSlider] = useState<number>(-60);
  const [lossSlider, setLossSlider] = useState<number>(0);
  const [latencySlider, setLatencySlider] = useState<number>(15);

  // Link degradation panel state
  const [linkSrc, setLinkSrc] = useState<string>('EM-01');
  const [linkDst, setLinkDst] = useState<string>('EM-03');
  const [linkLoss, setLinkLoss] = useState<number>(50);
  const [linkLatency, setLinkLatency] = useState<number>(120);

  // New node modal/form state
  const [showAddNodeModal, setShowAddNodeModal] = useState(false);
  const [newNodeId, setNewNodeId] = useState('');
  const [newNodeParent, setNewNodeParent] = useState('GATEWAY');
  const [newNodeBattery, setNewNodeBattery] = useState(100);

  const loadData = async () => {
    setLoading(true);
    try {
      const [status, nodesList] = await Promise.all([
        api.getSimulationNetworkStatus(),
        api.getSimulationNodes(),
      ]);
      setNetworkStatus(status);
      setNodes(nodesList);

      const target = nodesList.find((n) => n.node_id === selectedNodeId) || nodesList[0];
      if (target) {
        setSelectedNodeId(target.node_id);
        setParentSelection(target.parent_id || 'GATEWAY');
        setBatterySlider(target.battery_percent ?? 100);
        setRssiSlider(target.rssi_dbm ?? -60);
        setLossSlider(target.packet_loss_percent ?? 0);
        setLatencySlider(target.latency_ms ?? 15);
      }
    } catch (err) {
      console.error('Failed to load simulation status', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useMeshEvent('topology.updated', () => loadData());
  useMeshEvent('node.online', () => loadData());
  useMeshEvent('node.offline', () => loadData());
  useMeshEvent('node.updated', () => loadData());

  const handleNodeSelect = (nid: string) => {
    setSelectedNodeId(nid);
    const target = nodes.find((n) => n.node_id === nid);
    if (target) {
      setParentSelection(target.parent_id || 'GATEWAY');
      setBatterySlider(target.battery_percent ?? 100);
      setRssiSlider(target.rssi_dbm ?? -60);
      setLossSlider(target.packet_loss_percent ?? 0);
      setLatencySlider(target.latency_ms ?? 15);
    }
  };

  const showFeedback = (msg: string) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 3500);
  };

  const handleToggleOnline = async () => {
    const node = nodes.find((n) => n.node_id === selectedNodeId);
    if (!node) return;
    try {
      if (node.status === 'ONLINE') {
        await api.takeSimulationNodeOffline(selectedNodeId);
        showFeedback(`Node ${selectedNodeId} taken OFFLINE`);
      } else {
        await api.bringSimulationNodeOnline(selectedNodeId);
        showFeedback(`Node ${selectedNodeId} brought ONLINE`);
      }
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRestoreNode = async () => {
    try {
      await api.restoreSimulationNode(selectedNodeId);
      showFeedback(`Node ${selectedNodeId} restored to full health`);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleTriggerHeartbeat = async () => {
    try {
      await api.simulateNodeHeartbeat(selectedNodeId);
      showFeedback(`Heartbeat received from ${selectedNodeId}`);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleApplySliders = async () => {
    try {
      await api.updateSimulationNode(selectedNodeId, {
        parent_id: selectedNodeId === 'GATEWAY' ? null : parentSelection,
        battery_percent: batterySlider,
        rssi_dbm: rssiSlider,
        packet_loss_percent: lossSlider,
        latency_ms: latencySlider,
      });
      showFeedback(`Node ${selectedNodeId} parameters applied`);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDegradeLink = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.degradeSimulationLink({
        source_node_id: linkSrc,
        target_node_id: linkDst,
        packet_loss_percent: linkLoss,
        latency_ms: linkLatency,
      });
      showFeedback(`Link ${linkSrc} <-> ${linkDst} degraded`);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateNode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNodeId.trim()) return;
    try {
      await api.createSimulationNode({
        node_id: newNodeId.trim().toUpperCase(),
        parent_id: newNodeParent,
        battery_percent: newNodeBattery,
      });
      setShowAddNodeModal(false);
      setNewNodeId('');
      showFeedback(`New Node ${newNodeId} deployed into mesh`);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteNode = async (nid: string) => {
    if (!confirm(`Remove simulated node ${nid} from mesh?`)) return;
    try {
      await api.deleteSimulationNode(nid);
      showFeedback(`Node ${nid} decommissioned`);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const currentNode = nodes.find((n) => n.node_id === selectedNodeId);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Cpu size={24} style={{ color: 'var(--accent-primary)' }} />
            <h2 style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--text-main)' }}>Simulation Control Lab</h2>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
            Application-level simulator, dynamic self-healing tree controls
          </p>
        </div>

        <div className="flex items-center gap-3">
          {actionMessage && (
            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald)', background: 'rgba(136, 179, 148, 0.1)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
              ✓ {actionMessage}
            </span>
          )}
          <button onClick={() => setShowAddNodeModal(true)} className="btn btn-sm btn-primary">
            <Plus size={14} /> Deploy Node
          </button>
          <button onClick={loadData} disabled={loading} className="btn btn-sm">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Network Overview Summary Banner */}
      {networkStatus && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 font-mono text-xs">
          <div className="card p-3">
            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.6875rem', textTransform: 'uppercase' }}>Target Protocol</span>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--accent-primary)', marginTop: '0.125rem' }}>{networkStatus.protocol_target}</div>
          </div>
          <div className="card p-3">
            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.6875rem', textTransform: 'uppercase' }}>Tree Depth</span>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.125rem' }}>{networkStatus.max_tree_depth} Layers</div>
          </div>
          <div className="card p-3">
            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.6875rem', textTransform: 'uppercase' }}>Online / Total</span>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--accent-emerald)', marginTop: '0.125rem' }}>
              {networkStatus.online_nodes} / {networkStatus.total_nodes} Nodes
            </div>
          </div>
          <div className="card p-3">
            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.6875rem', textTransform: 'uppercase' }}>Active Tree Links</span>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.125rem' }}>{networkStatus.active_links} Links</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-12 gap-6">
        {/* Node Selector & Quick Actions */}
        <div className="col-span-12 lg:col-span-4">
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3 pb-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
                <Network size={16} style={{ color: 'var(--accent-primary)' }} /> Select Mesh Node
              </h3>
              <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{nodes.length} Nodes</span>
            </div>

            <div style={{ maxHeight: '460px', overflowY: 'auto', paddingRight: '0.25rem' }} className="space-y-2">
              {nodes.map((node) => {
                const isSelected = node.node_id === selectedNodeId;
                const isOnline = node.status === 'ONLINE';
                const isDegraded = node.status === 'DEGRADED';
                
                let borderStyle = '1px solid var(--border-subtle)';
                let bgStyle = 'var(--bg-surface)';
                if (isSelected) {
                  borderStyle = '1px solid var(--accent-primary)';
                  bgStyle = 'rgba(113, 137, 166, 0.08)';
                }

                return (
                  <div
                    key={node.node_id}
                    onClick={() => handleNodeSelect(node.node_id)}
                    style={{ padding: '0.75rem', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s', border: borderStyle, background: bgStyle }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isOnline ? (
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-emerald)' }} />
                        ) : isDegraded ? (
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-amber)' }} />
                        ) : (
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-red)' }} />
                        )}
                        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-main)' }}>{node.node_id}</span>
                        {node.node_id === 'GATEWAY' && (
                          <span className="badge badge-gray" style={{ fontSize: '0.625rem' }}>ROOT</span>
                        )}
                      </div>
                      <span style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
                        Layer {node.layer}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-2" style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                      <span className="flex items-center gap-1">
                        <Battery size={11} style={{ color: node.battery_percent && node.battery_percent < 20 ? 'var(--accent-red)' : 'var(--accent-emerald)' }} />
                        {node.battery_percent}%
                      </span>
                      {node.parent_id && (
                        <span>To: {node.parent_id}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Selected Node Parameter Lab */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
          {currentNode ? (
            <div className="card p-5 h-full">
              <div className="flex items-start justify-between mb-4 pb-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Sliders size={20} style={{ color: 'var(--accent-primary)' }} /> Configure Node: {currentNode.node_id}
                  </h3>
                  <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: '0.25rem' }} className="flex items-center gap-3">
                    <span>Role: {currentNode.node_id === 'GATEWAY' ? 'Root Coordinator' : 'Routing Node / End Device'}</span>
                    <span>•</span>
                    <span style={{ color: currentNode.status === 'ONLINE' ? 'var(--accent-emerald)' : 'var(--accent-red)' }}>
                      Status: {currentNode.status}
                    </span>
                  </div>
                </div>

                {currentNode.node_id !== 'GATEWAY' && (
                  <div className="flex gap-2">
                    <button
                      onClick={handleToggleOnline}
                      className={`btn btn-sm ${currentNode.status === 'ONLINE' ? 'btn-warning' : 'btn-success'}`}
                    >
                      <Power size={13} /> {currentNode.status === 'ONLINE' ? 'Force Offline' : 'Bring Online'}
                    </button>
                    <button onClick={() => handleDeleteNode(currentNode.node_id)} className="btn-icon" style={{ color: 'var(--accent-red)' }} title="Delete Node">
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>

              {/* Lab Parameters */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 mb-6">
                {/* Routing / Parent */}
                {currentNode.node_id !== 'GATEWAY' && (
                  <div className="space-y-2">
                    <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      <span>Upstream Parent (Routing)</span>
                      <span style={{ color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>{parentSelection}</span>
                    </label>
                    <select
                      value={parentSelection}
                      onChange={(e) => setParentSelection(e.target.value)}
                      className="form-input"
                      style={{ fontSize: '0.75rem' }}
                    >
                      {nodes
                        .filter((n) => n.node_id !== currentNode.node_id)
                        .map((n) => (
                          <option key={n.node_id} value={n.node_id}>
                            {n.node_id} (Layer {n.layer})
                          </option>
                        ))}
                    </select>
                    <p style={{ fontSize: '0.6875rem', color: 'var(--text-dim)' }}>
                      Current active route parent for multi-hop.
                    </p>
                  </div>
                )}

                {/* Battery Override */}
                <div className="space-y-2">
                  <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    <span>Battery Capacity</span>
                    <span style={{ color: batterySlider < 20 ? 'var(--accent-red)' : 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>{batterySlider}%</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={batterySlider}
                    onChange={(e) => setBatterySlider(parseInt(e.target.value, 10))}
                    style={{ width: '100%', height: '6px', background: 'var(--bg-surface-elevated)', borderRadius: '999px', appearance: 'none' }}
                  />
                  <div className="flex justify-between" style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                    <span>Dead (0%)</span>
                    <span>Full (100%)</span>
                  </div>
                </div>

                {/* Signal Strength (RSSI) */}
                <div className="space-y-2">
                  <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    <span>Link Signal Strength (RSSI)</span>
                    <span style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>{rssiSlider} dBm</span>
                  </label>
                  <input
                    type="range"
                    min="-100"
                    max="-30"
                    step="1"
                    value={rssiSlider}
                    onChange={(e) => setRssiSlider(parseInt(e.target.value, 10))}
                    style={{ width: '100%', height: '6px', background: 'var(--bg-surface-elevated)', borderRadius: '999px', appearance: 'none' }}
                  />
                  <div className="flex justify-between" style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                    <span>Weak (-100)</span>
                    <span>Excellent (-30)</span>
                  </div>
                </div>

                {/* Packet Loss */}
                <div className="space-y-2">
                  <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    <span>Link Packet Loss</span>
                    <span style={{ color: lossSlider > 10 ? 'var(--accent-amber)' : 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>{lossSlider}%</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={lossSlider}
                    onChange={(e) => setLossSlider(parseInt(e.target.value, 10))}
                    style={{ width: '100%', height: '6px', background: 'var(--bg-surface-elevated)', borderRadius: '999px', appearance: 'none' }}
                  />
                  <div className="flex justify-between" style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                    <span>Perfect (0%)</span>
                    <span>Total Drop (100%)</span>
                  </div>
                </div>

                {/* Latency */}
                <div className="space-y-2">
                  <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    <span>Processing & Queue Latency</span>
                    <span style={{ color: latencySlider > 100 ? 'var(--accent-amber)' : 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>{latencySlider} ms</span>
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="500"
                    step="5"
                    value={latencySlider}
                    onChange={(e) => setLatencySlider(parseInt(e.target.value, 10))}
                    style={{ width: '100%', height: '6px', background: 'var(--bg-surface-elevated)', borderRadius: '999px', appearance: 'none' }}
                  />
                  <div className="flex justify-between" style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                    <span>Fast (5ms)</span>
                    <span>Congested (500ms)</span>
                  </div>
                </div>
              </div>

              <div className="mt-auto pt-4 flex gap-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <button onClick={handleApplySliders} className="btn btn-primary">
                  Apply Node Parameters
                </button>
                <button onClick={handleRestoreNode} className="btn btn-sm">
                  <Heart size={14} style={{ color: 'var(--accent-emerald)' }} /> Restore Health
                </button>
                <button onClick={handleTriggerHeartbeat} className="btn btn-sm">
                  <Wifi size={14} style={{ color: 'var(--accent-primary)' }} /> Send Ping
                </button>
              </div>
            </div>
          ) : (
            <div className="card h-full flex flex-col items-center justify-center p-12 text-center">
              <Cpu size={48} style={{ color: 'var(--border-strong)', marginBottom: '1rem' }} />
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-main)' }}>No Node Selected</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Select a mesh node from the list to view and edit its simulation parameters.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Deploy Node Modal */}
      {showAddNodeModal && (
        <div className="modal-backdrop" onClick={() => setShowAddNodeModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4 pb-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <h3 style={{ fontSize: '1.0625rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Plus size={18} style={{ color: 'var(--accent-primary)' }} /> Deploy Simulated Node
              </h3>
              <button onClick={() => setShowAddNodeModal(false)} className="btn-icon">
                <Trash2 size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateNode} className="space-y-4">
              <div>
                <label className="form-label" style={{ marginBottom: '0.25rem', display: 'block' }}>Node Identifier (Unique)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. EM-10"
                  className="form-input"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}
                  value={newNodeId}
                  onChange={(e) => setNewNodeId(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label" style={{ marginBottom: '0.25rem', display: 'block' }}>Initial Parent Node</label>
                <select
                  required
                  className="form-input"
                  style={{ fontSize: '0.8125rem' }}
                  value={newNodeParent}
                  onChange={(e) => setNewNodeParent(e.target.value)}
                >
                  {nodes.map((n) => (
                    <option key={n.node_id} value={n.node_id}>
                      {n.node_id} (Layer {n.layer})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label" style={{ marginBottom: '0.25rem', display: 'block' }}>Starting Battery (%)</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  required
                  className="form-input"
                  style={{ fontSize: '0.8125rem' }}
                  value={newNodeBattery}
                  onChange={(e) => setNewNodeBattery(parseInt(e.target.value, 10))}
                />
              </div>

              <div className="flex justify-end gap-2 mt-2 pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <button type="button" onClick={() => setShowAddNodeModal(false)} className="btn">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Deploy to Mesh
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
