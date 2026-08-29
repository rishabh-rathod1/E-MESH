import React, { useEffect, useState } from 'react';
import {
  Activity,
  Battery,
  ChevronRight,
  Cpu,
  Info,
  Layers,
  Network,
  Radio,
  RefreshCw,
  Route,
  Signal,
  Wifi,
  Zap,
} from 'lucide-react';
import { api } from '../api/client';
import { SimulatedLink, SimulatedNode, SimulationTopology } from '../api/types';
import { useMeshEvent } from '../api/ws';

export const TopologyView: React.FC = () => {
  const [topology, setTopology] = useState<SimulationTopology>({
    root_id: 'GATEWAY',
    nodes: [],
    links: [],
    max_depth: 1,
  });
  const [selectedNode, setSelectedNode] = useState<SimulatedNode | null>(null);
  const [selectedLink, setSelectedLink] = useState<SimulatedLink | null>(null);
  const [selectedRouteNodeId, setSelectedRouteNodeId] = useState<string>('EM-04');
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.getSimulationTopology();
      setTopology(data);
      if (data.nodes.length > 0) {
        // Keep selected node updated or pick first
        if (selectedNode) {
          const updated = data.nodes.find((n) => n.node_id === selectedNode.node_id);
          if (updated) setSelectedNode(updated);
        } else {
          setSelectedNode(data.nodes[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load topology', err);
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
  useMeshEvent('route.changed', () => loadData());

  // ── Hierarchical Tree Layout Positioning ──────────────────────────────────
  const width = 800;
  const height = 520;
  const nodePositions = new Map<string, { x: number; y: number }>();

  // Group nodes by layer
  const layersMap: Record<number, SimulatedNode[]> = {};
  topology.nodes.forEach((node) => {
    const layer = node.layer || 1;
    if (!layersMap[layer]) layersMap[layer] = [];
    layersMap[layer].push(node);
  });

  const totalLayers = Math.max(1, topology.max_depth || 1);
  const layerHeight = totalLayers > 1 ? (height - 140) / (totalLayers - 1) : 0;

  Object.entries(layersMap).forEach(([layerStr, layerNodes]) => {
    const layerNum = parseInt(layerStr, 10);
    const y = 80 + (layerNum - 1) * layerHeight;
    const count = layerNodes.length;

    layerNodes.forEach((node, idx) => {
      const step = width / (count + 1);
      const x = (idx + 1) * step;
      nodePositions.set(node.node_id, { x, y });
    });
  });

  // Calculate active route path for highlight
  const targetRouteNode = topology.nodes.find((n) => n.node_id === selectedRouteNodeId);
  const activeRoutePath = targetRouteNode ? targetRouteNode.current_route : [];

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Network size={24} className="text-cyan" />
            <h2 className="text-2xl font-extrabold tracking-tight">ESP-WIFI-MESH TOPOLOGY & TREE HIERARCHY</h2>
          </div>
          <p className="text-xs text-muted font-mono mt-0.5">
            APPLICATION-LEVEL SIMULATION • SELF-HEALING TREE MATRIX • ROOT GATEWAY DISPATCH
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface border border-strong text-xs font-mono">
            <Layers size={14} className="text-cyan" />
            <span>Max Tree Depth: <strong className="text-white">{topology.max_depth} Layers</strong></span>
          </div>

          <button onClick={loadData} disabled={loading} className="btn btn-sm">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh Map
          </button>
        </div>
      </div>

      {/* Illustrative Route Path Tracer */}
      <div className="card mb-6 p-4" style={{ background: 'linear-gradient(135deg, rgba(14,23,38,0.95), rgba(6,78,59,0.2))' }}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
              <Route size={18} />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-muted font-mono">
                Illustrative Multi-Hop Route Path (Application-Level Metadata)
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="badge badge-subtle">Client (Civilian App)</span>
                <ChevronRight size={14} className="text-muted" />
                {activeRoutePath.length > 0 ? (
                  activeRoutePath.map((nid, i) => (
                    <React.Fragment key={nid}>
                      <span className={`badge ${nid === 'GATEWAY' ? 'badge-primary' : 'badge-subtle font-mono'}`}>
                        {nid}
                      </span>
                      {i < activeRoutePath.length - 1 && <ChevronRight size={14} className="text-muted" />}
                    </React.Fragment>
                  ))
                ) : (
                  <span className="text-xs font-mono text-muted">No route calculated</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted font-mono">Trace Origin Node:</span>
            <select
              value={selectedRouteNodeId}
              onChange={(e) => setSelectedRouteNodeId(e.target.value)}
              className="px-2.5 py-1 rounded bg-bg border border-strong text-xs font-mono text-white"
            >
              {topology.nodes.map((n) => (
                <option key={n.node_id} value={n.node_id}>
                  {n.node_id} (Layer {n.layer})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* SVG Mesh Canvas */}
        <div className="col-span-12 lg:col-span-8">
          <div
            className="card relative overflow-hidden"
            style={{
              background: 'radial-gradient(circle at 50% 30%, #152033 0%, #0c121e 100%)',
              minHeight: '540px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--border-strong)',
            }}
          >
            {/* Background Layer Labels */}
            <div className="absolute left-4 top-4 flex flex-col gap-24 pointer-events-none opacity-40 font-mono text-xs text-muted">
              <div>LAYER 1 • ROOT GATEWAY</div>
              <div>LAYER 2 • DIRECT CHILDREN</div>
              <div>LAYER 3 • LEAF RELAY NODES</div>
            </div>

            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" style={{ maxHeight: '520px' }}>
              <defs>
                <linearGradient id="linkActive" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.8" />
                </linearGradient>
                <linearGradient id="linkRoute" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity="0.9" />
                </linearGradient>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="glow" />
                  <feComposite in="SourceGraphic" in2="glow" operator="over" />
                </filter>
              </defs>

              {/* Render Links */}
              {topology.links.map((link) => {
                const srcPos = nodePositions.get(link.source_node_id);
                const tgtPos = nodePositions.get(link.target_node_id);
                if (!srcPos || !tgtPos) return null;

                const isRouteHighlighted =
                  activeRoutePath.includes(link.source_node_id) &&
                  activeRoutePath.includes(link.target_node_id);

                const isDown = link.status === 'DOWN';
                const isDegraded = link.status === 'DEGRADED';

                let strokeColor = 'url(#linkActive)';
                if (isRouteHighlighted) strokeColor = 'url(#linkRoute)';
                else if (isDown) strokeColor = '#ef4444';
                else if (isDegraded) strokeColor = '#f59e0b';

                return (
                  <g key={`${link.source_node_id}-${link.target_node_id}`}>
                    <line
                      x1={srcPos.x}
                      y1={srcPos.y}
                      x2={tgtPos.x}
                      y2={tgtPos.y}
                      stroke={strokeColor}
                      strokeWidth={isRouteHighlighted ? 3.5 : isDegraded ? 2 : 2}
                      strokeDasharray={isDown ? '4,4' : isDegraded ? '6,3' : 'none'}
                      strokeOpacity={isDown ? 0.4 : 0.9}
                      className="transition-all duration-300 cursor-pointer hover:opacity-100"
                      onClick={() => {
                        setSelectedLink(link);
                        setSelectedNode(null);
                      }}
                    />
                    {/* RSSI Tag midway */}
                    <text
                      x={(srcPos.x + tgtPos.x) / 2}
                      y={(srcPos.y + tgtPos.y) / 2 - 6}
                      fill={isRouteHighlighted ? '#f59e0b' : '#94a3b8'}
                      fontSize="9"
                      fontFamily="monospace"
                      textAnchor="middle"
                      className="pointer-events-none"
                    >
                      {link.rssi_dbm} dBm
                    </text>
                  </g>
                );
              })}

              {/* Render Nodes */}
              {topology.nodes.map((node) => {
                const pos = nodePositions.get(node.node_id);
                if (!pos) return null;

                const isSelected = selectedNode?.node_id === node.node_id;
                const isRoot = node.node_id === topology.root_id || node.layer === 1;
                const isOnline = node.status === 'ONLINE';
                const isDegraded = node.status === 'DEGRADED';

                let fillColor = isOnline ? '#06b6d4' : isDegraded ? '#f59e0b' : '#ef4444';
                if (isRoot) fillColor = '#10b981';

                return (
                  <g
                    key={node.node_id}
                    className="cursor-pointer"
                    onClick={() => {
                      setSelectedNode(node);
                      setSelectedLink(null);
                    }}
                  >
                    {/* Pulse ring for selected / root */}
                    {(isSelected || isRoot) && (
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={isRoot ? 32 : 26}
                        fill="none"
                        stroke={fillColor}
                        strokeWidth="1.5"
                        strokeOpacity="0.4"
                        className="animate-ping"
                        style={{ transformOrigin: `${pos.x}px ${pos.y}px` }}
                      />
                    )}

                    {/* Outer Circle */}
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={isRoot ? 24 : 18}
                      fill="#0f172a"
                      stroke={isSelected ? '#38bdf8' : fillColor}
                      strokeWidth={isSelected ? 3 : 2}
                      filter="url(#glow)"
                    />

                    {/* Node Text Label */}
                    <text
                      x={pos.x}
                      y={pos.y + 4}
                      fill="#ffffff"
                      fontSize={isRoot ? '10' : '9'}
                      fontWeight="bold"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      {node.node_id}
                    </text>

                    {/* Layer & Battery Subtext */}
                    <text
                      x={pos.x}
                      y={pos.y + (isRoot ? 36 : 28)}
                      fill="#94a3b8"
                      fontSize="9"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      L{node.layer} {node.battery_percent ? `• ${node.battery_percent.toFixed(0)}%` : '• Mains'}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Details Inspector Sidebar */}
        <div className="col-span-12 lg:col-span-4">
          {selectedLink ? (
            /* Link Details Inspector */
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-strong">
                <div className="flex items-center gap-2">
                  <Wifi size={18} className="text-cyan" />
                  <h3 className="text-lg font-bold">Link Telemetry</h3>
                </div>
                <span className={`badge ${selectedLink.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'}`}>
                  {selectedLink.status}
                </span>
              </div>

              <div className="space-y-4 text-xs font-mono">
                <div>
                  <span className="text-muted">Link Pair:</span>
                  <div className="text-sm font-bold text-white mt-0.5">
                    {selectedLink.source_node_id} ↔ {selectedLink.target_node_id}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="p-2.5 rounded-lg bg-surface border border-strong">
                    <span className="text-muted">RSSI Signal:</span>
                    <div className="text-sm font-bold text-cyan mt-1">{selectedLink.rssi_dbm} dBm</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-surface border border-strong">
                    <span className="text-muted">Packet Loss:</span>
                    <div className="text-sm font-bold text-white mt-1">{selectedLink.packet_loss_percent}%</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-surface border border-strong">
                    <span className="text-muted">Link Latency:</span>
                    <div className="text-sm font-bold text-white mt-1">{selectedLink.latency_ms.toFixed(1)} ms</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-surface border border-strong">
                    <span className="text-muted">Last Update:</span>
                    <div className="text-sm font-bold text-white mt-1">
                      {selectedLink.last_update ? new Date(selectedLink.last_update).toLocaleTimeString() : 'Live'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : selectedNode ? (
            /* Node Details Inspector */
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-strong">
                <div>
                  <div className="flex items-center gap-2">
                    <Cpu size={18} className="text-cyan" />
                    <h3 className="text-lg font-bold">{selectedNode.node_id}</h3>
                    {selectedNode.layer === 1 && <span className="badge badge-primary">ROOT</span>}
                  </div>
                  <div className="text-xs text-muted font-mono mt-0.5">{selectedNode.mac_address}</div>
                </div>
                <span
                  className={`badge ${
                    selectedNode.status === 'ONLINE'
                      ? 'badge-success'
                      : selectedNode.status === 'DEGRADED'
                      ? 'badge-warning'
                      : 'badge-danger'
                  }`}
                >
                  {selectedNode.status}
                </span>
              </div>

              <div className="space-y-3.5 text-xs font-mono">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-2.5 rounded-lg bg-surface border border-strong">
                    <span className="text-muted">Tree Layer / Depth:</span>
                    <div className="text-sm font-bold text-cyan mt-1">Layer {selectedNode.layer}</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-surface border border-strong">
                    <span className="text-muted">Parent Node:</span>
                    <div className="text-sm font-bold text-white mt-1">{selectedNode.parent_id || 'None (Root)'}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-2.5 rounded-lg bg-surface border border-strong">
                    <span className="text-muted">Battery Level:</span>
                    <div className="text-sm font-bold text-white mt-1 flex items-center gap-1">
                      <Battery size={14} className="text-emerald-400" />
                      {selectedNode.battery_percent !== null && selectedNode.battery_percent !== undefined
                        ? `${selectedNode.battery_percent.toFixed(1)}%`
                        : 'Mains Power'}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-surface border border-strong">
                    <span className="text-muted">Packet Loss:</span>
                    <div className="text-sm font-bold text-white mt-1">{selectedNode.packet_loss_percent}%</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-2.5 rounded-lg bg-surface border border-strong">
                    <span className="text-muted">Packets RX / TX:</span>
                    <div className="text-sm font-bold text-white mt-1">
                      {selectedNode.packets_received} / {selectedNode.packets_transmitted}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-surface border border-strong">
                    <span className="text-muted">Uptime:</span>
                    <div className="text-sm font-bold text-white mt-1">
                      {Math.floor(selectedNode.uptime_seconds / 60)}m {selectedNode.uptime_seconds % 60}s
                    </div>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-surface border border-strong">
                  <span className="text-muted">Direct Children ({selectedNode.children.length}):</span>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {selectedNode.children.length > 0 ? (
                      selectedNode.children.map((c) => (
                        <span key={c} className="badge badge-subtle">
                          {c}
                        </span>
                      ))
                    ) : (
                      <span className="text-muted italic">Leaf Node (No children)</span>
                    )}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-surface border border-strong">
                  <span className="text-muted">Upstream Route to Root:</span>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {selectedNode.current_route.map((hop, i) => (
                      <React.Fragment key={hop}>
                        <span className="badge badge-primary">{hop}</span>
                        {i < selectedNode.current_route.length - 1 && <ChevronRight size={12} className="text-muted" />}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="card p-6 text-center text-muted">
              <Info size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-xs font-mono">Select a node or wireless link on the map to inspect telemetry</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
