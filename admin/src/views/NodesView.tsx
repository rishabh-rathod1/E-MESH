import React, { useEffect, useState } from 'react';
import {
  Battery,
  Cpu,
  Edit2,
  Plus,
  Radio,
  RefreshCw,
  Signal,
  Trash2,
  X,
} from 'lucide-react';
import { api } from '../api/client';
import { MeshNode } from '../api/types';

export const NodesView: React.FC = () => {
  const [nodes, setNodes] = useState<MeshNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editNode, setEditNode] = useState<MeshNode | null>(null);

  // Form states
  const [nodeId, setNodeId] = useState('');
  const [nodeName, setNodeName] = useState('');
  const [batteryLevel, setBatteryLevel] = useState(100);
  const [signalQuality, setSignalQuality] = useState(90);
  const [hopCount, setHopCount] = useState(1);
  const [status, setStatus] = useState('ONLINE');
  const [actionLoading, setActionLoading] = useState(false);

  const loadNodes = async () => {
    setLoading(true);
    try {
      const resp = await api.getNodes({ page_size: 100 });
      setNodes(resp.data);
    } catch (err) {
      console.error('Failed to load nodes', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNodes();
  }, []);

  const handleCreateNode = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await api.createNode({
        node_id: nodeId,
        name: nodeName,
        battery_level: batteryLevel,
        signal_quality: signalQuality,
        hop_count: hopCount,
      });
      setShowAddModal(false);
      setNodeId('');
      setNodeName('');
      await loadNodes();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateNode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editNode) return;
    setActionLoading(true);
    try {
      await api.updateNode(editNode.id, {
        name: nodeName,
        status,
        battery_level: batteryLevel,
        signal_quality: signalQuality,
        hop_count: hopCount,
      });
      setEditNode(null);
      await loadNodes();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteNode = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to decommission node "${name}"?`)) return;
    try {
      await api.deleteNode(id);
      await loadNodes();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const openEdit = (n: MeshNode) => {
    setEditNode(n);
    setNodeName(n.name);
    setStatus(n.status);
    setBatteryLevel(n.battery_level);
    setSignalQuality(n.signal_quality);
    setHopCount(n.hop_count);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">MESH NODE HARDWARE INVENTORY</h2>
          <p className="text-xs text-muted font-mono mt-0.5">
            REGISTERED WIRELESS ESP32 RELAY NODES ({nodes.length} TOTAL)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setShowAddModal(true)} className="btn btn-sm btn-primary">
            <Plus size={14} /> Register Node
          </button>
          <button onClick={loadNodes} disabled={loading} className="btn btn-sm">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Nodes Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Node Identifier</th>
              <th>Display Name</th>
              <th>Battery</th>
              <th>Signal LQI</th>
              <th>Hop Distance</th>
              <th>Firmware</th>
              <th>Last Seen</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {nodes.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-8 text-muted">
                  No mesh nodes registered. Click "Register Node" to deploy one.
                </td>
              </tr>
            ) : (
              nodes.map((node) => {
                const statusColor =
                  node.status === 'ONLINE'
                    ? 'badge-emerald'
                    : node.status === 'DEGRADED'
                    ? 'badge-amber'
                    : 'badge-red';

                return (
                  <tr key={node.id}>
                    <td><span className={`badge ${statusColor}`}>{node.status}</span></td>
                    <td className="font-mono text-cyan font-semibold text-xs">{node.node_id}</td>
                    <td className="font-bold text-main">{node.name}</td>
                    <td>
                      <span className="flex items-center gap-1 font-mono text-xs text-emerald">
                        <Battery size={13} /> {node.battery_level}%
                      </span>
                    </td>
                    <td>
                      <span className="flex items-center gap-1 font-mono text-xs text-blue">
                        <Signal size={13} /> {node.signal_quality}%
                      </span>
                    </td>
                    <td className="font-mono text-xs">{node.hop_count} Hop{node.hop_count === 1 ? '' : 's'}</td>
                    <td className="text-xs font-mono text-muted">{node.firmware_version || 'v1.4.0-esp32'}</td>
                    <td className="text-xs font-mono text-dim">
                      {node.last_seen ? new Date(node.last_seen).toLocaleTimeString() : 'Online'}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(node)} className="btn-icon" title="Edit Node">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDeleteNode(node.id, node.name)} className="btn-icon text-red" title="Decommission Node">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-3 mb-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <h3 className="text-base font-bold flex items-center gap-2">
                <Cpu size={18} className="text-cyan" /> Register Simulated Mesh Node
              </h3>
              <button onClick={() => setShowAddModal(false)} className="btn-icon"><X size={18} /></button>
            </div>

            <form onSubmit={handleCreateNode}>
              <div className="form-group">
                <label className="form-label">Node Hardware ID (Unique)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. node_05 or ESP32_E4:65:B8:11"
                  className="form-input font-mono text-xs"
                  value={nodeId}
                  onChange={(e) => setNodeId(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Friendly Sector / Placement Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sector 4 - Water Tower Repeater"
                  className="form-input text-xs"
                  value={nodeName}
                  onChange={(e) => setNodeName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="form-group">
                  <label className="form-label">Battery (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="form-input text-xs"
                    value={batteryLevel}
                    onChange={(e) => setBatteryLevel(parseInt(e.target.value))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Signal (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="form-input text-xs"
                    value={signalQuality}
                    onChange={(e) => setSignalQuality(parseInt(e.target.value))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Hops</label>
                  <input
                    type="number"
                    min="1"
                    max="7"
                    className="form-input text-xs"
                    value={hopCount}
                    onChange={(e) => setHopCount(parseInt(e.target.value))}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-sm">Cancel</button>
                <button type="submit" disabled={actionLoading} className="btn btn-sm btn-primary">
                  {actionLoading ? 'Registering...' : 'Deploy Node'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editNode && (
        <div className="modal-backdrop" onClick={() => setEditNode(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-3 mb-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <h3 className="text-base font-bold">Configure Node: {editNode.node_id}</h3>
              <button onClick={() => setEditNode(null)} className="btn-icon"><X size={18} /></button>
            </div>

            <form onSubmit={handleUpdateNode}>
              <div className="form-group">
                <label className="form-label">Node Name</label>
                <input
                  type="text"
                  required
                  className="form-input text-xs"
                  value={nodeName}
                  onChange={(e) => setNodeName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Network Status</label>
                <select className="form-select text-xs" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="ONLINE">ONLINE</option>
                  <option value="DEGRADED">DEGRADED</option>
                  <option value="OFFLINE">OFFLINE</option>
                  <option value="ISOLATED">ISOLATED</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="form-group">
                  <label className="form-label">Battery (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="form-input text-xs"
                    value={batteryLevel}
                    onChange={(e) => setBatteryLevel(parseInt(e.target.value))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Signal (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="form-input text-xs"
                    value={signalQuality}
                    onChange={(e) => setSignalQuality(parseInt(e.target.value))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Hop Count</label>
                  <input
                    type="number"
                    min="1"
                    max="7"
                    className="form-input text-xs"
                    value={hopCount}
                    onChange={(e) => setHopCount(parseInt(e.target.value))}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <button type="button" onClick={() => setEditNode(null)} className="btn btn-sm">Cancel</button>
                <button type="submit" disabled={actionLoading} className="btn btn-sm btn-primary">
                  {actionLoading ? 'Saving...' : 'Update Node'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
