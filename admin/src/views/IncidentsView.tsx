import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Filter,
  RefreshCw,
  Search,
  Shield,
  User,
  X,
} from 'lucide-react';
import { api } from '../api/client';
import { Incident, Responder } from '../api/types';

import { useMeshEvent } from '../api/ws';

export const IncidentsView: React.FC = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [responders, setResponders] = useState<Responder[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  // Selected incident modal
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [assignResponderId, setAssignResponderId] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [incResp, respResp] = await Promise.all([
        api.getIncidents({
          search: search || undefined,
          status: statusFilter || undefined,
          priority: priorityFilter || undefined,
          page_size: 50,
        }),
        api.getResponders({ page_size: 100 }),
      ]);
      setIncidents(incResp.data);
      setTotal(incResp.total);
      setResponders(respResp.data);
    } catch (err) {
      console.error('Failed to load incidents', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, priorityFilter]);

  useMeshEvent('incident.created', () => loadData());
  useMeshEvent('incident.updated', () => loadData());
  useMeshEvent('incident.assigned', () => loadData());
  useMeshEvent('incident.resolved', () => loadData());

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleAcknowledge = async (id: string) => {
    setActionLoading(true);
    try {
      const updated = await api.acknowledgeIncident(id);
      setSelectedIncident(updated);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolve = async (id: string) => {
    setActionLoading(true);
    try {
      const updated = await api.resolveIncident(id, resolutionNotes || undefined);
      setSelectedIncident(updated);
      setResolutionNotes('');
      await loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignResponder = async (incidentId: string) => {
    if (!assignResponderId) return;
    setActionLoading(true);
    try {
      const updated = await api.assignIncident(incidentId, assignResponderId);
      setSelectedIncident(updated);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePriorityChange = async (incidentId: string, priority: string) => {
    setActionLoading(true);
    try {
      const updated = await api.updateIncident(incidentId, { priority });
      setSelectedIncident(updated);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusChange = async (incidentId: string, status: string) => {
    setActionLoading(true);
    try {
      const updated = await api.updateIncident(incidentId, { status });
      setSelectedIncident(updated);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">INCIDENTS & EMERGENCY TRIAGE</h2>
          <p className="text-xs text-muted font-mono mt-0.5">MANAGE, ASSIGN AND RESOLVE EMERGENCY FIELD REPORTS ({total} TOTAL)</p>
        </div>
        <button onClick={loadData} disabled={loading} className="btn btn-sm">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="card mb-6" style={{ background: 'var(--bg-surface)' }}>
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-1 items-center gap-2" style={{ minWidth: '240px' }}>
            <div className="relative w-full">
              <input
                type="text"
                placeholder="Search descriptions, locations, categories..."
                className="form-input"
                style={{ paddingLeft: '2rem' }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Search size={14} className="text-dim absolute" style={{ left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
            </div>
            <button type="submit" className="btn btn-sm btn-primary">Search</button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Filter size={14} className="text-muted" />
              <select className="form-select text-xs" style={{ width: 'auto' }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All Statuses</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="ACKNOWLEDGED">Acknowledged</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="RESPONDING">Responding</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <select className="form-select text-xs" style={{ width: 'auto' }} value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
                <option value="">All Priorities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
          </div>
        </form>
      </div>

      {/* Incidents Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Priority</th>
              <th>Category</th>
              <th>Description</th>
              <th>People</th>
              <th>Assigned Responder</th>
              <th>Status</th>
              <th>Reported</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {incidents.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-muted">
                  No incidents matching current criteria.
                </td>
              </tr>
            ) : (
              incidents.map((inc) => {
                const priorityColor =
                  inc.priority === 'CRITICAL'
                    ? 'badge-red'
                    : inc.priority === 'HIGH'
                    ? 'badge-amber'
                    : inc.priority === 'MEDIUM'
                    ? 'badge-blue'
                    : 'badge-gray';

                const statusColor =
                  inc.status === 'SUBMITTED'
                    ? 'badge-amber'
                    : inc.status === 'ACKNOWLEDGED'
                    ? 'badge-purple'
                    : inc.status === 'ASSIGNED' || inc.status === 'IN_PROGRESS' || inc.status === 'RESPONDING'
                    ? 'badge-blue'
                    : inc.status === 'RESOLVED'
                    ? 'badge-emerald'
                    : 'badge-gray';

                return (
                  <tr key={inc.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedIncident(inc)}>
                    <td><span className={`badge ${priorityColor}`}>{inc.priority}</span></td>
                    <td className="font-semibold text-sm">{inc.category.replace(/_/g, ' ')}</td>
                    <td style={{ maxWidth: '320px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} className="text-muted">
                      {inc.description}
                    </td>
                    <td className="font-mono text-xs">{inc.people_affected || 0}</td>
                    <td className="text-xs">
                      {inc.assigned_responder ? (
                        <span className="flex items-center gap-1 text-blue">
                          <Shield size={12} /> {inc.assigned_responder.user?.full_name || inc.assigned_responder.team || 'Assigned'}
                        </span>
                      ) : (
                        <span className="text-dim">Unassigned</span>
                      )}
                    </td>
                    <td><span className={`badge ${statusColor}`}>{inc.status.replace(/_/g, ' ')}</span></td>
                    <td className="text-xs font-mono text-dim">
                      {new Date(inc.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedIncident(inc);
                        }}
                        className="btn btn-sm"
                      >
                        Triage
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Incident Detail & Triage Modal */}
      {selectedIncident && (
        <div className="modal-backdrop" onClick={() => setSelectedIncident(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between pb-3 mb-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`badge ${selectedIncident.priority === 'CRITICAL' ? 'badge-red' : selectedIncident.priority === 'HIGH' ? 'badge-amber' : 'badge-blue'}`}>
                    {selectedIncident.priority}
                  </span>
                  <span className="text-xs font-mono text-muted">{selectedIncident.id}</span>
                </div>
                <h3 className="text-lg font-bold mt-1">{selectedIncident.category.replace(/_/g, ' ')}</h3>
              </div>
              <button onClick={() => setSelectedIncident(null)} className="btn-icon">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <label className="form-label">Full Incident Description</label>
                <div className="p-3" style={{ background: 'var(--bg-app)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  {selectedIncident.description}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2" style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)' }}>
                  <span className="text-dim">People Affected:</span>
                  <div className="font-bold text-sm mt-0.5">{selectedIncident.people_affected}</div>
                </div>
                <div className="p-2" style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)' }}>
                  <span className="text-dim">Current Status:</span>
                  <div className="font-bold text-sm mt-0.5 text-blue">{selectedIncident.status}</div>
                </div>
              </div>

              {/* Priority Override */}
              <div className="form-group">
                <label className="form-label">Adjust Incident Priority</label>
                <div className="flex gap-2">
                  {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map((prio) => (
                    <button
                      key={prio}
                      type="button"
                      disabled={actionLoading || selectedIncident.priority === prio}
                      onClick={() => handlePriorityChange(selectedIncident.id, prio)}
                      className={`btn btn-sm flex-1 ${selectedIncident.priority === prio ? 'btn-primary' : ''}`}
                    >
                      {prio}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status Override */}
              <div className="form-group">
                <label className="form-label">Direct Status Transition</label>
                <div className="flex flex-wrap gap-1.5">
                  {(['SUBMITTED', 'ACKNOWLEDGED', 'ASSIGNED', 'IN_PROGRESS', 'RESPONDING', 'RESOLVED', 'CLOSED', 'CANCELLED'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      disabled={actionLoading || selectedIncident.status === st}
                      onClick={() => handleStatusChange(selectedIncident.id, st)}
                      className={`btn btn-sm ${selectedIncident.status === st ? 'btn-primary' : ''}`}
                      style={{ fontSize: '0.7rem', padding: '0.25rem 0.5rem' }}
                    >
                      {st.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Assign Responder */}
              <div className="form-group">
                <label className="form-label">Dispatch / Assign Responder</label>
                <div className="flex gap-2">
                  <select
                    className="form-select text-xs"
                    value={assignResponderId}
                    onChange={(e) => setAssignResponderId(e.target.value)}
                  >
                    <option value="">Select available responder...</option>
                    {responders.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.user?.full_name || r.user?.username || r.id} — {r.team || 'General Team'} ({r.status})
                      </option>
                    ))}
                  </select>
                  <button
                    disabled={!assignResponderId || actionLoading}
                    onClick={() => handleAssignResponder(selectedIncident.id)}
                    className="btn btn-sm btn-primary"
                  >
                    Assign
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex flex-col gap-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                {selectedIncident.status === 'SUBMITTED' && (
                  <button
                    disabled={actionLoading}
                    onClick={() => handleAcknowledge(selectedIncident.id)}
                    className="btn btn-primary w-full"
                  >
                    <Clock size={16} /> Acknowledge Incident (Move to Under Review)
                  </button>
                )}

                {selectedIncident.status !== 'RESOLVED' && selectedIncident.status !== 'CANCELLED' && (
                  <div>
                    <input
                      type="text"
                      className="form-input mb-2 text-xs"
                      placeholder="Optional resolution debrief notes..."
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                    />
                    <button
                      disabled={actionLoading}
                      onClick={() => handleResolve(selectedIncident.id)}
                      className="btn w-full"
                      style={{ background: 'var(--accent-emerald)', borderColor: 'var(--accent-emerald)', color: '#fff' }}
                    >
                      <CheckCircle size={16} /> Mark Incident as Resolved
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
