import React, { useEffect, useState } from 'react';
import {
  FileText,
  Filter,
  RefreshCw,
  Search,
  Shield,
  User,
} from 'lucide-react';
import { api } from '../api/client';
import { AuditLog } from '../api/types';

export const AuditLogView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const loadLogs = async () => {
    setLoading(true);
    try {
      const resp = await api.getAuditLogs({
        search: search || undefined,
        action: actionFilter || undefined,
        page_size: 100,
      });
      setLogs(resp.data);
      setTotal(resp.total);
    } catch (err) {
      console.error('Failed to load audit logs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [actionFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadLogs();
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--text-main)' }}>Audit Log</h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
            System logs, operator actions, and compliance records ({total} entries)
          </p>
        </div>

        <button onClick={loadLogs} disabled={loading} className="btn btn-sm">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh Trail
        </button>
      </div>

      {/* Filter Bar */}
      <div className="card mb-6" style={{ background: 'var(--bg-surface)' }}>
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-1 items-center gap-2" style={{ minWidth: '240px' }}>
            <div className="relative w-full">
              <input
                type="text"
                placeholder="Search audit actions, usernames, entity IDs, IP..."
                className="form-input"
                style={{ paddingLeft: '2rem' }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Search size={14} className="text-dim absolute" style={{ left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
            </div>
            <button type="submit" className="btn btn-sm btn-primary">Search</button>
          </div>

          <div className="flex items-center gap-2">
            <select
              className="form-select text-xs"
              style={{ width: 'auto' }}
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            >
              <option value="">All Action Types</option>
              <option value="auth.login">auth.login</option>
              <option value="auth.logout">auth.logout</option>
              <option value="user.registered">user.registered</option>
              <option value="user.created">user.created</option>
              <option value="user.updated">user.updated</option>
              <option value="incident.created">incident.created</option>
              <option value="incident.updated">incident.updated</option>
              <option value="incident.acknowledged">incident.acknowledged</option>
              <option value="incident.resolved">incident.resolved</option>
              <option value="sos.created">sos.created</option>
              <option value="sos.updated">sos.updated</option>
              <option value="node.created">node.created</option>
              <option value="resource.created">resource.created</option>
              <option value="announcement.created">announcement.created</option>
            </select>
          </div>
        </form>
      </div>

      {/* Audit Log Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Action Key</th>
              <th>Operator / Actor</th>
              <th>Target Entity</th>
              <th>Client IP</th>
              <th>Metadata Context</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-muted">
                  No audit logs found matching criteria.
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const isAuth = log.action.startsWith('auth.');
                const isCritical = log.action.includes('delete') || log.action.includes('deactivate');

                const actionBadge = isCritical
                  ? 'badge-red'
                  : isAuth
                  ? 'badge-blue'
                  : 'badge-purple';

                const rawTime = log.timestamp || log.created_at;
                let formattedDate = '—';
                if (rawTime) {
                  const d = new Date(rawTime);
                  formattedDate = isNaN(d.getTime()) ? rawTime : d.toLocaleString();
                }

                let metaContent = '—';
                if (log.metadata) {
                  metaContent = typeof log.metadata === 'string' ? log.metadata : JSON.stringify(log.metadata);
                } else if (log.metadata_json) {
                  metaContent = log.metadata_json;
                }

                return (
                  <tr key={log.id}>
                    <td className="font-mono text-xs text-dim" style={{ whiteSpace: 'nowrap' }}>
                      {formattedDate}
                    </td>
                    <td>
                      <span className={`badge ${actionBadge}`}>{log.action}</span>
                    </td>
                    <td>
                      <span className="font-semibold text-xs flex items-center gap-1.5">
                        <User size={12} className="text-muted" />
                        {log.actor_username || log.actor_id || 'System Anonymous'}
                      </span>
                    </td>
                    <td className="font-mono text-xs text-cyan">
                      {log.entity_type ? `${log.entity_type} (${log.entity_id?.slice(0, 8)})` : 'N/A'}
                    </td>
                    <td className="font-mono text-xs text-muted">{log.ip_address || '127.0.0.1'}</td>
                    <td className="text-xs font-mono text-dim" style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {metaContent}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
