import React, { useEffect, useState } from 'react';
import {
  Edit2,
  MapPin,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react';
import { api } from '../api/client';
import { Responder, ResponderStatus, User as UserType } from '../api/types';

export const RespondersView: React.FC = () => {
  const [responders, setResponders] = useState<Responder[]>([]);
  const [availableUsers, setAvailableUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Form
  const [selectedUserId, setSelectedUserId] = useState('');
  const [team, setTeam] = useState('Medical Rapid Response');
  const [zone, setZone] = useState('Zone Alpha (North)');

  const loadData = async () => {
    setLoading(true);
    try {
      const [respData, usersData] = await Promise.all([
        api.getResponders({ page_size: 100 }),
        api.getUsers({ page_size: 100 }),
      ]);
      setResponders(respData.data);
      setAvailableUsers(usersData.data);
    } catch (err) {
      console.error('Failed to load responders', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateResponder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    setActionLoading(true);
    try {
      await api.createResponder({
        user_id: selectedUserId,
        team,
        zone,
      });
      setShowAddModal(false);
      setSelectedUserId('');
      await loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusChange = async (id: string, status: ResponderStatus) => {
    try {
      await api.updateResponder(id, { status });
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteResponder = async (id: string) => {
    if (!confirm('Remove responder from field roster?')) return;
    try {
      await api.deleteResponder(id);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">FIELD RESPONDER ROSTER & DEPLOYMENT</h2>
          <p className="text-xs text-muted font-mono mt-0.5">
            DISPATCH TEAMS • EMERGENCY ROLES • OPERATIONAL READINESS
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setShowAddModal(true)} className="btn btn-sm btn-primary">
            <Plus size={14} /> Enlist Responder
          </button>
          <button onClick={loadData} disabled={loading} className="btn btn-sm">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Responders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {responders.length === 0 ? (
          <div className="col-span-12 card text-center py-12 text-muted">
            No responders currently enlisted. Click "Enlist Responder" to assign users to emergency teams.
          </div>
        ) : (
          responders.map((resp) => {
            const statusColor =
              resp.status === 'AVAILABLE'
                ? 'badge-emerald'
                : resp.status === 'ASSIGNED' || resp.status === 'DEPLOYED'
                ? 'badge-blue'
                : resp.status === 'RESPONDING' || resp.status === 'BUSY'
                ? 'badge-amber'
                : 'badge-gray';

            return (
              <div key={resp.id} className="card flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2" style={{ background: 'rgba(59, 130, 246, 0.15)', borderRadius: '8px' }}>
                        <Shield size={20} className="text-blue" />
                      </div>
                      <div>
                        <div className="font-bold text-base">{resp.user?.full_name || resp.user?.username || 'Unknown'}</div>
                        <div className="text-xs text-muted">@{resp.user?.username || resp.user_id.slice(0, 8)}</div>
                      </div>
                    </div>
                    <span className={`badge ${statusColor}`}>{resp.status}</span>
                  </div>

                  <div className="mt-4 space-y-2 text-xs">
                    <div className="flex items-center gap-1.5 text-main">
                      <Users size={14} className="text-cyan" />
                      <span><strong>Team:</strong> {resp.team || 'Unassigned'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-main">
                      <MapPin size={14} className="text-amber" />
                      <span><strong>Zone:</strong> {resp.zone || 'General Mesh Area'}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <select
                    className="form-select text-xs"
                    style={{ width: 'auto', padding: '0.25rem 0.5rem' }}
                    value={resp.status}
                    onChange={(e) => handleStatusChange(resp.id, e.target.value as ResponderStatus)}
                  >
                    <option value="AVAILABLE">AVAILABLE</option>
                    <option value="ASSIGNED">ASSIGNED</option>
                    <option value="RESPONDING">RESPONDING</option>
                    <option value="UNAVAILABLE">UNAVAILABLE</option>
                    <option value="DEPLOYED">DEPLOYED</option>
                    <option value="BUSY">BUSY</option>
                    <option value="RESTING">RESTING</option>
                    <option value="OFFLINE">OFFLINE</option>
                  </select>

                  <button onClick={() => handleDeleteResponder(resp.id)} className="btn-icon text-red" title="Remove Responder">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-3 mb-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <h3 className="text-base font-bold flex items-center gap-2">
                <Shield size={18} className="text-blue" /> Enlist User as Field Responder
              </h3>
              <button onClick={() => setShowAddModal(false)} className="btn-icon"><X size={18} /></button>
            </div>

            <form onSubmit={handleCreateResponder}>
              <div className="form-group">
                <label className="form-label">Select User Account</label>
                <select
                  required
                  className="form-select text-xs"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                >
                  <option value="">Choose a registered user...</option>
                  {availableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} (@{u.username}) — Role: {u.role}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Team Assignment</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rapid Medical Unit, Hazmat, Search & Rescue"
                  className="form-input text-xs"
                  value={team}
                  onChange={(e) => setTeam(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Operational Zone</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Zone Alpha - North Hospital Perimeter"
                  className="form-input text-xs"
                  value={zone}
                  onChange={(e) => setZone(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 mt-4 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-sm">Cancel</button>
                <button type="submit" disabled={actionLoading || !selectedUserId} className="btn btn-sm btn-primary">
                  {actionLoading ? 'Enlisting...' : 'Enlist Responder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
