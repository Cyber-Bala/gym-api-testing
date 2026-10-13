import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  UserCheck,
  ShieldAlert,
  GraduationCap,
  AlertCircle,
  FileSpreadsheet,
  Award,
  UserPlus,
  Calendar,
  Trash2,
} from 'lucide-react';
import { Card, Badge, Alert, Modal } from '../ui/primitives';
import { Button, IconButton } from '../ui/Button';
import { SearchInput, Select, Input } from '../ui/Input';
import { ExcelImportModal } from './ExcelImportModal';
import { AdminStudentBookingsModal } from './AdminStudentBookingsModal';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { cn } from '../lib/cn';
import { SyncStatusBanner } from './SyncStatusBanner';

interface StudentItem {
  id: string;
  personId: string;
  rollNumber: string;
  name: string;
  email: string;
  phone: string | null;
  department: string;
  joiningYear: number;
  residency: string;
  gender: string;
  faceEnrollmentStatus: string;
  category: string;
  source: 'app' | 'zkbio';
  zkbioSynced: boolean;
  isBanned: boolean;
  violationCount: number;
  status: string;
  createdAt: string;
  isTrainer: boolean;
}

type CategoryKey =
  | ''
  | 'day_scholar_boys'
  | 'day_scholar_girls'
  | 'hosteller_boys'
  | 'hosteller_girls'
  | 'other';

type FaceFilter = '' | 'enrolled' | 'on_zkbio' | 'pending' | 'not_enrolled';
type SourceFilter = '' | 'app' | 'zkbio';

interface CategoryBreakdown {
  dayScholarBoys: number;
  dayScholarGirls: number;
  hostellerBoys: number;
  hostellerGirls: number;
  other: number;
}

const CATEGORY_OPTIONS: { value: CategoryKey; label: string }[] = [
  { value: '', label: 'All Students' },
  { value: 'day_scholar_boys', label: 'Day Scholar — Boys' },
  { value: 'day_scholar_girls', label: 'Day Scholar — Girls' },
  { value: 'hosteller_boys', label: 'Hosteller — Boys' },
  { value: 'hosteller_girls', label: 'Hosteller — Girls' },
  { value: 'other', label: 'Staff / Other' },
];

const FACE_OPTIONS: { value: FaceFilter; label: string }[] = [
  { value: '', label: 'Face: any' },
  { value: 'enrolled', label: 'Face: on gate (ZKBio)' },
  { value: 'on_zkbio', label: 'Face: in ZKBio (imported)' },
  { value: 'pending', label: 'Face: saved, waiting' },
  { value: 'not_enrolled', label: 'Face: not registered' },
];

const SOURCE_OPTIONS: { value: SourceFilter; label: string }[] = [
  { value: '', label: 'Source: any' },
  { value: 'app', label: 'Source: added in this app' },
  { value: 'zkbio', label: 'Source: from ZKBio' },
];

const faceBadge = (status: string): { tone: 'success' | 'warning' | 'danger' | 'neutral'; label: string } => {
  if (status === 'enrolled') return { tone: 'success', label: 'On gate' };
  if (status === 'on_zkbio') return { tone: 'neutral', label: 'In ZKBio' };
  if (status === 'pending') return { tone: 'warning', label: 'Saved, waiting' };
  return { tone: 'danger', label: 'No face' };
};

const getCategoryLabel = (residency: string, gender: string): string => {
  const isGirl = gender === 'female';
  if (residency === 'hosteller') return isGirl ? 'Hosteller • Girls' : 'Hosteller • Boys';
  return isGirl ? 'Day Scholar • Girls' : 'Day Scholar • Boys';
};

interface StudentDirectoryProps {
  onOpenImport?: () => void;
}

const DEPARTMENTS = [
  'Computer Science and Engineering',
  'Information Technology',
  'Artificial Intelligence & Machine Learning',
  'Electronics and Communication Engineering',
  'Electrical and Electronics Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'Biotechnology',
  'Biomedical Engineering',
  'Chemical Engineering',
  'Aeronautical Engineering',
  'Management Studies (MBA)',
];

