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
            <Cpu size={24} className="text-cyan" />
            <h2 className="text-2xl font-extrabold tracking-tight">ESP-WIFI-MESH SIMULATION CONTROL LAB</h2>
          </div>
          <p className="text-xs text-muted font-mono mt-0.5">
            APPLICATION-LEVEL SIMULATOR • DYNAMIC SELF-HEALING TREE CONTROLS • NO HARDWARE REQUIRED
          </p>
        </div>

        <div className="flex items-center gap-3">
          {actionMessage && (
            <span className="badge badge-success animate-fade-in font-mono text-xs">
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
            <span className="text-muted">Target Protocol</span>
            <div className="text-sm font-bold text-cyan mt-0.5">{networkStatus.protocol_target}</div>
          </div>
          <div className="card p-3">
            <span className="text-muted">Tree Depth</span>
            <div className="text-sm font-bold text-white mt-0.5">{networkStatus.max_tree_depth} Layers</div>
          </div>
          <div className="card p-3">
            <span className="text-muted">Online / Total</span>
            <div className="text-sm font-bold text-emerald-400 mt-0.5">
              {networkStatus.online_nodes} / {networkStatus.total_nodes} Nodes
            </div>
          </div>
          <div className="card p-3">
            <span className="text-muted">Active Tree Links</span>
            <div className="text-sm font-bold text-white mt-0.5">{networkStatus.active_links} Links</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-12 gap-6">
        {/* Node Selector & Quick Actions */}
        <div className="col-span-12 lg:col-span-4">
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-strong">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Network size={16} className="text-cyan" /> Select Mesh Node
              </h3>
              <span className="text-xs text-muted font-mono">{nodes.length} Nodes</span>
            </div>

            <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
              {nodes.map((node) => {
                const isSelected = node.node_id === selectedNodeId;
                const isOnline = node.status === 'ONLINE';
                const isDegraded = node.status === 'DEGRADED';
                return (
                  <div
                    key={node.node_id}
                    onClick={() => handleNodeSelect(node.node_id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-cyan bg-cyan/10'
                        : 'border-strong bg-surface hover:border-muted'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            isOnline ? 'bg-emerald-400' : isDegraded ? 'bg-amber-400' : 'bg-red-400'
                          }`}
                        />
                        <span className="font-mono font-bold text-sm text-white">{node.node_id}</span>
                        {node.node_id === 'GATEWAY' && <span className="badge badge-primary text-[10px]">ROOT</span>}
                      </div>
                      <span className="text-xs text-muted font-mono">Layer {node.layer}</span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted font-mono mt-2">
                      <span>Parent: {node.parent_id || 'None'}</span>
                      <span>{node.battery_percent ? `${node.battery_percent.toFixed(0)}%` : 'Mains'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Node Simulation Parameters Editor */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {currentNode && (
            <div className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b border-strong">
                <div>
                  <div className="flex items-center gap-2">
                    <Sliders size={18} className="text-cyan" />
                    <h3 className="text-base font-bold">Node Simulation Controls: {currentNode.node_id}</h3>
                  </div>
                  <div className="text-xs text-muted font-mono mt-0.5">{currentNode.mac_address}</div>
                </div>

                {/* Status Toggle & Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleToggleOnline}
                    className={`btn btn-sm ${currentNode.status === 'ONLINE' ? 'btn-danger' : 'btn-success'}`}
                  >
                    <Power size={13} /> {currentNode.status === 'ONLINE' ? 'Take Offline' : 'Bring Online'}
                  </button>

                  <button onClick={handleRestoreNode} className="btn btn-sm">
                    <RotateCcw size={13} /> Restore Health
                  </button>

                  <button onClick={handleTriggerHeartbeat} className="btn btn-sm">
                    <Heart size={13} className="text-pink-400" /> Pulse Heartbeat
                  </button>

                  {currentNode.node_id !== 'GATEWAY' && (
                    <button
                      onClick={() => handleDeleteNode(currentNode.node_id)}
                      className="btn btn-sm btn-ghost text-red-400 hover:bg-red-500/20"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Parameter Sliders Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
                {/* Parent Re-Assignment */}
                {currentNode.node_id !== 'GATEWAY' && (
                  <div className="p-3 rounded-lg bg-surface border border-strong md:col-span-2">
                    <label className="text-muted block mb-1.5">Parent Node (Simulate Tree Self-Healing Reconfiguration):</label>
                    <select
                      value={parentSelection}
                      onChange={(e) => setParentSelection(e.target.value)}
                      className="form-input text-xs"
                    >
                      {nodes
                        .filter((n) => n.node_id !== currentNode.node_id)
                        .map((n) => (
                          <option key={n.node_id} value={n.node_id}>
                            {n.node_id} (Layer {n.layer} • {n.status})
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                {/* Battery Slider */}
                <div className="p-3 rounded-lg bg-surface border border-strong">
                  <div className="flex justify-between mb-1">
                    <span className="text-muted">Battery Level:</span>
                    <span className="text-cyan font-bold">{batterySlider}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={batterySlider}
                    onChange={(e) => setBatterySlider(parseInt(e.target.value, 10))}
                    className="w-full"
                  />
                </div>

                {/* RSSI Signal Slider */}
                <div className="p-3 rounded-lg bg-surface border border-strong">
                  <div className="flex justify-between mb-1">
                    <span className="text-muted">RSSI Signal Strength:</span>
                    <span className="text-cyan font-bold">{rssiSlider} dBm</span>
                  </div>
                  <input
                    type="range"
                    min="-95"
                    max="-30"
                    value={rssiSlider}
                    onChange={(e) => setRssiSlider(parseInt(e.target.value, 10))}
                    className="w-full"
                  />
                </div>

                {/* Packet Loss Slider */}
                <div className="p-3 rounded-lg bg-surface border border-strong">
                  <div className="flex justify-between mb-1">
                    <span className="text-muted">Packet Drop Rate:</span>
                    <span className="text-amber-400 font-bold">{lossSlider}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={lossSlider}
                    onChange={(e) => setLossSlider(parseInt(e.target.value, 10))}
                    className="w-full"
                  />
                </div>

                {/* Latency Slider */}
                <div className="p-3 rounded-lg bg-surface border border-strong">
                  <div className="flex justify-between mb-1">
                    <span className="text-muted">Link Latency:</span>
                    <span className="text-white font-bold">{latencySlider} ms</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="500"
                    value={latencySlider}
                    onChange={(e) => setLatencySlider(parseInt(e.target.value, 10))}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <button onClick={handleApplySliders} className="btn btn-sm btn-primary">
                  Apply Node Parameters
                </button>
              </div>
            </div>
          )}

          {/* Link Degradation Injector */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-strong">
              <AlertTriangle size={16} className="text-amber-400" />
              <h3 className="text-sm font-bold">Inject Wireless Link Degradation / Interference</h3>
            </div>

            <form onSubmit={handleDegradeLink} className="grid grid-cols-1 md:grid-cols-4 gap-3 font-mono text-xs">
              <div>
                <label className="text-muted block mb-1">Source Node:</label>
                <select
                  value={linkSrc}
                  onChange={(e) => setLinkSrc(e.target.value)}
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
                <label className="text-muted block mb-1">Target Node:</label>
                <select
                  value={linkDst}
                  onChange={(e) => setLinkDst(e.target.value)}
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
                <label className="text-muted block mb-1">Drop Rate ({linkLoss}%):</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={linkLoss}
                  onChange={(e) => setLinkLoss(parseInt(e.target.value, 10))}
                  className="form-input text-xs"
                />
              </div>

              <div className="flex items-end">
                <button type="submit" className="btn btn-sm btn-warning w-full">
                  Inject Noise
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Deploy Node Modal */}
      {showAddNodeModal && (
        <div className="modal-backdrop">
          <div className="modal-content max-w-md">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Plus size={18} className="text-cyan" /> Deploy Simulated Mesh Node
            </h3>

            <form onSubmit={handleCreateNode} className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-muted mb-1">Node Identifier (e.g. EM-06):</label>
                <input
                  type="text"
                  required
                  placeholder="EM-06"
                  value={newNodeId}
                  onChange={(e) => setNewNodeId(e.target.value)}
                  className="form-input"
                />
              </div>

              <div>
                <label className="block text-muted mb-1">Attach to Parent Node:</label>
                <select
                  value={newNodeParent}
                  onChange={(e) => setNewNodeParent(e.target.value)}
                  className="form-input"
                >
                  {nodes.map((n) => (
                    <option key={n.node_id} value={n.node_id}>
                      {n.node_id} (Layer {n.layer})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-muted mb-1">Initial Battery Level ({newNodeBattery}%):</label>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={newNodeBattery}
                  onChange={(e) => setNewNodeBattery(parseInt(e.target.value, 10))}
                  className="w-full"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddNodeModal(false)} className="btn btn-sm">
                  Cancel
                </button>
                <button type="submit" className="btn btn-sm btn-primary">
                  Deploy Node
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
