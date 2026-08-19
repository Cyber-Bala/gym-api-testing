import React, { useState, useEffect } from 'react';
import { RefreshCw, UserCheck, ShieldAlert, GraduationCap, CheckCircle2, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { Card, Badge, Alert } from '../ui/primitives';
import { Button, IconButton } from '../ui/Button';
import { SearchInput, Select } from '../ui/Input';
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
}

interface StudentDirectoryProps {
  onOpenImport?: () => void;
}


export const StudentDirectory: React.FC<StudentDirectoryProps> = ({ onOpenImport }) => {
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [residency, setResidency] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

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
          <IconButton
            label="Refresh list"
            size="sm"
            onClick={fetchStudents}
            disabled={loading}
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          </IconButton>

          <Button
            variant="primary"
            size="sm"
            onClick={onOpenImport}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-accent" />
            <span>Bulk Import Excel</span>
          </Button>
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

      {/* Error Alert */}
      {error && (
        <Alert tone="danger" onDismiss={() => setError(null)}>
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-danger shrink-0" />
            <span>{error}</span>
          </div>
        </Alert>
      )}

      {/* Directory Table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-xs">
          <thead className="bg-border-subtle/50 text-muted font-semibold border-b border-border">
            <tr>
              <th className="py-3 px-4">Roll Number</th>
              <th className="py-3 px-4">Student Name</th>
              <th className="py-3 px-4">Department</th>
              <th className="py-3 px-4">Residency</th>
              <th className="py-3 px-4">Face Scan</th>
              <th className="py-3 px-4">Violations</th>
              <th className="py-3 px-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-text">
            {students.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-muted">
                  {loading ? 'Loading students...' : 'No student records found matching filters'}
                </td>
              </tr>
            ) : (
              students.map((stu) => (
                <tr key={stu.id} className="hover:bg-border-subtle/30 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-text">
                    {stu.rollNumber}
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-semibold text-text">{stu.name}</p>
                    <p className="text-[11px] text-muted font-mono">{stu.email}</p>
                  </td>
                  <td className="py-3 px-4 text-secondary">{stu.department}</td>
                  <td className="py-3 px-4">
                    <Badge tone={stu.residency === 'hosteller' ? 'success' : 'neutral'}>
                      {stu.residency.replace('_', ' ')}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    {stu.faceEnrollmentStatus === 'enrolled' ? (
                      <span className="flex items-center gap-1 text-[11px] text-success font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Enrolled
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] text-muted">
                        Pending Scan
                      </span>
                    )}
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
    </Card>
  );
};

