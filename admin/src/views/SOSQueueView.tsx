import React, { useEffect, useState } from 'react';
import {
  AlertOctagon,
  CheckCircle,
  Clock,
  Radio,
  RefreshCw,
  Shield,
  Users,
  Volume2,
  VolumeX,
  AlertTriangle,
  Info,
  Send,
  MessageSquare,
  Check
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

  // LoRa Emergency Broadcast State
  const [broadcastText, setBroadcastText] = useState('');
  const [broadcastPriority, setBroadcastPriority] = useState<'CRITICAL' | 'HIGH' | 'INFO'>('CRITICAL');
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcastSuccess, setBroadcastSuccess] = useState<string | null>(null);
  const [recentBroadcasts, setRecentBroadcasts] = useState<any[]>([]);

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

  const loadLoRaMessages = async () => {
    try {
      const res = await api.getLoRaMessages();
      if (res && res.messages) {
        setRecentBroadcasts(res.messages.slice(-5).reverse());
      }
    } catch (err) {
      console.warn('Could not load LoRa messages', err);
    }
  };

  useEffect(() => {
    loadData();
    loadLoRaMessages();
  }, [statusFilter]);

  useMeshEvent('sos.created', (data) => {
    loadData();
  });
  useMeshEvent('incident.updated', () => loadData());
  useMeshEvent('lora.broadcast', (data: any) => {
    setRecentBroadcasts((prev) => [data, ...prev.slice(0, 4)]);
  });

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastText.trim()) return;

    setBroadcastSending(true);
    try {
      await api.sendLoRaBroadcast({
        message: broadcastText.trim(),
        priority: broadcastPriority,
        title: 'Emergency Broadcast'
      });
      setBroadcastSuccess('Broadcast queued for LoRa transmission (433 MHz)');
      setBroadcastText('');
      setTimeout(() => setBroadcastSuccess(null), 4000);
      loadLoRaMessages();
    } catch (err: any) {
      alert(`Failed to send broadcast: ${err.message || err}`);
    } finally {
      setBroadcastSending(false);
    }
  };

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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className={`status-dot ${activeCount > 0 ? 'bg-red animate-pulse' : 'bg-gray'}`} />
            <h2 className={`text-xl font-bold leading-tight ${activeCount > 0 ? 'text-red' : 'text-main'}`}>
              Emergency SOS Queue
            </h2>
          </div>
          <p className="text-sm text-muted mt-1">
            Real-time distress broadcast monitor from mesh packets
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setAudioAlert(!audioAlert)}
            className={`btn ${audioAlert ? 'btn-danger' : ''}`}
            title="Toggle audio alerts on new SOS"
          >
            {audioAlert ? <Volume2 size={14} /> : <VolumeX size={14} />} {audioAlert ? 'Alerts ON' : 'Alerts OFF'}
          </button>
          <button onClick={loadData} disabled={loading} className="btn">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Triage Summary Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="metric-widget" style={{ borderTop: '3px solid var(--accent-red)' }}>
          <div className="flex justify-between items-start">
            <div>
              <div className="metric-label uppercase tracking-widest text-muted"><AlertOctagon size={12} className="text-red" /> Active Calls</div>
              <div className="metric-value font-mono text-red">{activeCount}</div>
            </div>
          </div>
          <div className="metric-subtext">
            <span>Critical distress broadcasts</span>
          </div>
        </div>

        <div className="metric-widget" style={{ borderTop: '3px solid var(--accent-amber)' }}>
          <div className="flex justify-between items-start">
            <div>
              <div className="metric-label uppercase tracking-widest text-muted"><Users size={12} className="text-amber" /> People at Risk</div>
              <div className="metric-value font-mono text-amber">{totalPeople}</div>
            </div>
          </div>
          <div className="metric-subtext">
            <span>Extracted from distress packets</span>
          </div>
        </div>

        <div className="metric-widget" style={{ borderTop: '3px solid var(--accent-emerald)' }}>
          <div className="flex justify-between items-start">
            <div>
              <div className="metric-label uppercase tracking-widest text-muted"><Radio size={12} className="text-emerald" /> Mesh Gateway Mode</div>
              <div className="metric-value font-mono text-emerald text-xl mt-2">ESP-MESH</div>
            </div>
          </div>
          <div className="metric-subtext">
            <span>Listening for offline packets</span>
          </div>
        </div>
      </div>

      {/* LoRa Bridge Emergency Broadcast Panel */}
      <div className="widget" style={{ borderLeft: '4px solid var(--accent-red)' }}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-3 pb-2 border-b border-subtle">
          <div className="flex items-center gap-2">
            <Radio size={18} className="text-red animate-pulse" />
            <h3 className="text-base font-bold text-main">
              Emergency LoRa Text Broadcast (433 MHz Field Bridge)
            </h3>
            <span className="badge bg-red text-white text-xs">SX1278 Transmitter</span>
          </div>
          <span className="text-xs text-muted font-mono">
            Direct Long-Range Outpost Transmission
          </span>
        </div>

        {broadcastSuccess && (
          <div className="p-3 mb-3 bg-emerald/10 border border-emerald/30 text-emerald rounded text-sm flex items-center gap-2">
            <Check size={16} /> {broadcastSuccess}
          </div>
        )}

        <form onSubmit={handleSendBroadcast} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1">
              <input
                type="text"
                value={broadcastText}
                onChange={(e) => setBroadcastText(e.target.value)}
                placeholder="Enter urgent text instructions (e.g., EVACUATE TO SECTOR 4 IMMEDIATELY)..."
                className="form-input w-full text-sm font-semibold"
                required
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={broadcastPriority}
                onChange={(e) => setBroadcastPriority(e.target.value as any)}
                className="form-input text-xs font-bold"
                style={{ width: '130px' }}
              >
                <option value="CRITICAL">🚨 CRITICAL</option>
                <option value="HIGH">⚠️ HIGH</option>
                <option value="INFO">ℹ️ INFO</option>
              </select>

              <button
                type="submit"
                disabled={broadcastSending || !broadcastText.trim()}
                className="btn btn-danger flex items-center gap-2 text-sm px-4 shrink-0"
              >
                {broadcastSending ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                <span>Transmit Broadcast</span>
              </button>
            </div>
          </div>
        </form>

        {recentBroadcasts.length > 0 && (
          <div className="mt-3 pt-3 border-t border-subtle">
            <div className="text-xs font-bold text-muted uppercase tracking-wider mb-2 flex items-center gap-1">
              <MessageSquare size={12} /> Recent LoRa Transmissions:
            </div>
            <div className="flex flex-wrap gap-2">
              {recentBroadcasts.map((msg: any) => (
                <div
                  key={msg.id || msg.created_at}
                  className="p-2 rounded bg-surface-elevated border border-subtle text-xs flex items-center gap-2 max-w-full"
                >
                  <span className={`badge ${msg.priority === 'CRITICAL' ? 'bg-red' : msg.priority === 'HIGH' ? 'bg-amber' : 'bg-primary'} text-white text-[10px]`}>
                    {msg.priority || 'INFO'}
                  </span>
                  <span className="font-semibold text-main truncate max-w-xs">{msg.message}</span>
                  <span className="text-[10px] text-muted font-mono shrink-0">
                    {msg.created_at ? new Date(msg.created_at).toLocaleTimeString() : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="widget" style={{ minHeight: '400px' }}>
        <div className="widget-header border-b border-subtle pb-3">
          <div className="flex items-center gap-2">
            {[
              { id: 'ACTIVE', label: 'Active Queue' },
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
          <span className="text-xs text-muted font-mono">{sosList.length} items</span>
        </div>

        <div className="flex flex-col gap-3 mt-4">
          {sosList.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-muted gap-2">
              <CheckCircle size={32} className="text-emerald opacity-50 mb-2" />
              <div className="text-base font-bold text-main">No SOS Calls in Queue</div>
              <div className="text-sm">All distress requests have been acknowledged or resolved.</div>
            </div>
          ) : (
            sosList.map((sos) => {
              const isActing = actionLoading === sos.id;
              const isAlert = sos.status === 'ACTIVE';
              const badgeColor =
                isAlert ? 'bg-red text-white'
                  : sos.status === 'ACKNOWLEDGED' ? 'bg-amber text-white'
                    : 'bg-emerald text-white';

              return (
                <div
                  key={sos.id}
                  className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border border-subtle rounded-md transition-colors"
                  style={{
                    backgroundColor: isAlert ? 'rgba(201, 130, 130, 0.04)' : 'var(--bg-surface)',
                    borderColor: isAlert ? 'rgba(201, 130, 130, 0.3)' : 'var(--border-subtle)',
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex items-center justify-center rounded-sm shrink-0`} style={{
                      width: '40px', height: '40px',
                      backgroundColor: isAlert ? 'rgba(201, 130, 130, 0.1)' : 'var(--bg-surface-elevated)',
                      border: `1px solid ${isAlert ? 'rgba(201, 130, 130, 0.2)' : 'var(--border-subtle)'}`
                    }}>
                      <AlertOctagon size={20} className={isAlert ? 'text-red' : 'text-muted'} />
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`badge ${badgeColor}`}>{sos.status}</span>
                        <span className="font-mono text-xs text-dim">ID: {sos.id}</span>
                        {sos.incident_id && (
                          <span className="font-mono text-xs text-blue flex items-center gap-1">
                            • Linked Incident: {sos.incident_id}
                          </span>
                        )}
                      </div>

                      <div className="text-sm font-bold text-main">
                        {sos.people_count} Person{sos.people_count > 1 ? 's' : ''} in Immediate Danger
                      </div>

                      <div className="text-xs text-main mt-2 p-2 bg-surface-elevated border border-subtle rounded-sm">
                        {sos.notes ? (
                          <><strong className="text-muted">Reporter Note:</strong> {sos.notes}</>
                        ) : (
                          <span className="italic text-dim">No extra notes provided by reporter.</span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 mt-2 font-mono text-xs text-muted">
                        <span className="flex items-center gap-1">
                          <Clock size={12} /> {new Date(sos.created_at).toLocaleString()}
                        </span>
                        {sos.node_id && (
                          <span className="flex items-center gap-1 text-primary">
                            <Radio size={12} /> Node: {sos.node_id}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start md:self-center shrink-0">
                    {sos.status === 'ACTIVE' && (
                      <button
                        disabled={isActing}
                        onClick={() => handleUpdateStatus(sos.id, 'ACKNOWLEDGED')}
                        className="btn btn-primary"
                      >
                        <Clock size={14} /> Acknowledge
                      </button>
                    )}

                    {sos.status !== 'RESOLVED' && sos.status !== 'CANCELLED' && (
                      <button
                        disabled={isActing}
                        onClick={() => handleUpdateStatus(sos.id, 'RESOLVED')}
                        className="btn btn-success"
                      >
                        <CheckCircle size={14} /> Resolve
                      </button>
                    )}

                    {sos.status === 'ACTIVE' && (
                      <button
                        disabled={isActing}
                        onClick={() => handleUpdateStatus(sos.id, 'CANCELLED')}
                        className="btn"
                      >
                        False Alarm
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
