import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Info,
  Megaphone,
  Plus,
  Radio,
  RefreshCw,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import { api } from '../api/client';
import { Announcement, AnnouncementPriority } from '../api/types';

export const AnnouncementsView: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Form
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<AnnouncementPriority>('WARNING');

  const loadAnnouncements = async () => {
    setLoading(true);
    try {
      const resp = await api.getAnnouncements();
      setAnnouncements(resp.data);
    } catch (err) {
      console.error('Failed to load announcements', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await api.createAnnouncement({
        title,
        message,
        priority,
      });
      setShowAddModal(false);
      setTitle('');
      setMessage('');
      await loadAnnouncements();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleActive = async (id: string, current: boolean) => {
    try {
      await api.toggleAnnouncement(id, !current);
      await loadAnnouncements();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!confirm('Permanently delete broadcast notice?')) return;
    try {
      await api.deleteAnnouncement(id);
      await loadAnnouncements();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--text-main)' }}>Broadcasts</h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
            Public advisories and shelter notices via mesh network ({announcements.length} total)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setShowAddModal(true)} className="btn btn-sm btn-primary">
            <Plus size={14} /> New Broadcast
          </button>
          <button onClick={loadAnnouncements} disabled={loading} className="btn btn-sm">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Broadcast List */}
      <div className="flex flex-col gap-4">
        {announcements.length === 0 ? (
          <div className="card text-center py-12 text-muted">
            <Megaphone size={36} className="text-dim mx-auto mb-2" />
            <div>No announcements currently broadcasted. Click "New Broadcast" to issue an emergency notice.</div>
          </div>
        ) : (
          announcements.map((ann) => {
            const badgeColor =
              ann.priority === 'CRITICAL'
                ? 'badge-red'
                : ann.priority === 'WARNING'
                ? 'badge-amber'
                : 'badge-blue';

            return (
              <div
                key={ann.id}
                className="card"
                style={{
                  background: ann.is_active ? 'var(--bg-card)' : 'var(--bg-surface)',
                  opacity: ann.is_active ? 1 : 0.6,
                  borderLeft: `4px solid ${
                    ann.priority === 'CRITICAL'
                      ? 'var(--accent-red)'
                      : ann.priority === 'WARNING'
                      ? 'var(--accent-amber)'
                      : 'var(--accent-blue)'
                  }`,
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`badge ${badgeColor}`}>{ann.priority}</span>
                      <span className={`badge ${ann.is_active ? 'badge-emerald' : 'badge-gray'}`}>
                        {ann.is_active ? 'BROADCASTING' : 'SUSPENDED'}
                      </span>
                      <span className="text-xs font-mono text-dim">
                        {new Date(ann.created_at).toLocaleString()}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-main mt-1">{ann.title}</h3>
                    <p className="text-sm text-muted mt-1 leading-relaxed">{ann.message}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleActive(ann.id, ann.is_active)}
                      className={`btn btn-sm ${ann.is_active ? 'btn-danger' : 'btn-primary'}`}
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                    >
                      {ann.is_active ? 'Suspend Broadcast' : 'Resume Broadcast'}
                    </button>
                    <button onClick={() => handleDeleteAnnouncement(ann.id)} className="btn-icon text-red" title="Delete">
                      <Trash2 size={16} />
                    </button>
                  </div>
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
                <Megaphone size={18} className="text-amber" /> Compose Mesh Emergency Broadcast
              </h3>
              <button onClick={() => setShowAddModal(false)} className="btn-icon"><X size={18} /></button>
            </div>

            <form onSubmit={handleCreateAnnouncement}>
              <div className="form-group">
                <label className="form-label">Broadcast Priority Level</label>
                <div className="flex gap-2">
                  {(['INFO', 'WARNING', 'CRITICAL'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`btn btn-sm flex-1 ${priority === p ? (p === 'CRITICAL' ? 'btn-danger' : 'btn-primary') : ''}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Notice Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Boil Water Advisory - Sector 3"
                  className="form-input text-xs"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Broadcast Message Content</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Provide precise emergency instructions for civilians receiving this on the mesh..."
                  className="form-textarea text-xs"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 mt-4 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-sm">Cancel</button>
                <button type="submit" disabled={actionLoading} className="btn btn-sm btn-primary">
                  {actionLoading ? 'Transmitting...' : 'Transmit Over Mesh'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