export const StudentDirectory: React.FC<StudentDirectoryProps> = ({ onOpenImport }) => {
  const toast = useToast();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [togglingResidencyId, setTogglingResidencyId] = useState<string | null>(null);
  const [togglingGenderId, setTogglingGenderId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmStudent, setDeleteConfirmStudent] = useState<StudentItem | null>(null);
  const [forceDelete, setForceDelete] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [category, setCategory] = useState<CategoryKey>('');
  const [face, setFace] = useState<FaceFilter>('');
  const [source, setSource] = useState<SourceFilter>('');
  const [breakdown, setBreakdown] = useState<CategoryBreakdown>({
    dayScholarBoys: 0,
    dayScholarGirls: 0,
    hostellerBoys: 0,
    hostellerGirls: 0,
    other: 0,
  });
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [importOpen, setImportOpen] = useState<boolean>(false);

  const [bookingModalStudent, setBookingModalStudent] = useState<{
    name: string;
    email: string;
    rollNumber: string;
  } | null>(null);

  // Add Single Student Modal State
  const [addModalOpen, setAddModalOpen] = useState<boolean>(false);
  const [addingStudent, setAddingStudent] = useState<boolean>(false);
  const [formData, setFormData] = useState({
    name: '',
    rollNumber: '',
    email: '',
    department: 'Computer Science and Engineering',
    customDepartment: '',
    joiningYear: new Date().getFullYear(),
    residency: 'day_scholar' as 'day_scholar' | 'hosteller',
    gender: 'male' as 'male' | 'female',
  });

  const fetchStudents = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (category) params.append('category', category);
      if (face) params.append('face', face);
      if (source) params.append('source', source);
      params.append('page', String(page));
      params.append('limit', '10');

      const res = await fetch(`/api/v1/people/students?${params.toString()}`, {
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to load student directory');

      setStudents(data.data.items || []);
      setTotalPages(data.data.pagination.totalPages || 1);
      setTotalCount(data.data.pagination.total || 0);
      if (data.data.breakdown) setBreakdown(data.data.breakdown);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [page, category, face, source]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchStudents();
  };

  const handleToggleTrainer = async (stu: StudentItem) => {
    setTogglingId(stu.id);
    try {
      await api.patch(`/api/v1/people/students/${stu.id}/trainer-role`, {
        isTrainer: !stu.isTrainer,
      });
      toast.success(
        `Successfully ${!stu.isTrainer ? 'assigned' : 'removed'} trainer role for ${stu.name}`
      );
      fetchStudents();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update trainer role');
    } finally {
      setTogglingId(null);
    }
  };

  const handleToggleResidency = async (stu: StudentItem) => {
    setTogglingResidencyId(stu.id);
    try {
      const newResidency = stu.residency === 'hosteller' ? 'day_scholar' : 'hosteller';
      await api.patch(`/api/v1/people/students/${stu.id}/residency`, {
        residency: newResidency,
      });
      const targetBucket = getCategoryLabel(newResidency, stu.gender || 'male');
      toast.success(
        `Successfully updated ${stu.name}'s residency to ${newResidency === 'hosteller' ? 'Hosteller' : 'Day Scholar'} — now listed under ${targetBucket}`
      );
      fetchStudents();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update residency');
    } finally {
      setTogglingResidencyId(null);
    }
  };

  const handleToggleGender = async (stu: StudentItem) => {
    setTogglingGenderId(stu.id);
    try {
      const newGender = (stu.gender || 'male') === 'male' ? 'female' : 'male';
      await api.patch(`/api/v1/people/students/${stu.id}/gender`, {
        gender: newGender,
      });
      const targetBucket = getCategoryLabel(stu.residency, newGender);
      toast.success(
        `Successfully updated ${stu.name} to ${newGender === 'female' ? 'Girl' : 'Boy'} — now listed under ${targetBucket}`
      );
      fetchStudents();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update gender');
    } finally {
      setTogglingGenderId(null);
    }
  };

  const handleDeleteStudent = async (force = false) => {
    if (!deleteConfirmStudent) return;
    setDeletingId(deleteConfirmStudent.id);
    try {
      const qs = force ? '?force=true' : '';
      const res = await fetch(`/api/v1/people/students/${deleteConfirmStudent.id}${qs}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: force ? JSON.stringify({ force: true }) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error?.message || data.message || 'Delete failed');
      toast.success(
        `${deleteConfirmStudent.name} (${deleteConfirmStudent.rollNumber}) deleted from this app, the Gym API, ZKBio and the face service.`,
        'Student Deleted'
      );
      setDeleteConfirmStudent(null);
      setForceDelete(false);
      fetchStudents();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete student');
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalDepartment = formData.department === 'Other' ? formData.customDepartment.trim() : formData.department;

    if (!formData.name.trim() || !formData.rollNumber.trim() || !formData.email.trim() || !finalDepartment) {
      toast.error('Please fill in all required fields.');
      return;
    }

    setAddingStudent(true);
    try {
      const targetBucket = getCategoryLabel(formData.residency, formData.gender);
      await api.post('/api/v1/people/students', {
        name: formData.name.trim(),
        rollNumber: formData.rollNumber.trim().toUpperCase(),
        email: formData.email.trim().toLowerCase(),
        department: finalDepartment,
        joiningYear: Number(formData.joiningYear),
        residency: formData.residency,
        gender: formData.gender,
      });

      toast.success(`Student '${formData.rollNumber.toUpperCase()}' registered successfully! Listed under ${targetBucket}.`);
      setAddModalOpen(false);
      setFormData({
        name: '',
        rollNumber: '',
        email: '',
        department: 'Computer Science and Engineering',
        customDepartment: '',
        joiningYear: new Date().getFullYear(),
        residency: 'day_scholar',
        gender: 'male',
      });
      fetchStudents();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg, 'Failed to Add Student');
    } finally {
      setAddingStudent(false);
    }
  };

  return (
    <Card className="space-y-6">
      <SyncStatusBanner />
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-base sm:text-lg text-text flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-primary" />
            <span>Provisioned Student Directory</span>
          </h3>
          <p className="text-xs text-muted">
            {totalCount} verified student accounts • Day Boys {breakdown.dayScholarBoys} • Day Girls {breakdown.dayScholarGirls} • Hostel Boys {breakdown.hostellerBoys} • Hostel Girls {breakdown.hostellerGirls} • Staff / Other {breakdown.other}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setAddModalOpen(true)}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Student</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => (onOpenImport ? onOpenImport() : setImportOpen(true))}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-accent" />
            <span>Bulk Import Excel</span>
          </Button>

          <IconButton
            label="Refresh list"
            size="sm"
            onClick={fetchStudents}
            disabled={loading}
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          </IconButton>
        </div>
      </div>

      {/* Category Tabs — 4 buckets */}
      <div className="flex flex-wrap gap-2">
        {CATEGORY_OPTIONS.map((opt) => {
          const count =
            opt.value === ''
              ? totalCount
              : opt.value === 'day_scholar_boys'
                ? breakdown.dayScholarBoys
                : opt.value === 'day_scholar_girls'
                  ? breakdown.dayScholarGirls
                  : opt.value === 'hosteller_boys'
                    ? breakdown.hostellerBoys
                    : opt.value === 'hosteller_girls'
                      ? breakdown.hostellerGirls
                      : breakdown.other;
          const active = category === opt.value;
          return (
            <button
              key={opt.value || 'all'}
              type="button"
              onClick={() => {
                setCategory(opt.value);
                setPage(1);
              }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                active
                  ? 'bg-primary text-white border-primary shadow-sm'
                  : 'bg-surface-elevated text-muted border-border hover:text-text'
              )}
            >
              {opt.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Roll Number, Name, or Email..."
          />
        </form>

        <div className="w-full sm:w-60 shrink-0">
          <Select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as CategoryKey);
              setPage(1);
            }}
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="w-full sm:w-52 shrink-0">
          <Select
            value={face}
            onChange={(e) => {
              setFace(e.target.value as FaceFilter);
              setPage(1);
            }}
          >
            {FACE_OPTIONS.map((opt) => (
              <option key={opt.value || 'any'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="w-full sm:w-52 shrink-0">
          <Select
            value={source}
            onChange={(e) => {
              setSource(e.target.value as SourceFilter);
              setPage(1);
            }}
          >
            {SOURCE_OPTIONS.map((opt) => (
              <option key={opt.value || 'any'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {error && (
        <Alert tone="danger">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-danger shrink-0" />
            <span>{error}</span>
          </div>
        </Alert>
      )}

      {/* Directory Table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-xs text-left">
          <thead className="bg-border-subtle/60 text-muted font-semibold">
            <tr>
              <th className="py-3 px-4">Student</th>
              <th className="py-3 px-4">Department & Year</th>
              <th className="py-3 px-4">Category</th>
              <th className="py-3 px-4">Gender</th>
              <th className="py-3 px-4">Role</th>
              <th className="py-3 px-4">Face Scan</th>
              <th className="py-3 px-4">Discipline</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-text">
            {loading && students.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-muted">
                  Loading directory records...
                </td>
              </tr>
            ) : students.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-muted">
                  No students found matching current filters.
                </td>
              </tr>
            ) : (
              students.map((stu) => (
                <tr key={stu.id} className="hover:bg-border-subtle/30 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-text flex items-center gap-1.5">
                      {stu.name}
                      {stu.source === 'zkbio' && <Badge tone="neutral">ZKBio</Badge>}
                    </div>
                    <div className="text-[11px] font-mono text-muted">
                      {stu.rollNumber}
                      {stu.source === 'zkbio' ? '' : ` • ${stu.email}`}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-secondary">{stu.department}</div>
                    <div className="text-[11px] text-muted">Batch of {stu.joiningYear}</div>
                  </td>
                  <td className="py-3 px-4">
                    {stu.category === 'other' ? (
                      <Badge tone="neutral">Staff / Other</Badge>
                    ) : (
                    <button
                      type="button"
                      onClick={() => handleToggleResidency(stu)}
                      disabled={togglingResidencyId === stu.id}
                      className={cn(
                        'transition-all cursor-pointer disabled:opacity-50 disabled:cursor-wait',
                        togglingResidencyId === stu.id && 'animate-pulse'
                      )}
                      title="Click to toggle residency (Day Scholar / Hosteller)"
                    >
                      <Badge tone={stu.residency === 'hosteller' ? 'accent' : 'neutral'}>
                        {getCategoryLabel(stu.residency, stu.gender || 'male')}
                      </Badge>
                    </button>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => handleToggleGender(stu)}
                      disabled={togglingGenderId === stu.id}
                      className={cn(
                        'transition-all cursor-pointer disabled:opacity-50 disabled:cursor-wait',
                        togglingGenderId === stu.id && 'animate-pulse'
                      )}
                      title="Click to toggle Boys / Girls"
                    >
                      <Badge tone={(stu.gender || 'male') === 'female' ? 'primary' : 'neutral'}>
                        {(stu.gender || 'male') === 'female' ? 'Girls' : 'Boys'}
                      </Badge>
                    </button>
                  </td>
                  <td className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => handleToggleTrainer(stu)}
                      disabled={togglingId === stu.id}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium text-[11px] transition-all',
                        stu.isTrainer
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-sm'
                          : 'bg-surface-elevated text-muted hover:text-text border border-border',
                        togglingId === stu.id && 'opacity-60 cursor-wait'
                      )}
                      title={stu.isTrainer ? 'Click to remove Trainer role' : 'Click to assign Trainer role'}
                    >
                      <Award className={cn('w-3.5 h-3.5', stu.isTrainer ? 'text-amber-400' : 'text-muted')} />
                      <span>{stu.isTrainer ? 'Trainer' : 'Student'}</span>
                    </button>
                  </td>
                  <td className="py-3 px-4">
                    <Badge tone={faceBadge(stu.faceEnrollmentStatus).tone}>
                      {faceBadge(stu.faceEnrollmentStatus).label}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    {stu.isBanned ? (
                      <span className="text-danger font-bold flex items-center gap-1">
                        <ShieldAlert className="w-3.5 h-3.5" /> Banned ({stu.violationCount})
                      </span>
                    ) : (
                      <span className="text-muted">{stu.violationCount} strikes</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className="flex items-center gap-1 text-success font-medium capitalize">
                      <UserCheck className="w-3.5 h-3.5" /> {stu.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="outline"
                        size="xs"
                        className="flex items-center gap-1 text-[11px]"
                        onClick={() => setBookingModalStudent({
                          name: stu.name,
                          email: stu.email,
                          rollNumber: stu.rollNumber
                        })}
                      >
                        <Calendar className="w-3 h-3" /> Bookings
                      </Button>
                      {isSuperAdmin && (
                        <IconButton
                          label={`Delete ${stu.name}`}
                          size="sm"
                          className="text-danger hover:bg-danger/10 border-danger/30"
                          onClick={() => setDeleteConfirmStudent(stu)}
                          disabled={deletingId === stu.id}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </IconButton>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 text-xs text-muted">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="xs"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="xs"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Add Single Student Modal */}
      <Modal
        open={addModalOpen}
        title="Add Single Student"
        onClose={() => setAddModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setAddModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={addingStudent}
              onClick={handleCreateStudent}
            >
              Register Student
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateStudent} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Full Name"
              type="text"
              required
              placeholder="e.g. Karthik Raja"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />

            <Input
              label="Roll Number"
              type="text"
              required
              placeholder="e.g. 2024CS001"
              value={formData.rollNumber}
              onChange={(e) => setFormData({ ...formData, rollNumber: e.target.value })}
            />
          </div>

          <Input
            label="College Email"
            type="email"
            required
            placeholder="e.g. karthik.24cs@rajalakshmi.edu.in"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Department"
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
            >
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
              <option value="Other">Other / Custom Department</option>
            </Select>

            {formData.department === 'Other' ? (
              <Input
                label="Custom Department Name"
                type="text"
                required
                placeholder="Enter department name"
                value={formData.customDepartment}
                onChange={(e) => setFormData({ ...formData, customDepartment: e.target.value })}
              />
            ) : (
              <Input
                label="Joining Year"
                type="number"
                required
                min={2000}
                max={2050}
                value={formData.joiningYear}
                onChange={(e) => setFormData({ ...formData, joiningYear: Number(e.target.value) })}
              />
            )}
          </div>

          {formData.department === 'Other' && (
            <Input
              label="Joining Year"
              type="number"
              required
              min={2000}
              max={2050}
              value={formData.joiningYear}
              onChange={(e) => setFormData({ ...formData, joiningYear: Number(e.target.value) })}
            />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Residency Type"
              value={formData.residency}
              onChange={(e) => setFormData({ ...formData, residency: e.target.value as 'day_scholar' | 'hosteller' })}
            >
              <option value="day_scholar">Day Scholar (Gym Membership Pass Required)</option>
              <option value="hosteller">Hosteller (Free Inclusive Access)</option>
            </Select>

            <Select
              label="Gender (Boys / Girls)"
              value={formData.gender}
              onChange={(e) => setFormData({ ...formData, gender: e.target.value as 'male' | 'female' })}
            >
              <option value="male">Boys</option>
              <option value="female">Girls</option>
            </Select>
          </div>
          <p className="text-[11px] text-muted bg-border-subtle/40 border border-border rounded-lg px-3 py-2">
            Will be listed under: <span className="font-bold text-text">{getCategoryLabel(formData.residency, formData.gender)}</span>
            {' '}— Day Scholar Boys / Day Scholar Girls / Hosteller Boys / Hosteller Girls auto-routing.
          </p>
        </form>
      </Modal>

      <ExcelImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={() => {
          setImportOpen(false);
          fetchStudents();
        }}
      />

      {/* Bookings Modal */}
      {bookingModalStudent && (
        <AdminStudentBookingsModal
          isOpen={true}
          onClose={() => setBookingModalStudent(null)}
          student={bookingModalStudent}
        />
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirmStudent && (
        <Modal
          open={true}
          title="Permanently Delete Student"
          onClose={() => setDeleteConfirmStudent(null)}
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setDeleteConfirmStudent(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={deletingId === deleteConfirmStudent.id}
                onClick={() => handleDeleteStudent(forceDelete)}
                className="bg-danger hover:bg-danger/90 border-danger"
              >
                <Trash2 className="w-3.5 h-3.5" /> {forceDelete ? 'Force Delete Anyway' : 'Yes, Delete Permanently'}
              </Button>
            </>
          }
        >
          <div className="space-y-4 text-sm">
            <Alert tone="danger">
              <div className="flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-danger" />
                <div>
                  <p className="font-bold">This action is irreversible.</p>
                  <p className="text-xs mt-1 text-muted">
                    This will permanently remove the student from:
                  </p>
                  <ul className="text-xs text-muted list-disc list-inside mt-1 space-y-0.5">
                    <li>The gym app database (bookings, memberships, violations, etc.)</li>
                    <li>The face service (their photo and face data)</li>
                    {deleteConfirmStudent.source === 'zkbio' ? (
                      <li className="font-semibold text-text">
                        ZKBio is NOT changed: this person came from ZKBio, so only the gym app copy is removed.
                      </li>
                    ) : (
                      <>
                        <li>The Gym API database</li>
                        <li>ZKBio (their face and access are removed)</li>
                      </>
                    )}
                  </ul>
                </div>
              </div>
            </Alert>
            <div className="rounded-xl bg-surface-elevated border border-border p-3 space-y-1">
              <p className="font-bold text-text">{deleteConfirmStudent.name}</p>
              <p className="text-xs font-mono text-muted">
                {deleteConfirmStudent.rollNumber} · {deleteConfirmStudent.email}
              </p>
              <p className="text-xs text-muted">{deleteConfirmStudent.department}</p>
            </div>
            <p className="text-xs text-muted">
              Are you sure you want to delete this student? Type their name to confirm below if in doubt.
            </p>
            <label className="flex items-start gap-2 text-xs text-muted bg-border-subtle/40 border border-border rounded-lg px-3 py-2 cursor-pointer">
              <input
                type="checkbox"
                checked={forceDelete}
                onChange={(e) => setForceDelete(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <span className="font-bold text-text">Force delete even if device panel is offline.</span>
                <br />
                Use when you get HTTP 502 / Bad Gateway — removes from app + api_app now; panel row is cleaned on next sync push.
              </span>
            </label>
          </div>
        </Modal>
      )}
    </Card>

  );
};
