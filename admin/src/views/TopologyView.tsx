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
            <Network size={24} style={{ color: 'var(--accent-primary)' }} />
            <h2 style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--text-main)' }}>Mesh Topology Map</h2>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
            Application-level simulation, self-healing tree matrix, and root gateway dispatch
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface border-strong text-xs font-mono" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
            <Layers size={14} style={{ color: 'var(--accent-primary)' }} />
            <span style={{ color: 'var(--text-muted)' }}>Max Tree Depth: <strong style={{ color: 'var(--text-main)' }}>{topology.max_depth} Layers</strong></span>
          </div>

          <button onClick={loadData} disabled={loading} className="btn btn-sm">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh Map
          </button>
        </div>
      </div>

      {/* Illustrative Route Path Tracer */}
      <div className="card mb-6 p-4" style={{ background: 'rgba(136, 179, 148, 0.05)', border: '1px solid rgba(136, 179, 148, 0.3)' }}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div style={{ padding: '0.5rem', borderRadius: '8px', background: 'rgba(136, 179, 148, 0.1)', color: 'var(--accent-emerald)' }}>
              <Route size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Illustrative Multi-Hop Route Path
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="badge badge-gray" style={{ fontSize: '0.625rem' }}>Client App</span>
                <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                {activeRoutePath.length > 0 ? (
                  activeRoutePath.map((nid, i) => (
                    <React.Fragment key={nid}>
                      <span className={`badge ${nid === 'GATEWAY' ? 'badge-primary' : 'badge-gray'}`} style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)' }}>
                        {nid}
                      </span>
                      {i < activeRoutePath.length - 1 && <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />}
                    </React.Fragment>
                  ))
                ) : (
                  <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>No route calculated</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>Trace Origin Node:</span>
            <select
              value={selectedRouteNodeId}
              onChange={(e) => setSelectedRouteNodeId(e.target.value)}
              className="form-input"
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
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
              background: 'radial-gradient(circle at 50% 30%, var(--bg-surface) 0%, var(--bg-body) 100%)',
              minHeight: '540px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--border-strong)',
            }}
          >
            {/* Background Layer Labels */}
            <div className="absolute left-4 top-4 flex flex-col gap-24 pointer-events-none opacity-60 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
              <div>LAYER 1 • ROOT GATEWAY</div>
              <div>LAYER 2 • DIRECT CHILDREN</div>
              <div>LAYER 3 • LEAF RELAY NODES</div>
            </div>

            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" style={{ maxHeight: '520px' }}>
              <defs>
                <linearGradient id="linkActive" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#7189A6" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#7189A6" stopOpacity="0.8" />
                </linearGradient>
                <linearGradient id="linkRoute" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#88B394" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#88B394" stopOpacity="0.9" />
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
                else if (isDown) strokeColor = '#C98282';
                else if (isDegraded) strokeColor = '#D8B878';

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
                      fill={isRouteHighlighted ? '#88B394' : '#8A9BA8'}
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

                let fillColor = isOnline ? '#7189A6' : isDegraded ? '#D8B878' : '#C98282';
                if (isRoot) fillColor = '#88B394';

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
                      fill="#FFFFFF"
                      stroke={isSelected ? '#5B7692' : fillColor}
                      strokeWidth={isSelected ? 3 : 2}
                      filter="url(#glow)"
                    />

                    {/* Node Text Label */}
                    <text
                      x={pos.x}
                      y={pos.y + 4}
                      fill={fillColor}
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
                      fill="#8A9BA8"
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
              <div className="flex items-center justify-between mb-4 pb-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center gap-2">
                  <Wifi size={18} style={{ color: 'var(--accent-primary)' }} />
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Link Telemetry</h3>
                </div>
                <span className={`badge ${selectedLink.status === 'ACTIVE' ? 'badge-emerald' : 'badge-red'}`}>
                  {selectedLink.status}
                </span>
              </div>

              <div className="space-y-4 text-xs font-mono">
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Link Pair:</span>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.125rem' }}>
                    {selectedLink.source_node_id} ↔ {selectedLink.target_node_id}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div style={{ padding: '0.625rem', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>RSSI Signal:</span>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--accent-primary)', marginTop: '0.25rem' }}>{selectedLink.rssi_dbm} dBm</div>
                  </div>
                  <div style={{ padding: '0.625rem', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Packet Loss:</span>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.25rem' }}>{selectedLink.packet_loss_percent}%</div>
                  </div>
                  <div style={{ padding: '0.625rem', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Link Latency:</span>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.25rem' }}>{selectedLink.latency_ms.toFixed(1)} ms</div>
                  </div>
                  <div style={{ padding: '0.625rem', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Last Update:</span>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.25rem' }}>
                      {selectedLink.last_update ? new Date(selectedLink.last_update).toLocaleTimeString() : 'Live'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : selectedNode ? (
            /* Node Details Inspector */
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4 pb-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <div>
                  <div className="flex items-center gap-2">
                    <Cpu size={18} style={{ color: 'var(--accent-primary)' }} />
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>{selectedNode.node_id}</h3>
                    {selectedNode.layer === 1 && <span className="badge badge-primary">ROOT</span>}
                  </div>
                  <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: '0.125rem' }}>{selectedNode.mac_address}</div>
                </div>
                <span
                  className={`badge ${
                    selectedNode.status === 'ONLINE'
                      ? 'badge-emerald'
                      : selectedNode.status === 'DEGRADED'
                      ? 'badge-amber'
                      : 'badge-red'
                  }`}
                >
                  {selectedNode.status}
                </span>
              </div>

              <div className="space-y-3\.5 text-xs font-mono">
                <div className="grid grid-cols-2 gap-3">
                  <div style={{ padding: '0.625rem', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Tree Layer / Depth:</span>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--accent-primary)', marginTop: '0.25rem' }}>Layer {selectedNode.layer}</div>
                  </div>
                  <div style={{ padding: '0.625rem', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Parent Node:</span>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.25rem' }}>{selectedNode.parent_id || 'None (Root)'}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div style={{ padding: '0.625rem', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Battery Level:</span>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.25rem' }} className="flex items-center gap-1">
                      <Battery size={14} style={{ color: 'var(--accent-emerald)' }} />
                      {selectedNode.battery_percent !== null && selectedNode.battery_percent !== undefined
                        ? `${selectedNode.battery_percent.toFixed(1)}%`
                        : 'Mains Power'}
                    </div>
                  </div>
                  <div style={{ padding: '0.625rem', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Packet Loss:</span>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.25rem' }}>{selectedNode.packet_loss_percent}%</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div style={{ padding: '0.625rem', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Packets RX / TX:</span>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.25rem' }}>
                      {selectedNode.packets_received} / {selectedNode.packets_transmitted}
                    </div>
                  </div>
                  <div style={{ padding: '0.625rem', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Uptime:</span>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.25rem' }}>
                      {Math.floor(selectedNode.uptime_seconds / 60)}m {selectedNode.uptime_seconds % 60}s
                    </div>
                  </div>
                </div>

                <div style={{ padding: '0.625rem', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Direct Children ({selectedNode.children.length}):</span>
                  <div className="flex flex-wrap gap-1\.5 mt-1\.5">
                    {selectedNode.children.length > 0 ? (
                      selectedNode.children.map((c) => (
                        <span key={c} className="badge badge-gray" style={{ fontSize: '0.625rem' }}>
                          {c}
                        </span>
                      ))
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Leaf Node (No children)</span>
                    )}
                  </div>
                </div>

                <div style={{ padding: '0.625rem', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Upstream Route to Root:</span>
                  <div className="flex items-center gap-1\.5 mt-1\.5 flex-wrap">
                    {selectedNode.current_route.map((hop, i) => (
                      <React.Fragment key={hop}>
                        <span className="badge badge-primary" style={{ fontSize: '0.625rem' }}>{hop}</span>
                        {i < selectedNode.current_route.length - 1 && <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="card p-6 text-center" style={{ color: 'var(--text-muted)' }}>
              <Info size={32} className="mx-auto mb-2 opacity-50" />
              <p style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>Select a node or wireless link on the map to inspect telemetry</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
