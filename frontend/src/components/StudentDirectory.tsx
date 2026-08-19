import React, { useState, useEffect } from 'react';
import { Search, Filter, RefreshCw, UserCheck, ShieldAlert, GraduationCap, CheckCircle2, AlertCircle } from 'lucide-react';

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
  onOpenImport: () => void;
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
    <div className="bg-white dark:bg-[#18181B] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-rec-purple dark:text-rec-gold" />
            Provisioned Student Directory
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {totalCount} total verified student accounts ({students.filter(s => s.residency === 'hosteller').length} Hostellers loaded)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchStudents}
            disabled={loading}
            className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={onOpenImport}
            className="px-4 py-2 rounded-xl bg-rec-purple hover:bg-rec-purple-600 text-white font-medium text-xs shadow-md shadow-rec-purple/20 transition-all"
          >
            + Bulk Import Excel
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row items-center gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Roll Number, Name, or Email..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-gray-50 dark:bg-[#202024] border border-gray-200 dark:border-gray-700/80 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rec-purple/50"
          />
        </form>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-gray-400 shrink-0" />
          <select
            value={residency}
            onChange={(e) => {
              setResidency(e.target.value);
              setPage(1);
            }}
            className="w-full md:w-44 py-2 px-3 rounded-xl bg-gray-50 dark:bg-[#202024] border border-gray-200 dark:border-gray-700/80 text-xs text-gray-900 dark:text-white focus:outline-none"
          >
            <option value="">All Residencies</option>
            <option value="hosteller">Hostellers (Free)</option>
            <option value="day_scholar">Day Scholars (Pass Required)</option>
          </select>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Directory Table */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-50 dark:bg-[#202024] text-gray-600 dark:text-gray-300 font-semibold border-b border-gray-200 dark:border-gray-800">
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
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 text-gray-700 dark:text-gray-300">
            {students.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-400">
                  {loading ? 'Loading students...' : 'No student records found matching filters'}
                </td>
              </tr>
            ) : (
              students.map((stu) => (
                <tr key={stu.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-gray-900 dark:text-white">
                    {stu.rollNumber}
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-semibold text-gray-900 dark:text-white">{stu.name}</p>
                    <p className="text-[11px] text-gray-400 font-mono">{stu.email}</p>
                  </td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{stu.department}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                        stu.residency === 'hosteller'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40'
                          : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/40'
                      }`}
                    >
                      {stu.residency.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {stu.faceEnrollmentStatus === 'enrolled' ? (
                      <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Enrolled
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] text-gray-400">
                        Pending Scan
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {stu.isBanned ? (
                      <span className="text-red-500 font-bold flex items-center gap-1">
                        <ShieldAlert className="w-3.5 h-3.5" /> Banned ({stu.violationCount})
                      </span>
                    ) : (
                      <span className="text-gray-500">{stu.violationCount} strikes</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium capitalize">
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
        <div className="flex items-center justify-between pt-2 text-xs text-gray-500">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
