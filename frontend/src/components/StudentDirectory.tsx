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
} from 'lucide-react';
import { Card, Badge, Alert, Modal } from '../ui/primitives';
import { Button, IconButton } from '../ui/Button';
import { SearchInput, Select, Input } from '../ui/Input';
import { ExcelImportModal } from './ExcelImportModal';
import { AdminStudentBookingsModal } from './AdminStudentBookingsModal';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { cn } from '../lib/cn';

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
  faceEnrollmentStatus: string;
  isBanned: boolean;
  violationCount: number;
  status: string;
  createdAt: string;
  isTrainer: boolean;
}

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
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [togglingResidencyId, setTogglingResidencyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [residency, setResidency] = useState<string>('');
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
  });

  const fetchStudents = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (residency) params.append('residency', residency);
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [page, residency]);

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
      toast.success(
        `Successfully updated ${stu.name}'s residency to ${newResidency === 'hosteller' ? 'Hosteller' : 'Day Scholar'}`
      );
      fetchStudents();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update residency');
    } finally {
      setTogglingResidencyId(null);
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
      await api.post('/api/v1/people/students', {
        name: formData.name.trim(),
        rollNumber: formData.rollNumber.trim().toUpperCase(),
        email: formData.email.trim().toLowerCase(),
        department: finalDepartment,
        joiningYear: Number(formData.joiningYear),
        residency: formData.residency,
      });

      toast.success(`Student '${formData.rollNumber.toUpperCase()}' registered successfully!`);
      setAddModalOpen(false);
      setFormData({
        name: '',
        rollNumber: '',
        email: '',
        department: 'Computer Science and Engineering',
        customDepartment: '',
        joiningYear: new Date().getFullYear(),
        residency: 'day_scholar',
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
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-base sm:text-lg text-text flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-primary" />
            <span>Provisioned Student Directory</span>
          </h3>
          <p className="text-xs text-muted">
            {totalCount} verified student accounts ({students.filter(s => s.residency === 'hosteller').length} Hostellers loaded)
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

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Roll Number, Name, or Email..."
          />
        </form>

        <div className="w-full sm:w-52 shrink-0">
          <Select
            value={residency}
            onChange={(e) => {
              setResidency(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Residencies</option>
            <option value="hosteller">Hostellers (Free)</option>
            <option value="day_scholar">Day Scholars (Pass Required)</option>
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
              <th className="py-3 px-4">Residency</th>
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
                <td colSpan={7} className="py-8 text-center text-muted">
                  Loading directory records...
                </td>
              </tr>
            ) : students.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-muted">
                  No students found matching current filters.
                </td>
              </tr>
            ) : (
              students.map((stu) => (
                <tr key={stu.id} className="hover:bg-border-subtle/30 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-text">{stu.name}</div>
                    <div className="text-[11px] font-mono text-muted">{stu.rollNumber} • {stu.email}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-secondary">{stu.department}</div>
                    <div className="text-[11px] text-muted">Batch of {stu.joiningYear}</div>
                  </td>
                  <td className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => handleToggleResidency(stu)}
                      disabled={togglingResidencyId === stu.id}
                      className={cn(
                        'transition-all cursor-pointer disabled:opacity-50 disabled:cursor-wait',
                        togglingResidencyId === stu.id && 'animate-pulse'
                      )}
                      title="Click to toggle residency"
                    >
                      <Badge tone={stu.residency === 'hosteller' ? 'accent' : 'neutral'}>
                        {stu.residency === 'hosteller' ? 'Hosteller' : 'Day Scholar'}
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
                    <Badge tone={stu.faceEnrollmentStatus === 'enrolled' ? 'success' : 'warning'}>
                      {stu.faceEnrollmentStatus === 'enrolled' ? 'Enrolled' : 'Pending'}
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
                    <Button
                      variant="outline"
                      size="xs"
                      className="ml-auto flex items-center gap-1 text-[11px]"
                      onClick={() => setBookingModalStudent({
                        name: stu.name,
                        email: stu.email,
                        rollNumber: stu.rollNumber
                      })}
                    >
                      <Calendar className="w-3 h-3" /> Bookings
                    </Button>
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

          <Select
            label="Residency Type"
            value={formData.residency}
            onChange={(e) => setFormData({ ...formData, residency: e.target.value as 'day_scholar' | 'hosteller' })}
          >
            <option value="day_scholar">Day Scholar (Gym Membership Pass Required)</option>
            <option value="hosteller">Hosteller (Free Inclusive Access)</option>
          </Select>
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
    </Card>
  );
};
