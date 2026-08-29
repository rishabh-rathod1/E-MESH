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
            <h2 style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--accent-red)' }}>Emergency SOS Queue</h2>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
            Real-time distress broadcast monitor — mesh network packets
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setAudioAlert(!audioAlert)}
            className={`btn btn-sm ${audioAlert ? 'btn-danger' : ''}`}
            title="Toggle audio alerts on new SOS"
          >
            {audioAlert ? <Volume2 size={14} /> : <VolumeX size={14} />} Audio {audioAlert ? 'ON' : 'OFF'}
          </button>
          <button onClick={loadData} disabled={loading} className="btn btn-sm">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Triage Summary Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="metric-card border-red">
          <div className="flex justify-between items-center">
            <div>
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Active Distress Calls</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.25rem', color: 'var(--accent-red)', fontFamily: 'var(--font-mono)' }}>{activeCount}</div>
            </div>
            <AlertOctagon size={24} style={{ color: 'var(--accent-red)' }} />
          </div>
        </div>

        <div className="metric-card border-amber">
          <div className="flex justify-between items-center">
            <div>
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>People at Risk</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.25rem', color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>{totalPeople}</div>
            </div>
            <Users size={24} style={{ color: 'var(--accent-amber)' }} />
          </div>
        </div>

        <div className="metric-card border-emerald">
          <div className="flex justify-between items-center">
            <div>
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Mesh Gateway Mode</div>
              <div style={{ fontSize: '1.125rem', fontWeight: 700, marginTop: '0.25rem', color: 'var(--accent-emerald)' }}>ESP-NOW / LAN</div>
            </div>
            <Radio size={24} style={{ color: 'var(--accent-emerald)' }} />
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {[
          { id: 'ACTIVE', label: 'Active Distress' },
          { id: 'ACKNOWLEDGED', label: 'Acknowledged' },
          { id: 'RESOLVED', label: 'Resolved' },
          { id: '', label: 'All History' },
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
          <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <CheckCircle size={32} style={{ color: 'var(--accent-emerald)', margin: '0 auto 0.5rem' }} />
            <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-main)' }}>No SOS Calls in Queue</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>All distress requests have been acknowledged or resolved.</div>
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
                  borderColor: sos.status === 'ACTIVE' ? 'rgba(201, 130, 130, 0.35)' : undefined,
                  background: sos.status === 'ACTIVE' ? 'rgba(201, 130, 130, 0.03)' : undefined,
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div
                      style={{
                        padding: '0.625rem',
                        background: sos.status === 'ACTIVE' ? 'rgba(201, 130, 130, 0.1)' : 'var(--bg-surface-elevated)',
                        borderRadius: '10px',
                        border: sos.status === 'ACTIVE' ? '1px solid rgba(201, 130, 130, 0.2)' : '1px solid var(--border-subtle)',
                      }}
                    >
                      <AlertOctagon size={22} style={{ color: sos.status === 'ACTIVE' ? 'var(--accent-red)' : 'var(--text-muted)' }} />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`badge ${badgeColor}`}>{sos.status}</span>
                        <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>ID: {sos.id}</span>
                        {sos.incident_id && (
                          <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)' }} className="flex items-center gap-1">
                            • Linked: {sos.incident_id}
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.25rem' }} className="flex items-center gap-2">
                        <span>{sos.people_count} Person{sos.people_count > 1 ? 's' : ''} in Immediate Danger</span>
                      </div>

                      {sos.notes ? (
                        <p style={{ fontSize: '0.8125rem', color: 'var(--text-main)', marginTop: '0.375rem', padding: '0.5rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                          <strong>Notes:</strong> {sos.notes}
                        </p>
                      ) : (
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.25rem', fontStyle: 'italic' }}>No extra notes provided by reporter.</p>
                      )}

                      <div className="flex items-center gap-4" style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                        <span className="flex items-center gap-1">
                          <Clock size={12} /> {new Date(sos.created_at).toLocaleString()}
                        </span>
                        {sos.node_id && (
                          <span className="flex items-center gap-1" style={{ color: 'var(--accent-primary)' }}>
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
                        <Clock size={14} /> Acknowledge
                      </button>
                    )}

                    {sos.status !== 'RESOLVED' && sos.status !== 'CANCELLED' && (
                      <button
                        disabled={isActing}
                        onClick={() => handleUpdateStatus(sos.id, 'RESOLVED')}
                        className="btn btn-sm btn-success"
                      >
                        <CheckCircle size={14} /> Resolve
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
