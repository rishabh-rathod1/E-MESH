import React, { useEffect, useState } from 'react';
import {
  Boxes,
  Edit2,
  Package,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { api } from '../api/client';
import { ResourceItem, ResourceStatus } from '../api/types';

export const ResourcesView: React.FC = () => {
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editItem, setEditItem] = useState<ResourceItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [resourceType, setResourceType] = useState('MEDICAL');
  const [quantity, setQuantity] = useState(10);
  const [availableQuantity, setAvailableQuantity] = useState(10);
  const [location, setLocation] = useState('Central Depot (Station 1)');
  const [status, setStatus] = useState<ResourceStatus>('AVAILABLE');

  const loadResources = async () => {
    setLoading(true);
    try {
      const resp = await api.getResources({
        search: search || undefined,
        resource_type: typeFilter || undefined,
        page_size: 100,
      });
      setResources(resp.data);
    } catch (err) {
      console.error('Failed to load resources', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResources();
  }, [typeFilter]);

  const handleCreateResource = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await api.createResource({
        name,
        resource_type: resourceType,
        quantity,
        available_quantity: availableQuantity,
        location,
        status,
      });
      setShowAddModal(false);
      setName('');
      await loadResources();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;
    setActionLoading(true);
    try {
      await api.updateResource(editItem.id, {
        name,
        quantity,
        available_quantity: availableQuantity,
        location,
        status,
      });
      setEditItem(null);
      await loadResources();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteResource = async (id: string, itemName: string) => {
    if (!confirm(`Delete asset "${itemName}" from inventory?`)) return;
    try {
      await api.deleteResource(id);
      await loadResources();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const openEdit = (item: ResourceItem) => {
    setEditItem(item);
    setName(item.name);
    setResourceType(item.resource_type);
    setQuantity(item.quantity);
    setAvailableQuantity(item.available_quantity);
    setLocation(item.location || '');
    setStatus(item.status);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--text-main)' }}>Asset Inventory</h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
            Emergency supplies, medical kits, and resource tracking ({resources.length} items)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setShowAddModal(true)} className="btn btn-sm btn-primary">
            <Plus size={14} /> Add Asset
          </button>
          <button onClick={loadResources} disabled={loading} className="btn btn-sm">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-1 items-center gap-2" style={{ minWidth: '240px' }}>
            <div className="relative w-full">
              <input
                type="text"
                placeholder="Search resources, names, locations..."
                className="form-input"
                style={{ paddingLeft: '2rem' }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadResources()}
              />
              <Search size={14} className="text-dim absolute" style={{ left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
            </div>
            <button onClick={loadResources} className="btn btn-sm btn-primary">Search</button>
          </div>

          <div className="flex items-center gap-2">
            <select
              className="form-select text-xs"
              style={{ width: 'auto' }}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">All Asset Types</option>
              <option value="MEDICAL">Medical Supplies</option>
              <option value="FOOD_WATER">Food & Water</option>
              <option value="POWER">Power & Generators</option>
              <option value="COMMUNICATIONS">Radio / Comms</option>
              <option value="RESCUE_GEAR">Rescue & Protective Gear</option>
            </select>
          </div>
        </div>
      </div>

      {/* Resource Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Asset Name</th>
              <th>Category</th>
              <th>Total Stock</th>
              <th>Available</th>
              <th>Depot Location</th>
              <th>Last Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {resources.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-8 text-muted">
                  No assets found in inventory. Click "Add Asset" to record emergency items.
                </td>
              </tr>
            ) : (
              resources.map((item) => {
                const isLow = item.available_quantity <= item.quantity * 0.2;
                const badgeColor =
                  item.status === 'AVAILABLE' && !isLow
                    ? 'badge-emerald'
                    : isLow || item.status === 'LOW_STOCK'
                    ? 'badge-amber'
                    : 'badge-red';

                return (
                  <tr key={item.id}>
                    <td><span className={`badge ${badgeColor}`}>{isLow ? 'LOW STOCK' : item.status}</span></td>
                    <td className="font-bold text-main">{item.name}</td>
                    <td className="text-xs font-mono text-cyan">{item.resource_type}</td>
                    <td className="font-mono text-xs">{item.quantity}</td>
                    <td className="font-mono text-xs font-bold text-emerald">{item.available_quantity}</td>
                    <td className="text-xs text-muted">{item.location || 'N/A'}</td>
                    <td className="text-xs font-mono text-dim">
                      {new Date(item.updated_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(item)} className="btn-icon" title="Edit Stock">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDeleteResource(item.id, item.name)} className="btn-icon text-red" title="Delete">
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
                <Boxes size={18} className="text-amber" /> Register Emergency Asset
              </h3>
              <button onClick={() => setShowAddModal(false)} className="btn-icon"><X size={18} /></button>
            </div>

            <form onSubmit={handleCreateResource}>
              <div className="form-group">
                <label className="form-label">Asset Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. First Aid Field Trauma Kits"
                  className="form-input text-xs"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Resource Type</label>
                <select className="form-select text-xs" value={resourceType} onChange={(e) => setResourceType(e.target.value)}>
                  <option value="MEDICAL">Medical Supplies</option>
                  <option value="FOOD_WATER">Food & Clean Water</option>
                  <option value="POWER">Power & Generators</option>
                  <option value="COMMUNICATIONS">Communications / Antennas</option>
                  <option value="RESCUE_GEAR">Search & Rescue Gear</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="form-label">Total Quantity</label>
                  <input
                    type="number"
                    min="0"
                    className="form-input text-xs"
                    value={quantity}
                    onChange={(e) => {
                      const q = parseInt(e.target.value) || 0;
                      setQuantity(q);
                      setAvailableQuantity(q);
                    }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Initial Available</label>
                  <input
                    type="number"
                    min="0"
                    className="form-input text-xs"
                    value={availableQuantity}
                    onChange={(e) => setAvailableQuantity(parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Storage Location / Warehouse</label>
                <input
                  type="text"
                  placeholder="e.g. Station 1 Bunker, Sector 2 Depot"
                  className="form-input text-xs"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 mt-4 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-sm">Cancel</button>
                <button type="submit" disabled={actionLoading} className="btn btn-sm btn-primary">
                  {actionLoading ? 'Saving...' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editItem && (
        <div className="modal-backdrop" onClick={() => setEditItem(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center pb-3 mb-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <h3 className="text-base font-bold">Adjust Asset: {editItem.name}</h3>
              <button onClick={() => setEditItem(null)} className="btn-icon"><X size={18} /></button>
            </div>

            <form onSubmit={handleUpdateResource}>
              <div className="form-group">
                <label className="form-label">Asset Name</label>
                <input
                  type="text"
                  required
                  className="form-input text-xs"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="form-label">Total Quantity</label>
                  <input
                    type="number"
                    min="0"
                    className="form-input text-xs"
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Available Quantity</label>
                  <input
                    type="number"
                    min="0"
                    className="form-input text-xs"
                    value={availableQuantity}
                    onChange={(e) => setAvailableQuantity(parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-select text-xs" value={status} onChange={(e) => setStatus(e.target.value as ResourceStatus)}>
                  <option value="AVAILABLE">AVAILABLE</option>
                  <option value="LOW_STOCK">LOW_STOCK</option>
                  <option value="DEPLETED">DEPLETED</option>
                  <option value="RESERVED">RESERVED</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Storage Location</label>
                <input
                  type="text"
                  className="form-input text-xs"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 mt-4 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <button type="button" onClick={() => setEditItem(null)} className="btn btn-sm">Cancel</button>
                <button type="submit" disabled={actionLoading} className="btn btn-sm btn-primary">
                  {actionLoading ? 'Saving...' : 'Update Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
