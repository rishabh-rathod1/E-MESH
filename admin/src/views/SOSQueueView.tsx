import React, { useEffect, useState } from 'react';
import {
  AlertOctagon,
  CheckCircle,
  Clock,
  Radio,
  RefreshCw,
  Shield,
  User,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { api } from '../api/client';
import { SOS } from '../api/types';

import { useMeshEvent } from '../api/ws';

export const SOSQueueView: React.FC = () => {
  const [sosList, setSosList] = useState<SOS[]>([]);
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [loading, setLoading] = useState(true);
  const [audioAlert, setAudioAlert] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const resp = await api.getSOSList({
        status: statusFilter || undefined,
        page_size: 50,
      });
      setSosList(resp.data);
    } catch (err) {
      console.error('Failed to load SOS queue', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  useMeshEvent('sos.created', (data) => {
    loadData();
  });
  useMeshEvent('incident.updated', () => loadData());

  const handleUpdateStatus = async (id: string, status: 'ACKNOWLEDGED' | 'RESOLVED' | 'CANCELLED') => {
    setActionLoading(id);
    try {
      await api.updateSOS(id, { status });
      await loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const activeCount = sosList.filter((s) => s.status === 'ACTIVE').length;
  const totalPeople = sosList.reduce((acc, s) => acc + (s.status === 'ACTIVE' ? s.people_count : 0), 0);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="pulse-dot offline" />
            <h2 className="text-2xl font-extrabold tracking-tight text-red">EMERGENCY SOS DISPATCH QUEUE</h2>
          </div>
          <p className="text-xs text-muted font-mono mt-0.5">
            REAL-TIME DISTRESS BROADCAST MONITOR • ZERO-INTERNET MESH PACKETS
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setAudioAlert(!audioAlert)}
            className={`btn btn-sm ${audioAlert ? 'btn-danger' : ''}`}
            title="Toggle Operator Audio Siren on new SOS"
          >
            {audioAlert ? <Volume2 size={14} /> : <VolumeX size={14} />} Audio Alerts {audioAlert ? 'ON' : 'OFF'}
          </button>
          <button onClick={loadData} disabled={loading} className="btn btn-sm">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh Queue
          </button>
        </div>
      </div>

      {/* Triage Summary Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="metric-card border-red">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-xs font-bold text-muted uppercase">Active Distress Calls</div>
              <div className="text-3xl font-extrabold mt-1 text-red font-mono">{activeCount}</div>
            </div>
            <AlertOctagon size={28} className="text-red" />
          </div>
        </div>

        <div className="metric-card border-amber">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-xs font-bold text-muted uppercase">People at Risk</div>
              <div className="text-3xl font-extrabold mt-1 text-amber font-mono">{totalPeople}</div>
            </div>
            <Users size={28} className="text-amber" />
          </div>
        </div>

        <div className="metric-card border-emerald">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-xs font-bold text-muted uppercase">Mesh Gateway Mode</div>
              <div className="text-xl font-bold mt-1 text-emerald">ESP-NOW / LAN</div>
            </div>
            <Radio size={28} className="text-emerald" />
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4">
        {[
          { id: 'ACTIVE', label: 'Active Distress (Immediate Action)' },
          { id: 'ACKNOWLEDGED', label: 'Acknowledged / Dispatched' },
          { id: 'RESOLVED', label: 'Resolved SOS' },
          { id: '', label: 'All SOS History' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`btn btn-sm ${statusFilter === tab.id ? 'btn-primary' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* SOS List */}
      <div className="flex flex-col gap-4">
        {sosList.length === 0 ? (
          <div className="card text-center py-12 text-muted">
            <CheckCircle size={36} className="text-emerald mx-auto mb-2" />
            <div className="font-bold text-base text-main">No Emergency SOS Calls in Queue</div>
            <div className="text-xs mt-1">All civilian distress requests have been acknowledged or resolved.</div>
          </div>
        ) : (
          sosList.map((sos) => {
            const isActing = actionLoading === sos.id;
            const badgeColor =
              sos.status === 'ACTIVE'
                ? 'badge-red'
                : sos.status === 'ACKNOWLEDGED'
                ? 'badge-amber'
                : 'badge-emerald';

            return (
              <div
                key={sos.id}
                className="card"
                style={{
                  background: sos.status === 'ACTIVE' ? 'linear-gradient(90deg, #1f1416 0%, #161e2e 100%)' : 'var(--bg-card)',
                  borderColor: sos.status === 'ACTIVE' ? 'rgba(239, 68, 68, 0.4)' : 'var(--border-subtle)',
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div
                      className="p-3"
                      style={{
                        background: sos.status === 'ACTIVE' ? 'rgba(239, 68, 68, 0.2)' : 'var(--bg-surface-elevated)',
                        borderRadius: '12px',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                      }}
                    >
                      <AlertOctagon size={24} className={sos.status === 'ACTIVE' ? 'text-red' : 'text-muted'} />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`badge ${badgeColor}`}>{sos.status}</span>
                        <span className="text-xs font-mono text-dim">ID: {sos.id}</span>
                        {sos.incident_id && (
                          <span className="text-xs font-mono text-blue flex items-center gap-1">
                            • Linked to Incident: {sos.incident_id}
                          </span>
                        )}
                      </div>

                      <div className="text-lg font-bold text-main mt-1 flex items-center gap-2">
                        <span>{sos.people_count} Person{sos.people_count > 1 ? 's' : ''} in Immediate Danger</span>
                      </div>

                      {sos.notes ? (
                        <p className="text-sm text-main mt-1 p-2" style={{ background: 'rgba(0, 0, 0, 0.2)', borderRadius: 'var(--radius-sm)' }}>
                          <strong>Notes:</strong> {sos.notes}
                        </p>
                      ) : (
                        <p className="text-xs text-dim mt-1 italic">No extra notes provided by reporter.</p>
                      )}

                      <div className="flex items-center gap-4 text-xs font-mono text-muted mt-2">
                        <span className="flex items-center gap-1">
                          <Clock size={12} /> {new Date(sos.created_at).toLocaleString()}
                        </span>
                        {sos.node_id && (
                          <span className="flex items-center gap-1 text-cyan">
                            <Radio size={12} /> Via Node: {sos.node_id}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2">
                    {sos.status === 'ACTIVE' && (
                      <button
                        disabled={isActing}
                        onClick={() => handleUpdateStatus(sos.id, 'ACKNOWLEDGED')}
                        className="btn btn-sm btn-primary"
                      >
                        <Clock size={14} /> Acknowledge & Deploy
                      </button>
                    )}

                    {sos.status !== 'RESOLVED' && sos.status !== 'CANCELLED' && (
                      <button
                        disabled={isActing}
                        onClick={() => handleUpdateStatus(sos.id, 'RESOLVED')}
                        className="btn btn-sm"
                        style={{ background: 'var(--accent-emerald)', borderColor: 'var(--accent-emerald)', color: '#fff' }}
                      >
                        <CheckCircle size={14} /> Mark Resolved
                      </button>
                    )}

                    {sos.status === 'ACTIVE' && (
                      <button
                        disabled={isActing}
                        onClick={() => handleUpdateStatus(sos.id, 'CANCELLED')}
                        className="btn btn-sm"
                        style={{ color: 'var(--text-dim)' }}
                      >
                        False Alarm
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
