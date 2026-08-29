import React, { useEffect, useState } from 'react';
import {
  Check,
  Edit2,
  Plus,
  RefreshCw,
  Search,
  Shield,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  X,
} from 'lucide-react';
import { api } from '../api/client';
import { User, UserRole } from '../api/types';

export const PeopleView: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);

  // Form states
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('CIVILIAN');
  const [actionLoading, setActionLoading] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const resp = await api.getUsers({
        search: search || undefined,
        role: roleFilter || undefined,
        page_size: 100,
      });
      setUsers(resp.data);
      setTotal(resp.total);
    } catch (err) {
      console.error('Failed to load users', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [roleFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadUsers();
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await api.createUser({
        username,
        full_name: fullName,
        email: email || undefined,
        password,
        role,
      });
      setShowAddModal(false);
      setUsername('');
      setFullName('');
      setEmail('');
      setPassword('');
      await loadUsers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: UserRole) => {
    try {
      await api.updateUser(userId, { role: newRole });
      await loadUsers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleActive = async (user: User) => {
    try {
      if (user.is_active) {
        await api.deactivateUser(user.id);
      } else {
        await api.updateUser(user.id, { is_active: true });
      }
      await loadUsers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">PEOPLE & OPERATOR DIRECTORY</h2>
          <p className="text-xs text-muted font-mono mt-0.5">
            USER ACCESS CONTROL • ROLE PRIVILEGES • IDENTITY MANAGEMENT ({total} REGISTERED)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setShowAddModal(true)} className="btn btn-sm btn-primary">
            <UserPlus size={14} /> Add User
          </button>
          <button onClick={loadUsers} disabled={loading} className="btn btn-sm">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card mb-6" style={{ background: 'var(--bg-surface)' }}>
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-1 items-center gap-2" style={{ minWidth: '240px' }}>
            <div className="relative w-full">
              <input
                type="text"
                placeholder="Search by full name, username, email..."
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
            <label className="text-xs text-muted font-semibold">Role Filter:</label>
            <select
              className="form-select text-xs"
              style={{ width: 'auto' }}
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="">All Roles</option>
              <option value="ADMIN">ADMIN</option>
              <option value="INCIDENT_MANAGER">INCIDENT_MANAGER</option>
              <option value="RESPONDER">RESPONDER</option>
              <option value="CIVILIAN">CIVILIAN</option>
              <option value="VIEWER">VIEWER</option>
            </select>
          </div>
        </form>
      </div>

      {/* Users Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Full Name</th>
              <th>Username</th>
              <th>Role</th>
              <th>Registered At</th>
              <th>Change Role</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-muted">
                  No users found matching query.
                </td>
              </tr>
            ) : (
              users.map((u) => {
                const roleBadge =
                  u.role === 'ADMIN'
                    ? 'badge-red'
                    : u.role === 'INCIDENT_MANAGER'
                    ? 'badge-amber'
                    : u.role === 'RESPONDER'
                    ? 'badge-blue'
                    : 'badge-gray';

                return (
                  <tr key={u.id}>
                    <td>
                      <span className={`badge ${u.is_active ? 'badge-emerald' : 'badge-red'}`}>
                        {u.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="font-bold text-main">{u.full_name}</td>
                    <td className="font-mono text-cyan text-xs">@{u.username}</td>
                    <td><span className={`badge ${roleBadge}`}>{u.role}</span></td>
                    <td className="text-xs font-mono text-dim">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <select
                        className="form-select text-xs"
                        style={{ width: 'auto', padding: '0.25rem 0.5rem' }}
                        value={u.role}
                        onChange={(e) => handleUpdateRole(u.id, e.target.value as UserRole)}
                      >
                        <option value="ADMIN">ADMIN</option>
                        <option value="INCIDENT_MANAGER">INCIDENT_MANAGER</option>
                        <option value="RESPONDER">RESPONDER</option>
                        <option value="CIVILIAN">CIVILIAN</option>
                        <option value="VIEWER">VIEWER</option>
                      </select>
                    </td>
                    <td>
                      <button
                        onClick={() => handleToggleActive(u)}
                        className={`btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-primary'}`}
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem' }}
                      >
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Create User Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-3 mb-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <h3 className="text-base font-bold flex items-center gap-2">
                <UserPlus size={18} className="text-blue" /> Create New Operator Account
              </h3>
              <button onClick={() => setShowAddModal(false)} className="btn-icon"><X size={18} /></button>
            </div>

            <form onSubmit={handleCreateUser}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Sarah Connor"
                  className="form-input text-xs"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Username</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. sarah_c"
                  className="form-input text-xs font-mono"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email (Optional)</label>
                <input
                  type="email"
                  placeholder="sarah@mesh.local"
                  className="form-input text-xs"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password (Min 8 chars, 1 uppercase, 1 digit)</label>
                <input
                  type="password"
                  required
                  placeholder="SecurePassword123"
                  className="form-input text-xs"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">System Role & Access Level</label>
                <select
                  className="form-select text-xs"
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                >
                  <option value="ADMIN">ADMIN (Full Access)</option>
                  <option value="INCIDENT_MANAGER">INCIDENT_MANAGER (Triage & Dispatch)</option>
                  <option value="RESPONDER">RESPONDER (Field Unit)</option>
                  <option value="CIVILIAN">CIVILIAN (Report Incidents & SOS)</option>
                  <option value="VIEWER">VIEWER (Read Only)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 mt-4 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-sm">Cancel</button>
                <button type="submit" disabled={actionLoading} className="btn btn-sm btn-primary">
                  {actionLoading ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
