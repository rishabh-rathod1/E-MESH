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

  const targetRouteNode = topology.nodes.find((n) => n.node_id === selectedRouteNodeId);
  const activeRoutePath = targetRouteNode ? targetRouteNode.current_route : [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Network size={20} className="text-primary" />
            <h2 className="text-xl font-bold text-main leading-tight">Mesh Topology</h2>
          </div>
          <p className="text-sm text-muted mt-1">
            Real-time tree matrix and self-healing route paths
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-sm bg-surface-elevated border border-subtle text-xs font-mono">
            <Layers size={14} className="text-primary" />
            <span className="text-muted">Tree Depth: <strong className="text-main">{topology.max_depth} Layers</strong></span>
          </div>

          <button onClick={loadData} disabled={loading} className="btn">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh Map
          </button>
        </div>
      </div>

      {/* Illustrative Route Path Tracer */}
      <div className="widget" style={{ borderLeft: '3px solid var(--accent-emerald)', background: 'rgba(136, 179, 148, 0.04)' }}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-sm bg-emerald/10 text-emerald">
              <Route size={16} />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-muted font-mono">
                Active Multi-Hop Route Simulation
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="badge badge-outline">Client App</span>
                <ChevronRight size={14} className="text-muted" />
                {activeRoutePath.length > 0 ? (
                  activeRoutePath.map((nid, i) => (
                    <React.Fragment key={nid}>
                      <span className={`badge ${nid === 'GATEWAY' ? 'bg-primary text-white' : 'badge-outline'}`}>
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
            <span className="text-xs font-mono text-muted">Trace Origin:</span>
            <select
              value={selectedRouteNodeId}
              onChange={(e) => setSelectedRouteNodeId(e.target.value)}
              className="form-select text-xs py-1 px-2"
              style={{ width: '140px' }}
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* SVG Mesh Canvas */}
        <div className="lg:col-span-8">
          <div className="widget h-full p-0 overflow-hidden relative" style={{ minHeight: '560px' }}>
            <div className="absolute inset-0 opacity-40 pointer-events-none" style={{
              backgroundImage: 'radial-gradient(var(--border-subtle) 1px, transparent 1px)',
              backgroundSize: '24px 24px'
            }} />
            
            <div className="absolute left-4 top-4 flex flex-col gap-24 pointer-events-none opacity-50 font-mono text-xs text-muted font-bold">
              <div>LAYER 1 • ROOT GATEWAY</div>
              <div>LAYER 2 • RELAYS</div>
              <div>LAYER 3 • LEAF NODES</div>
            </div>

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
                    <text
                      x={(srcPos.x + tgtPos.x) / 2}
                      y={(srcPos.y + tgtPos.y) / 2 - 6}
                      fill={isRouteHighlighted ? 'var(--accent-emerald)' : 'var(--text-dim)'}
                      fontSize="10"
                      fontFamily="var(--font-mono)"
                      textAnchor="middle"
                      className="pointer-events-none"
                    >
                      {link.rssi} dBm
                    </text>
                  </g>
                );
              })}

              {/* Render Nodes */}
              {topology.nodes.map((node) => {
                const pos = nodePositions.get(node.node_id);
                if (!pos) return null;

                const isRoot = node.node_id === topology.root_id;
                const isSelected = selectedNode?.node_id === node.node_id;
                const inRoute = activeRoutePath.includes(node.node_id);

                let fillColor = 'var(--bg-surface)';
                let strokeColor = 'var(--border-strong)';
                if (isRoot) strokeColor = 'var(--accent-primary)';
                if (inRoute) strokeColor = 'var(--accent-emerald)';

                if (node.status === 'DEGRADED') strokeColor = 'var(--accent-amber)';
                if (node.status === 'OFFLINE') strokeColor = 'var(--accent-red)';

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
                      fill={fillColor}
                      stroke={strokeColor}
                      strokeWidth={isSelected ? 4 : 2}
                      className="transition-all"
                    />
                    {isRoot && (
                      <circle r={28} fill="none" stroke="var(--accent-primary)" strokeWidth="1" strokeDasharray="4,4" className="animate-spin" style={{ animationDuration: '10s' }} />
                    )}
                    <text
                      y={4}
                      fill={strokeColor}
                      fontSize={16}
                      fontFamily="var(--font-sans)"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="font-bold pointer-events-none"
                    >
                      {isRoot ? 'G' : 'N'}
                    </text>
                    <rect x="-24" y="24" width="48" height="18" rx="4" fill="var(--bg-card)" stroke="var(--border-subtle)" strokeWidth="1" />
                    <text
                      y={36}
                      fill="var(--text-main)"
                      fontSize="9"
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

                <div className="flex items-center justify-between mb-6 bg-surface-elevated p-3 border border-subtle rounded-sm">
                  <div>
                    <div className="text-xs text-muted uppercase tracking-widest font-bold mb-1">Hardware ID</div>
                    <div className="text-lg font-mono text-main font-bold">{selectedNode.node_id}</div>
                  </div>
                  <span className={`badge ${selectedNode.status === 'ONLINE' ? 'bg-emerald text-white' : 'bg-red text-white'}`}>
                    {selectedNode.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="p-3 border border-subtle rounded-sm bg-surface">
                    <div className="flex items-center gap-2 text-muted mb-2"><Layers size={14}/> <span className="text-xs font-semibold">Tree Layer</span></div>
                    <div className="text-xl font-mono text-main">{selectedNode.layer}</div>
                  </div>
                  <div className="p-3 border border-subtle rounded-sm bg-surface">
                    <div className="flex items-center gap-2 text-muted mb-2"><Route size={14}/> <span className="text-xs font-semibold">Hop Count</span></div>
                    <div className="text-xl font-mono text-main">{selectedNode.hop_count}</div>
                  </div>
                  <div className="p-3 border border-subtle rounded-sm bg-surface">
                    <div className="flex items-center gap-2 text-muted mb-2"><Battery size={14}/> <span className="text-xs font-semibold">Battery</span></div>
                    <div className="text-xl font-mono text-main">{selectedNode.battery_level}%</div>
                  </div>
                  <div className="p-3 border border-subtle rounded-sm bg-surface">
                    <div className="flex items-center gap-2 text-muted mb-2"><Activity size={14}/> <span className="text-xs font-semibold">Last Seen</span></div>
                    <div className="text-xs font-mono text-main truncate" title={selectedNode.last_seen}>{new Date(selectedNode.last_seen).toLocaleTimeString()}</div>
                  </div>
                </div>

                <div className="mt-auto pt-4 border-t border-subtle">
                  <div className="text-xs font-bold uppercase tracking-widest text-muted mb-2">Simulated Routing Path</div>
                  <div className="flex flex-wrap gap-1 p-2 bg-surface-elevated border border-subtle rounded-sm">
                    {selectedNode.current_route.map((n, i) => (
                      <React.Fragment key={i}>
                        <span className="font-mono text-xs">{n}</span>
                        {i < selectedNode.current_route.length - 1 && <ChevronRight size={12} className="text-dim" />}
                      </React.Fragment>
                    ))}
                  </div>
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
                  <span className={`badge ${selectedLink.status === 'UP' ? 'badge-outline text-emerald' : 'badge-outline text-red'}`}>
                    {selectedLink.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="p-3 border border-subtle rounded-sm bg-surface">
                    <div className="flex items-center gap-2 text-muted mb-2"><Signal size={14}/> <span className="text-xs font-semibold">Signal (RSSI)</span></div>
                    <div className="text-xl font-mono text-main">{selectedLink.rssi} <span className="text-xs">dBm</span></div>
                  </div>
                  <div className="p-3 border border-subtle rounded-sm bg-surface">
                    <div className="flex items-center gap-2 text-muted mb-2"><Zap size={14}/> <span className="text-xs font-semibold">Throughput</span></div>
                    <div className="text-xl font-mono text-main">{selectedLink.throughput_kbps} <span className="text-xs">kbps</span></div>
                  </div>
                </div>
               </div>
            )}

            {!selectedNode && !selectedLink && (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-muted gap-3">
                <Info size={32} className="opacity-20" />
                <div>
                  <div className="font-bold text-sm text-main">Interactive Map</div>
                  <div className="text-xs mt-1">Select any node or link segment on the topology map to inspect its real-time simulated telemetry.</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
