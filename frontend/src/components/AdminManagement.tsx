import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  UserPlus,
  Search,
  Shield,
  Trash2,
  Edit2,
  CheckCircle2,
  X,
  Mail,
  Phone,
  Calendar,
  AlertTriangle,
  Lock,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Card, Badge, Alert } from '../ui/primitives';
import { Button } from '../ui/Button';

interface RoleItem {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
}

interface AdminItem {
  id: string;
  accountId: string;
  personId: string;
  name: string;
  email: string;
  phone: string | null;
  roleName: string;
  roleId: string | null;
  permissions: string[];
  isProtectedSuperAdmin: boolean;
  status: string;
  createdAt: string;
  lastLoginAt: string | null;
}

export const AdminManagement: React.FC = () => {
  const [admins, setAdmins] = useState<AdminItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Create Modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formRoleId, setFormRoleId] = useState('');

  // Edit Modal state
  const [editAdmin, setEditAdmin] = useState<AdminItem | null>(null);
  const [editRoleId, setEditRoleId] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'inactive' | 'suspended'>('active');
  const [updating, setUpdating] = useState(false);

  // Revoke state
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [adminsRes, rolesRes] = await Promise.all([
        fetch('/api/v1/admin/admins'),
        fetch('/api/v1/admin/roles'),
      ]);

      if (!adminsRes.ok) {
        throw new Error('Failed to load administrators. Super Admin access required.');
      }
      const adminsJson = await adminsRes.json();
      setAdmins(adminsJson.data || []);

      if (rolesRes.ok) {
        const rolesJson = await rolesRes.json();
        setRoles(rolesJson.data || []);
        if (rolesJson.data?.length && !formRoleId) {
          setFormRoleId(rolesJson.data[0].id);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred fetching admin data');
    } finally {
      setLoading(false);
    }
  }, [formRoleId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmail.trim() || !formName.trim()) {
      setError('Name and institutional email are required.');
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          email: formEmail.trim().toLowerCase(),
          phone: formPhone.trim() || undefined,
          roleId: formRoleId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to provision administrator');
      }

      setSuccessMsg(`Administrator '${formEmail}' provisioned successfully.`);
      setCreateModalOpen(false);
      setFormName('');
      setFormEmail('');
      setFormPhone('');
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create administrator');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAdmin) return;

    setUpdating(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/admins/${editAdmin.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roleId: editRoleId || undefined,
          status: editStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update administrator');
      }

      setSuccessMsg(`Administrator '${editAdmin.email}' updated successfully.`);
      setEditAdmin(null);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update administrator');
    } finally {
      setUpdating(false);
    }
  };

  const handleRevokeAdmin = async (admin: AdminItem) => {
    if (admin.isProtectedSuperAdmin) {
      setError('Cannot revoke protected Super Administrator.');
      return;
    }

    if (!window.confirm(`Are you sure you want to revoke administrator access for ${admin.name} (${admin.email})?`)) {
      return;
    }

    setRevokingId(admin.id);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/admins/${admin.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to revoke administrator');
      }

      setSuccessMsg(`Administrator access revoked for '${admin.email}'.`);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke administrator');
    } finally {
      setRevokingId(null);
    }
  };

  const filteredAdmins = admins.filter((a) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      a.name.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      a.roleName.toLowerCase().includes(q)
    );
  });

  const selectedRole = roles.find((r) => r.id === formRoleId);
  const editSelectedRole = roles.find((r) => r.id === editRoleId);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      {/* Top Header Card */}
      <Card className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center shadow-md shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-text">Administrator Directory & Controlled Access</h1>
                <Badge tone="danger">Super Admin Console</Badge>
              </div>
              <p className="text-xs text-muted mt-0.5">
                Provision new gym administrators, designate role capabilities, and configure granular system permissions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              loading={loading}
              className="gap-1.5"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setError(null);
                setCreateModalOpen(true);
              }}
              className="gap-1.5"
            >
              <UserPlus className="w-4 h-4" />
              <span>Provision Administrator</span>
            </Button>
          </div>
        </div>

        {error && (
          <Alert tone="danger" onDismiss={() => setError(null)}>
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="text-xs">{error}</p>
            </div>
          </Alert>
        )}

        {successMsg && (
          <Alert tone="success" onDismiss={() => setSuccessMsg(null)}>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="text-xs">{successMsg}</p>
            </div>
          </Alert>
        )}

        {/* Search Bar */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search administrators by name, email, or role..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-elevated text-text text-xs focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
          />
        </div>
      </Card>

      {/* Admin Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-16 text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
            <p className="text-xs text-muted font-medium">Loading administrative staff...</p>
          </div>
        ) : filteredAdmins.length === 0 ? (
          <div className="col-span-full py-12 text-center text-muted text-xs">
            No administrators match your search query.
          </div>
        ) : (
          filteredAdmins.map((admin) => (
            <Card
              key={admin.id}
              className="p-5 space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-text truncate">{admin.name}</h3>
                    <p className="text-xs text-muted flex items-center gap-1.5 mt-0.5 truncate">
                      <Mail className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{admin.email}</span>
                    </p>
                    {admin.phone && (
                      <p className="text-[11px] text-muted flex items-center gap-1.5 mt-0.5">
                        <Phone className="w-3 h-3 shrink-0" />
                        <span>{admin.phone}</span>
                      </p>
                    )}
                  </div>
                  {admin.isProtectedSuperAdmin ? (
                    <Badge tone="danger">
                      <Lock className="w-3 h-3 mr-1" />
                      Super Admin
                    </Badge>
                  ) : (
                    <Badge tone={admin.status === 'active' ? 'primary' : 'neutral'}>
                      {admin.roleName}
                    </Badge>
                  )}
                </div>

                {/* Permissions Breakdown */}
                <div className="space-y-1.5 pt-2 border-t border-white/5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                    Assigned Capabilities:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {admin.isProtectedSuperAdmin ? (
                      <span className="px-2 py-0.5 rounded-md bg-danger-muted/30 text-danger text-[10px] font-semibold">
                        Full System Access (*)
                      </span>
                    ) : admin.permissions.length > 0 ? (
                      admin.permissions.map((perm) => (
                        <span
                          key={perm}
                          className="px-2 py-0.5 rounded-md bg-surface-elevated text-text text-[10px] font-mono"
                        >
                          {perm}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] text-muted italic">Standard Management</span>
                    )}
                  </div>
                </div>

                {/* Account Metadata */}
                <div className="pt-2 text-[10px] text-muted space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>Provisioned</span>
                    </span>
                    <span>{new Date(admin.createdAt).toLocaleDateString()}</span>
                  </div>
                  {admin.lastLoginAt && (
                    <div className="flex items-center justify-between">
                      <span>Last Active</span>
                      <span>{new Date(admin.lastLoginAt).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-white/5 flex items-center justify-end gap-2">
                {!admin.isProtectedSuperAdmin && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditAdmin(admin);
                        setEditRoleId(admin.roleId || '');
                        setEditStatus(admin.status as 'active' | 'inactive' | 'suspended');
                      }}
                      className="gap-1 text-xs"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit Access</span>
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleRevokeAdmin(admin)}
                      loading={revokingId === admin.id}
                      className="gap-1 text-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Revoke</span>
                    </Button>
                  </>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Provision Admin Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-3xl bg-surface-elevated shadow-2xl p-6 sm:p-7 space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shadow-sm shrink-0">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-text">Provision New Administrator</h3>
                  <p className="text-xs text-muted">Assign institutional access & privileges</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="p-1.5 rounded-lg text-muted hover:text-text hover:bg-surface"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAdmin} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-medium text-text block">Administrator Full Name</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Dr. Rajesh K (Sports Director)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface text-text text-xs focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium text-text block">Institutional Email Address</label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="e.g. rajesh.k@rajalakshmi.edu.in"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface text-text text-xs focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
                />
                <p className="text-[11px] text-muted">
                  Must be an official REC email address for Google OAuth verification.
                </p>
              </div>

              <div className="space-y-1">
                <label className="font-medium text-text block">Phone Number (Optional)</label>
                <input
                  type="tel"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="e.g. +91 9876543210"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface text-text text-xs focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium text-text block">Role & Permission Template</label>
                <select
                  value={formRoleId}
                  onChange={(e) => setFormRoleId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface text-text text-xs focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} {r.description ? `— ${r.description}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {selectedRole && (
                <div className="p-3 rounded-2xl bg-surface space-y-2">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" />
                    <span className="font-bold text-text text-xs">{selectedRole.name}</span>
                  </div>
                  <p className="text-[11px] text-muted">{selectedRole.description}</p>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {selectedRole.permissions.map((p) => (
                      <span
                        key={p}
                        className="px-2 py-0.5 rounded-md bg-surface-elevated text-text text-[10px] font-mono"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-white/5">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => setCreateModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  loading={creating}
                  className="gap-1.5"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Provision Administrator</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Admin Modal */}
      {editAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-3xl bg-surface-elevated shadow-2xl p-6 sm:p-7 space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shadow-sm shrink-0">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-text">Edit Administrator Access</h3>
                  <p className="text-xs text-muted">{editAdmin.name} ({editAdmin.email})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditAdmin(null)}
                className="p-1.5 rounded-lg text-muted hover:text-text hover:bg-surface"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateAdmin} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-medium text-text block">Assigned Role</label>
                <select
                  value={editRoleId}
                  onChange={(e) => setEditRoleId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface text-text text-xs focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              {editSelectedRole && (
                <div className="p-3 rounded-2xl bg-surface space-y-2">
                  <p className="text-[11px] text-muted">{editSelectedRole.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {editSelectedRole.permissions.map((p) => (
                      <span
                        key={p}
                        className="px-2 py-0.5 rounded-md bg-surface-elevated text-text text-[10px] font-mono"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="font-medium text-text block">Account Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as 'active' | 'inactive' | 'suspended')}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface text-text text-xs focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
                >
                  <option value="active">Active (Access Granted)</option>
                  <option value="suspended">Suspended (Access Revoked)</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-white/5">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => setEditAdmin(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  loading={updating}
                >
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
