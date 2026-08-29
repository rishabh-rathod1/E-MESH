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
          <h2 style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--text-main)' }}>Mesh Devices</h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
            Registered wireless ESP32 relay nodes ({nodes.length} total)
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
              <th>Node ID</th>
              <th>Name</th>
              <th>Battery</th>
              <th>Signal</th>
              <th>Hops</th>
              <th>Firmware</th>
              <th>Last Seen</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {nodes.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)' }}>
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
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', fontWeight: 600, fontSize: '0.75rem' }}>{node.node_id}</td>
                    <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>{node.name}</td>
                    <td>
                      <span className="flex items-center gap-1" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--accent-emerald)' }}>
                        <Battery size={13} /> {node.battery_level}%
                      </span>
                    </td>
                    <td>
                      <span className="flex items-center gap-1" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--accent-blue)' }}>
                        <Signal size={13} /> {node.signal_quality}%
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{node.hop_count} Hop{node.hop_count === 1 ? '' : 's'}</td>
                    <td style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{node.firmware_version || 'v1.4.0-esp32'}</td>
                    <td style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
                      {node.last_seen ? new Date(node.last_seen).toLocaleTimeString() : 'Online'}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(node)} className="btn-icon" title="Edit Node">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDeleteNode(node.id, node.name)} className="btn-icon" style={{ color: 'var(--accent-red)' }} title="Decommission Node">
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
            <div className="flex justify-between items-center" style={{ paddingBottom: '0.75rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)' }}>
              <h3 className="flex items-center gap-2" style={{ fontSize: '0.9375rem', fontWeight: 700 }}>
                <Cpu size={17} style={{ color: 'var(--accent-primary)' }} /> Register Mesh Node
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
                  className="form-input"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}
                  value={nodeId}
                  onChange={(e) => setNodeId(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Display Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sector 4 - Water Tower Repeater"
                  className="form-input"
                  style={{ fontSize: '0.8125rem' }}
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
                    className="form-input"
                    style={{ fontSize: '0.8125rem' }}
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
                    className="form-input"
                    style={{ fontSize: '0.8125rem' }}
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
                    className="form-input"
                    style={{ fontSize: '0.8125rem' }}
                    value={hopCount}
                    onChange={(e) => setHopCount(parseInt(e.target.value))}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2" style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
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
            <div className="flex justify-between items-center" style={{ paddingBottom: '0.75rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)' }}>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 700 }}>Configure Node: {editNode.node_id}</h3>
              <button onClick={() => setEditNode(null)} className="btn-icon"><X size={18} /></button>
            </div>

            <form onSubmit={handleUpdateNode}>
              <div className="form-group">
                <label className="form-label">Node Name</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  style={{ fontSize: '0.8125rem' }}
                  value={nodeName}
                  onChange={(e) => setNodeName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Network Status</label>
                <select className="form-select" style={{ fontSize: '0.8125rem' }} value={status} onChange={(e) => setStatus(e.target.value)}>
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
                    className="form-input"
                    style={{ fontSize: '0.8125rem' }}
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
                    className="form-input"
                    style={{ fontSize: '0.8125rem' }}
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
                    className="form-input"
                    style={{ fontSize: '0.8125rem' }}
                    value={hopCount}
                    onChange={(e) => setHopCount(parseInt(e.target.value))}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2" style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
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
