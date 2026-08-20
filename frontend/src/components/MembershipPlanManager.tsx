import React, { useState, useEffect, useCallback } from 'react';
import { Plus, CreditCard, Power, PowerOff, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { Card, Badge, Stat, PageHeader, Modal, EmptyState } from '../ui/primitives';
import { Button, IconButton } from '../ui/Button';
import { Input, Select } from '../ui/Input';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { cn } from '../lib/cn';

interface Plan {
  id: string;
  name: string;
  durationDays: number;
  price: string;
  isActive: string;
}

interface PlanForm {
  name: string;
  durationDays: string;
  price: string;
  isActive: 'active' | 'inactive';
}

const emptyForm: PlanForm = { name: '', durationDays: '', price: '', isActive: 'active' };

export const MembershipPlanManager: React.FC = () => {
  const toast = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PlanForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<Plan[]>('/api/v1/membership/plans/manage');
      setPlans(Array.isArray(data) ? data : []);
    } catch {
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeCount = plans.filter((p) => p.isActive === 'active').length;
  const inactiveCount = plans.length - activeCount;

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (plan: Plan) => {
    setEditingId(plan.id);
    setForm({
      name: plan.name,
      durationDays: String(plan.durationDays),
      price: String(parseFloat(plan.price) || 0),
      isActive: plan.isActive === 'active' ? 'active' : 'inactive',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        durationDays: parseInt(form.durationDays, 10),
        price: parseFloat(form.price),
        isActive: form.isActive,
      };

      if (editingId) {
        await api.patch(`/api/v1/membership/plans/${editingId}`, payload);
        toast.success('Plan updated');
      } else {
        await api.post('/api/v1/membership/plans', payload);
        toast.success('Plan created');
      }

      setModalOpen(false);
      load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg, 'Save Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (plan: Plan) => {
    setTogglingId(plan.id);
    try {
      await api.post(`/api/v1/membership/plans/${plan.id}/toggle`, {
        isActive: plan.isActive !== 'active',
      });
      toast.success(plan.isActive === 'active' ? 'Plan deactivated' : 'Plan activated');
      load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg, 'Update Failed');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (plan: Plan) => {
    if (!window.confirm(`Are you sure you want to permanently delete the "${plan.name}" membership package?`)) {
      return;
    }
    setDeletingId(plan.id);
    try {
      await api.delete(`/api/v1/membership/plans/${plan.id}`);
      toast.success(`Package "${plan.name}" deleted successfully.`);
      load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg, 'Delete Failed');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Membership Plans"
        badge={<Badge tone="primary">Admin</Badge>}
        actions={
          <>
            <IconButton label="Refresh plans" size="sm" onClick={load}>
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            </IconButton>
            <Button variant="primary" size="sm" onClick={openCreate}>
              <Plus className="w-4 h-4 text-accent" />
              <span>Add Plan</span>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat label="Total Plans" value={plans.length} icon={<CreditCard className="w-4 h-4" />} />
        <Stat label="Active" value={activeCount} icon={<Power className="w-4 h-4" />} />
        <Stat label="Inactive" value={inactiveCount} icon={<PowerOff className="w-4 h-4" />} />
      </div>

      <Card className="space-y-3">
        {loading ? (
          <div className="py-10 text-center text-xs text-muted">Loading plans...</div>
        ) : plans.length === 0 ? (
          <EmptyState icon={<CreditCard className="w-6 h-6" />} title="No membership plans" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border text-muted font-medium">
                  <th className="py-2.5 px-3">Plan</th>
                  <th className="py-2.5 px-3">Duration</th>
                  <th className="py-2.5 px-3">Price</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {plans.map((p) => (
                  <tr key={p.id} className="hover:bg-border-subtle/40 transition-colors">
                    <td className="py-3 px-3 font-bold text-text">{p.name}</td>
                    <td className="py-3 px-3 text-secondary">{p.durationDays} days</td>
                    <td className="py-3 px-3 font-bold text-text">₹{p.price}</td>
                    <td className="py-3 px-3">
                      <Badge tone={p.isActive === 'active' ? 'success' : 'neutral'}>
                        {p.isActive === 'active' ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <IconButton label="Edit plan" size="sm" variant="ghost" onClick={() => openEdit(p)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </IconButton>
                        <Button
                          variant={p.isActive === 'active' ? 'secondary' : 'success'}
                          size="xs"
                          loading={togglingId === p.id}
                          onClick={() => handleToggle(p)}
                        >
                          {p.isActive === 'active' ? 'Deactivate' : 'Activate'}
                        </Button>
                        <IconButton
                          label="Delete package"
                          size="sm"
                          variant="danger"
                          disabled={deletingId === p.id}
                          onClick={() => handleDelete(p)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={modalOpen}
        title={editingId ? 'Edit Membership Plan' : 'Add Membership Plan'}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" loading={saving} onClick={handleSubmit}>
              {editingId ? 'Save Changes' : 'Create Plan'}
            </Button>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit(e);
          }}
          className="space-y-4"
        >
          <Input
            label="Plan Name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Monthly Pass"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Duration (Days)"
              required
              type="number"
              min={1}
              value={form.durationDays}
              onChange={(e) => setForm({ ...form, durationDays: e.target.value })}
            />
            <Input
              label="Price (₹)"
              required
              type="number"
              min={0}
              step="0.01"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
          </div>
          <Select
            label="Status"
            value={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.value as 'active' | 'inactive' })}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </form>
      </Modal>
    </div>
  );
};