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
import { HardwareLink, HardwareNode, HardwareTopology } from '../api/types';
import { useMeshEvent } from '../api/ws';

const EMPTY_TOPOLOGY: HardwareTopology = {
  root_id: '',
  nodes: [],
  links: [],
  max_depth: 1,
};

export const TopologyView: React.FC = () => {
  const [topology, setTopology] = useState<HardwareTopology>(EMPTY_TOPOLOGY);
  const [selectedNode, setSelectedNode] = useState<HardwareNode | null>(null);
  const [selectedLink, setSelectedLink] = useState<HardwareLink | null>(null);
  const [selectedRouteNodeId, setSelectedRouteNodeId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getTopology();
      setTopology(data);
      if (data.nodes.length > 0) {
        // Update selected node with fresh data if it was already selected
        if (selectedNode) {
          const updated = data.nodes.find((n) => n.node_id === selectedNode.node_id);
          if (updated) setSelectedNode(updated);
        } else {
          // Auto-select gateway or first node
          const gw = data.nodes.find((n) => n.is_gateway) ?? data.nodes[0];
          setSelectedNode(gw);
        }
        // Keep route-trace dropdown pointing at a valid node
        if (!selectedRouteNodeId || !data.nodes.find((n) => n.node_id === selectedRouteNodeId)) {
          setSelectedRouteNodeId(data.nodes[0].node_id);
        }
      } else {
        setSelectedNode(null);
      }
    } catch (err: any) {
      console.error('Failed to load topology', err);
      setError(err?.message ?? 'Failed to load topology');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Real-time map refresh on any node/topology event
  useMeshEvent('topology.updated', () => loadData());
  useMeshEvent('node.online', () => loadData());
  useMeshEvent('node.offline', () => loadData());
  useMeshEvent('node.updated', () => loadData());
  useMeshEvent('route.changed', () => loadData());

  // ── Hierarchical Tree Layout Positioning ──────────────────────────────────
  const width = 800;
  const height = 520;
  const nodePositions = new Map<string, { x: number; y: number }>();

  const layersMap: Record<number, HardwareNode[]> = {};
  topology.nodes.forEach((node) => {
    const layer = node.layer ?? 1;
    if (!layersMap[layer]) layersMap[layer] = [];
    layersMap[layer].push(node);
  });

  const totalLayers = Math.max(1, topology.max_depth ?? 1);
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

  const targetRouteNode = topology.nodes.find((n) => n.node_id === selectedRouteNodeId);
  const activeRoutePath: string[] = targetRouteNode?.current_route ?? [];

  // ── Status colour helpers ─────────────────────────────────────────────────
  const nodeStrokeColor = (node: HardwareNode, isRoot: boolean, inRoute: boolean) => {
    if (node.status === 'DEGRADED') return 'var(--accent-amber)';
    if (node.status === 'OFFLINE') return 'var(--accent-red)';
    if (inRoute) return 'var(--accent-emerald)';
    if (isRoot) return 'var(--accent-primary)';
    return 'var(--border-strong)';
  };

  const layerLabels: Record<number, string> = {};
  Object.keys(layersMap).forEach((k) => {
    const n = parseInt(k, 10);
    if (n === 1) layerLabels[n] = 'LAYER 1 • ROOT GATEWAY';
    else if (n === totalLayers) layerLabels[n] = `LAYER ${n} • LEAF NODES`;
    else layerLabels[n] = `LAYER ${n} • RELAYS`;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Network size={20} className="text-primary" />
            <h2 className="text-xl font-bold text-main leading-tight">Live Mesh Topology</h2>
          </div>
          <p className="text-sm text-muted mt-1">
            Real hardware nodes — data from connected ESP32 devices
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-sm bg-surface-elevated border border-subtle text-xs font-mono">
            <Layers size={14} className="text-primary" />
            <span className="text-muted">Depth: <strong className="text-main">{topology.max_depth} Layer{topology.max_depth !== 1 ? 's' : ''}</strong></span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-sm bg-surface-elevated border border-subtle text-xs font-mono">
            <Cpu size={14} className="text-emerald" />
            <span className="text-muted">Nodes: <strong className="text-main">{topology.nodes.length}</strong></span>
          </div>
          <button onClick={loadData} disabled={loading} className="btn">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="p-3 rounded-sm bg-red/10 border border-red/30 text-sm text-red font-mono">
          ⚠ {error}
        </div>
      )}

      {/* Diagnostic: all nodes flat (no hop_count from firmware) */}
      {!error && topology.nodes.length > 1 && topology.max_depth === 1 && (
        <div className="p-3 rounded-sm bg-amber/10 border border-amber/30 text-xs font-mono" style={{ borderLeft: '3px solid var(--accent-amber)' }}>
          <strong className="text-amber">⚠ All nodes appear in Layer 1 (flat layout)</strong>
          <span className="text-muted ml-2">
            This means the ESP32 firmware is not sending <code className="bg-surface-elevated px-1 rounded">hop_count</code> in its heartbeat payload, or the server was restarted and nodes need to re-heartbeat.
            Include <code className="bg-surface-elevated px-1 rounded">"hop_count": &lt;layer depth from root&gt;</code> in the <code className="bg-surface-elevated px-1 rounded">POST /api/v1/mesh/nodes</code> body.
            The root gateway should send <code className="bg-surface-elevated px-1 rounded">hop_count: 1</code>, relays <code className="bg-surface-elevated px-1 rounded">2</code>, leaf nodes <code className="bg-surface-elevated px-1 rounded">3</code>, etc.
          </span>
        </div>
      )}

      {/* Route Path Tracer */}
      {topology.nodes.length > 0 && (
        <div className="widget" style={{ borderLeft: '3px solid var(--accent-emerald)', background: 'rgba(136, 179, 148, 0.04)' }}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-sm bg-emerald/10 text-emerald">
                <Route size={16} />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-muted font-mono">
                  Active Multi-Hop Route
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="badge badge-outline">Client App</span>
                  <ChevronRight size={14} className="text-muted" />
                  {activeRoutePath.length > 0 ? (
                    activeRoutePath.map((nid, i) => (
                      <React.Fragment key={nid}>
                        <span className={`badge ${nid === topology.root_id ? 'bg-primary text-white' : 'badge-outline'}`}>
                          {nid}
                        </span>
                        {i < activeRoutePath.length - 1 && <ChevronRight size={14} className="text-muted" />}
                      </React.Fragment>
                    ))
                  ) : (
                    <span className="text-xs font-mono text-muted">No route stored</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-muted">Trace Origin:</span>
              <select
                value={selectedRouteNodeId}
                onChange={(e) => setSelectedRouteNodeId(e.target.value)}
                className="form-select text-xs py-1 px-2"
                style={{ width: '160px' }}
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
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* SVG Mesh Canvas */}
        <div className="lg:col-span-8">
          <div className="widget h-full p-0 overflow-hidden relative" style={{ minHeight: '560px' }}>
            <div className="absolute inset-0 opacity-40 pointer-events-none" style={{
              backgroundImage: 'radial-gradient(var(--border-subtle) 1px, transparent 1px)',
              backgroundSize: '24px 24px'
            }} />

            {/* Layer labels */}
            {topology.nodes.length > 0 && (
              <div className="absolute left-4 top-4 flex flex-col pointer-events-none opacity-50 font-mono text-xs text-muted font-bold" style={{ gap: `${layerHeight}px` }}>
                {Object.entries(layerLabels).map(([k, label]) => (
                  <div key={k}>{label}</div>
                ))}
              </div>
            )}

            {topology.nodes.length === 0 ? (
              /* Empty state */
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center gap-3 text-muted">
                <Network size={48} className="opacity-20" />
                <div>
                  <div className="font-bold text-sm text-main">No Hardware Nodes Connected</div>
                  <div className="text-xs mt-1 max-w-xs">
                    Nodes appear here when ESP32 devices send heartbeats to<br />
                    <code className="font-mono bg-surface-elevated px-1 rounded">POST /api/v1/mesh/nodes</code>
                  </div>
                </div>
                <button onClick={loadData} className="btn btn-sm mt-2">
                  <RefreshCw size={12} /> Check Again
                </button>
              </div>
            ) : (
              <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full relative z-10" style={{ minHeight: '560px' }}>
                <defs>
                  <linearGradient id="linkActive" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--border-strong)" />
                    <stop offset="100%" stopColor="var(--border-strong)" />
                  </linearGradient>
                  <linearGradient id="linkRoute" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--accent-emerald)" />
                    <stop offset="100%" stopColor="var(--accent-emerald)" />
                  </linearGradient>
                  <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="3" refY="2" orient="auto">
                    <polygon points="0 0, 6 2, 0 4" fill="var(--border-strong)" />
                  </marker>
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
                  else if (isDown) strokeColor = 'var(--accent-red)';
                  else if (isDegraded) strokeColor = 'var(--accent-amber)';

                  return (
                    <g key={`${link.source_node_id}-${link.target_node_id}`}>
                      <line
                        x1={srcPos.x}
                        y1={srcPos.y}
                        x2={tgtPos.x}
                        y2={tgtPos.y}
                        stroke={strokeColor}
                        strokeWidth={isRouteHighlighted ? 3 : 2}
                        strokeDasharray={isDown ? '4,4' : isDegraded ? '6,3' : 'none'}
                        strokeOpacity={isDown ? 0.4 : 0.8}
                        className="transition-all cursor-pointer hover:opacity-100"
                        onClick={() => {
                          setSelectedLink(link);
                          setSelectedNode(null);
                        }}
                      />
                      {link.rssi_dbm != null && (
                        <text
                          x={(srcPos.x + tgtPos.x) / 2}
                          y={(srcPos.y + tgtPos.y) / 2 - 6}
                          fill={isRouteHighlighted ? 'var(--accent-emerald)' : 'var(--text-dim)'}
                          fontSize="10"
                          fontFamily="var(--font-mono)"
                          textAnchor="middle"
                          className="pointer-events-none"
                        >
                          {link.rssi_dbm} dBm
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Render Nodes */}
                {topology.nodes.map((node) => {
                  const pos = nodePositions.get(node.node_id);
                  if (!pos) return null;

                  const isRoot = node.node_id === topology.root_id || node.is_gateway;
                  const isSelected = selectedNode?.node_id === node.node_id;
                  const inRoute = activeRoutePath.includes(node.node_id);
                  const stroke = nodeStrokeColor(node, isRoot, inRoute);

                  return (
                    <g
                      key={node.node_id}
                      transform={`translate(${pos.x},${pos.y})`}
                      className="cursor-pointer transition-transform hover:scale-110"
                      onClick={() => {
                        setSelectedNode(node);
                        setSelectedLink(null);
                      }}
                    >
                      <circle
                        r={isSelected ? 22 : 18}
                        fill="var(--bg-surface)"
                        stroke={stroke}
                        strokeWidth={isSelected ? 4 : 2}
                        className="transition-all"
                      />
                      {isRoot && (
                        <circle r={28} fill="none" stroke="var(--accent-primary)" strokeWidth="1" strokeDasharray="4,4" className="animate-spin" style={{ animationDuration: '10s' }} />
                      )}
                      {/* Online pulse */}
                      {node.status === 'ONLINE' && (
                        <circle r={10} fill="var(--accent-emerald)" opacity="0.15" className="animate-ping" />
                      )}
                      <text
                        y={4}
                        fill={stroke}
                        fontSize={14}
                        fontFamily="var(--font-sans)"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="font-bold pointer-events-none"
                      >
                        {isRoot ? 'G' : 'N'}
                      </text>
                      <rect x="-28" y="24" width="56" height="18" rx="4" fill="var(--bg-card)" stroke="var(--border-subtle)" strokeWidth="1" />
                      <text
                        y={36}
                        fill="var(--text-main)"
                        fontSize="8"
                        fontFamily="var(--font-mono)"
                        textAnchor="middle"
                        className="font-bold pointer-events-none"
                      >
                        {node.node_id}
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
        </div>

        {/* Right Detail Panel */}
        <div className="lg:col-span-4 flex flex-col space-y-4">
          <div className="widget flex-1">
            {selectedNode && (
              <div className="animate-in fade-in h-full flex flex-col">
                <div className="widget-header border-b border-subtle pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Cpu size={16} className="text-primary" />
                    <span className="font-bold text-lg leading-none">Node Inspector</span>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-4 bg-surface-elevated p-3 border border-subtle rounded-sm">
                  <div>
                    <div className="text-xs text-muted uppercase tracking-widest font-bold mb-1">Hardware ID</div>
                    <div className="text-lg font-mono text-main font-bold">{selectedNode.node_id}</div>
                    {selectedNode.display_name && selectedNode.display_name !== selectedNode.node_id && (
                      <div className="text-xs text-muted mt-0.5">{selectedNode.display_name}</div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`badge ${
                      selectedNode.status === 'ONLINE' ? 'bg-emerald text-white' :
                      selectedNode.status === 'DEGRADED' ? 'bg-amber text-white' : 'bg-red text-white'
                    }`}>
                      {selectedNode.status}
                    </span>
                    {selectedNode.is_gateway && (
                      <span className="badge badge-outline text-primary text-xs">GATEWAY</span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3 border border-subtle rounded-sm bg-surface">
                    <div className="flex items-center gap-2 text-muted mb-2"><Layers size={14}/> <span className="text-xs font-semibold">Layer</span></div>
                    <div className="text-xl font-mono text-main">{selectedNode.layer ?? '—'}</div>
                  </div>
                  <div className="p-3 border border-subtle rounded-sm bg-surface">
                    <div className="flex items-center gap-2 text-muted mb-2"><Radio size={14}/> <span className="text-xs font-semibold">Neighbours</span></div>
                    <div className="text-xl font-mono text-main">{selectedNode.neighbour_count}</div>
                  </div>
                  <div className="p-3 border border-subtle rounded-sm bg-surface">
                    <div className="flex items-center gap-2 text-muted mb-2"><Battery size={14}/> <span className="text-xs font-semibold">Battery</span></div>
                    <div className="text-xl font-mono text-main">
                      {selectedNode.battery_percent != null ? `${selectedNode.battery_percent.toFixed(0)}%` : 'N/A'}
                    </div>
                  </div>
                  <div className="p-3 border border-subtle rounded-sm bg-surface">
                    <div className="flex items-center gap-2 text-muted mb-2"><Signal size={14}/> <span className="text-xs font-semibold">RSSI</span></div>
                    <div className="text-xl font-mono text-main">
                      {selectedNode.rssi_dbm != null ? `${selectedNode.rssi_dbm} dBm` : 'N/A'}
                    </div>
                  </div>
                  <div className="p-3 border border-subtle rounded-sm bg-surface">
                    <div className="flex items-center gap-2 text-muted mb-2"><Zap size={14}/> <span className="text-xs font-semibold">Pkt Loss</span></div>
                    <div className="text-xl font-mono text-main">{selectedNode.packet_loss_percent.toFixed(1)}%</div>
                  </div>
                  <div className="p-3 border border-subtle rounded-sm bg-surface">
                    <div className="flex items-center gap-2 text-muted mb-2"><Activity size={14}/> <span className="text-xs font-semibold">Heartbeat</span></div>
                    <div className="text-xs font-mono text-main truncate" title={selectedNode.last_heartbeat ?? ''}>
                      {selectedNode.last_heartbeat ? new Date(selectedNode.last_heartbeat).toLocaleTimeString() : 'N/A'}
                    </div>
                  </div>
                </div>

                {/* TX/RX counters */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-2 border border-subtle rounded-sm bg-surface text-center">
                    <div className="text-xs text-muted mb-1">RX Packets</div>
                    <div className="font-mono text-sm text-main">{selectedNode.packet_rx.toLocaleString()}</div>
                  </div>
                  <div className="p-2 border border-subtle rounded-sm bg-surface text-center">
                    <div className="text-xs text-muted mb-1">TX Packets</div>
                    <div className="font-mono text-sm text-main">{selectedNode.packet_tx.toLocaleString()}</div>
                  </div>
                </div>

                <div className="mt-auto pt-4 border-t border-subtle">
                  <div className="text-xs font-bold uppercase tracking-widest text-muted mb-2">Current Route Path</div>
                  {selectedNode.current_route.length > 0 ? (
                    <div className="flex flex-wrap gap-1 p-2 bg-surface-elevated border border-subtle rounded-sm">
                      {selectedNode.current_route.map((n, i) => (
                        <React.Fragment key={i}>
                          <span className="font-mono text-xs">{n}</span>
                          {i < selectedNode.current_route.length - 1 && <ChevronRight size={12} className="text-dim" />}
                        </React.Fragment>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-muted italic p-2 bg-surface-elevated border border-subtle rounded-sm">
                      No route data reported by device
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedLink && !selectedNode && (
               <div className="animate-in fade-in h-full flex flex-col">
                <div className="widget-header border-b border-subtle pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Wifi size={16} className="text-blue" />
                    <span className="font-bold text-lg leading-none">Link Inspector</span>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-6 bg-surface-elevated p-3 border border-subtle rounded-sm">
                  <div className="flex items-center gap-2 font-mono text-sm font-bold">
                    <span className="text-main">{selectedLink.source_node_id}</span>
                    <Radio size={14} className="text-muted" />
                    <span className="text-main">{selectedLink.target_node_id}</span>
                  </div>
                  <span className={`badge ${
                    selectedLink.status === 'ACTIVE' ? 'badge-outline text-emerald' :
                    selectedLink.status === 'DEGRADED' ? 'badge-outline text-amber' : 'badge-outline text-red'
                  }`}>
                    {selectedLink.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="p-3 border border-subtle rounded-sm bg-surface">
                    <div className="flex items-center gap-2 text-muted mb-2"><Signal size={14}/> <span className="text-xs font-semibold">Signal (RSSI)</span></div>
                    <div className="text-xl font-mono text-main">
                      {selectedLink.rssi_dbm != null ? <>{selectedLink.rssi_dbm} <span className="text-xs">dBm</span></> : 'N/A'}
                    </div>
                  </div>
                  <div className="p-3 border border-subtle rounded-sm bg-surface">
                    <div className="flex items-center gap-2 text-muted mb-2"><Zap size={14}/> <span className="text-xs font-semibold">Packet Loss</span></div>
                    <div className="text-xl font-mono text-main">{selectedLink.packet_loss_percent} <span className="text-xs">%</span></div>
                  </div>
                  {selectedLink.latency_ms != null && (
                    <div className="p-3 border border-subtle rounded-sm bg-surface">
                      <div className="flex items-center gap-2 text-muted mb-2"><Activity size={14}/> <span className="text-xs font-semibold">Latency</span></div>
                      <div className="text-xl font-mono text-main">{selectedLink.latency_ms} <span className="text-xs">ms</span></div>
                    </div>
                  )}
                  {selectedLink.last_seen && (
                    <div className="p-3 border border-subtle rounded-sm bg-surface">
                      <div className="flex items-center gap-2 text-muted mb-2"><Activity size={14}/> <span className="text-xs font-semibold">Last Seen</span></div>
                      <div className="text-xs font-mono text-main">{new Date(selectedLink.last_seen).toLocaleTimeString()}</div>
                    </div>
                  )}
                </div>
               </div>
            )}

            {!selectedNode && !selectedLink && (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-muted gap-3">
                <Info size={32} className="opacity-20" />
                <div>
                  <div className="font-bold text-sm text-main">Interactive Map</div>
                  <div className="text-xs mt-1">Select any node or link on the topology map to inspect live telemetry from the hardware.</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
