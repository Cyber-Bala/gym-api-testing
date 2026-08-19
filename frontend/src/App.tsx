import React, { useState } from 'react';
import { ThemeToggle } from './components/ThemeToggle';
import { SystemHealth } from './components/SystemHealth';
import { UserProfileBadge } from './components/UserProfileBadge';
import { ExcelImportModal } from './components/ExcelImportModal';
import { StudentDirectory } from './components/StudentDirectory';
import { AuthorizedPersonsManager } from './components/AuthorizedPersonsManager';
import { SlotBookingView } from './components/SlotBookingView';
import { MyBookingsCard } from './components/MyBookingsCard';
import { LiveOccupancyMonitor } from './components/LiveOccupancyMonitor';
import { ViolationManager } from './components/ViolationManager';
import { MembershipStore } from './components/MembershipStore';
import { TrainerTimesheet } from './components/TrainerTimesheet';
import { ExecutiveAnalyticsDashboard } from './components/ExecutiveAnalyticsDashboard';
import { DeviceBiometricsManager } from './components/DeviceBiometricsManager';
import { TrainerFloorManager } from './components/TrainerFloorManager';
import { ReportsCenter } from './components/ReportsCenter';
import { ConflictResolutionDesk } from './components/ConflictResolutionDesk';
import { DataLifecycleManager } from './components/DataLifecycleManager';
import { UatDemonstrationCenter } from './components/UatDemonstrationCenter';
import { useAuth } from './context/AuthContext';
import {
  Dumbbell,
  ShieldCheck,
  Layers,
  CalendarCheck,
  ArrowRight,
  CheckCircle2,
  UserCheck,
  FileSpreadsheet,
  GraduationCap,
  Shield,
  Activity,
  ShieldAlert,
  CreditCard,
  Award,
  TrendingUp,
  Cpu,
  Users,
  Archive,
  Sparkles,
} from 'lucide-react';

type AdminTab =
  | 'overview'
  | 'uat_demo'
  | 'students'
  | 'authorized_persons'
  | 'live_attendance'
  | 'floor_management'
  | 'biometrics'
  | 'violations'
  | 'conflicts'
  | 'reports'
  | 'lifecycle'
  | 'memberships'
  | 'trainer_shifts'
  | 'analytics';

export const App: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [importModalOpen, setImportModalOpen] = useState(false);

  const isAdminOrTrainer = user && ['admin', 'super_admin', 'trainer'].includes(user.role);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-white/80 dark:bg-[#0F0F12]/80 border-b border-gray-200 dark:border-gray-800/80 px-4 lg:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rec-purple dark:bg-rec-purple-700 flex items-center justify-center text-rec-gold shadow-md shadow-rec-purple/20 border border-rec-gold/30">
              <Dumbbell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-gray-900 dark:text-white">REC College Gym</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-rec-gold/20 text-rec-gold-700 dark:text-rec-gold border border-rec-gold/40">
                  Sprint 17 Production Release Complete
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Rajalakshmi Engineering College</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isAdminOrTrainer && (
              <button
                onClick={() => setImportModalOpen(true)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 text-xs font-semibold hover:bg-emerald-100 transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Bulk Excel Import</span>
              </button>
            )}
            <ThemeToggle />
            <UserProfileBadge />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 lg:px-8 py-8 space-y-8">
        {/* User Status / Banner */}
        {user ? (
          <div className="overflow-hidden rounded-3xl bg-white dark:bg-[#18181B] border border-gray-200 dark:border-gray-800 shadow-sm p-6 lg:p-8 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-rec-purple text-rec-gold font-bold text-xl flex items-center justify-center shadow-lg border border-rec-gold/30">
                  {user.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">{user.name}</h2>
                    <span className="text-xs uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-rec-purple-50 dark:bg-rec-purple-900/40 text-rec-purple dark:text-rec-gold border border-rec-purple-200 dark:border-rec-purple-800/50">
                      {user.role.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">{user.email}</p>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-2">
                <div className="px-3.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 text-xs font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Active Session
                </div>
              </div>
            </div>

            {/* Persona Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
              {user.studentDetails && (
                <>
                  <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-[#202024] border border-gray-100 dark:border-gray-800/80">
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">Roll Number</p>
                    <p className="font-semibold text-sm text-gray-900 dark:text-white font-mono mt-0.5">
                      {user.studentDetails.rollNumber}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-[#202024] border border-gray-100 dark:border-gray-800/80">
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">Residency Status</p>
                    <p className="font-semibold text-sm text-gray-900 dark:text-white capitalize mt-0.5">
                      {user.studentDetails.residency.replace('_', ' ')} (
                      {user.studentDetails.residency === 'hosteller' ? 'Free Gym' : 'Paid Pass'}
                      )
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-[#202024] border border-gray-100 dark:border-gray-800/80">
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">Department</p>
                    <p className="font-semibold text-sm text-gray-900 dark:text-white truncate mt-0.5">
                      {user.studentDetails.department}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-[#202024] border border-gray-100 dark:border-gray-800/80">
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">Violation Status</p>
                    <p className="font-semibold text-sm text-gray-900 dark:text-white mt-0.5">
                      {user.studentDetails.violationCount} Violations (
                      {user.studentDetails.isBanned ? 'Banned' : 'Clear'})
                    </p>
                  </div>
                </>
              )}

              {user.staffDetails && (
                <>
                  <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-[#202024] border border-gray-100 dark:border-gray-800/80">
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">Staff ID</p>
                    <p className="font-semibold text-sm text-gray-900 dark:text-white font-mono mt-0.5">
                      {user.staffDetails.staffId}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-[#202024] border border-gray-100 dark:border-gray-800/80">
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">Department</p>
                    <p className="font-semibold text-sm text-gray-900 dark:text-white mt-0.5">
                      {user.staffDetails.department}
                    </p>
                  </div>
                </>
              )}

              {user.isProtectedSuperAdmin && (
                <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 sm:col-span-2">
                  <p className="text-[11px] text-red-600 dark:text-red-400 font-semibold">Protected Super Admin Identity</p>
                  <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">
                    Unrestricted administrative capabilities. Cannot be deleted or disabled via normal CRM actions.
                  </p>
                </div>
              )}
            </div>

            {/* Admin Management Navigation Bar */}
            {isAdminOrTrainer && (
              <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex flex-wrap gap-2">
                <button
                  onClick={() => setActiveTab('uat_demo')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    activeTab === 'uat_demo'
                      ? 'bg-rec-gold text-gray-900 shadow-md shadow-rec-gold/20'
                      : 'bg-rec-gold/10 text-rec-gold hover:bg-rec-gold/20 border border-rec-gold/30'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>UAT & 12 Flows Console</span>
                </button>

                <button
                  onClick={() => setActiveTab('overview')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                    activeTab === 'overview'
                      ? 'bg-rec-purple text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  <span>Slot Booking & Availability</span>
                </button>

                <button
                  onClick={() => setActiveTab('students')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                    activeTab === 'students'
                      ? 'bg-rec-purple text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                  }`}
                >
                  <GraduationCap className="w-4 h-4" />
                  <span>Student Directory & Roster</span>
                </button>

                <button
                  onClick={() => setActiveTab('authorized_persons')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                    activeTab === 'authorized_persons'
                      ? 'bg-rec-purple text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  <span>Authorized Persons (VIP)</span>
                </button>

                <button
                  onClick={() => setActiveTab('live_attendance')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                    activeTab === 'live_attendance'
                      ? 'bg-rec-purple text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                  }`}
                >
                  <Activity className="w-4 h-4" />
                  <span>Live Attendance & Turnstiles</span>
                </button>

                <button
                  onClick={() => setActiveTab('floor_management')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                    activeTab === 'floor_management'
                      ? 'bg-rec-purple text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Floor & Overstayers</span>
                </button>

                <button
                  onClick={() => setActiveTab('biometrics')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                    activeTab === 'biometrics'
                      ? 'bg-rec-purple text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                  }`}
                >
                  <Cpu className="w-4 h-4" />
                  <span>Biometrics & Devices</span>
                </button>

                <button
                  onClick={() => setActiveTab('violations')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                    activeTab === 'violations'
                      ? 'bg-rec-purple text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                  }`}
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>Violations & Bans</span>
                </button>

                <button
                  onClick={() => setActiveTab('conflicts')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                    activeTab === 'conflicts'
                      ? 'bg-rec-purple text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                  }`}
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>Turnstile Conflicts</span>
                </button>

                <button
                  onClick={() => setActiveTab('reports')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                    activeTab === 'reports'
                      ? 'bg-rec-purple text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Reports & Export</span>
                </button>

                <button
                  onClick={() => setActiveTab('lifecycle')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                    activeTab === 'lifecycle'
                      ? 'bg-rec-purple text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                  }`}
                >
                  <Archive className="w-4 h-4" />
                  <span>Data Lifecycle & Archive</span>
                </button>

                <button
                  onClick={() => setActiveTab('memberships')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                    activeTab === 'memberships'
                      ? 'bg-rec-purple text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Passes & Memberships</span>
                </button>

                <button
                  onClick={() => setActiveTab('trainer_shifts')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                    activeTab === 'trainer_shifts'
                      ? 'bg-rec-purple text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                  }`}
                >
                  <Award className="w-4 h-4" />
                  <span>Trainer Shifts & Payroll</span>
                </button>

                <button
                  onClick={() => setActiveTab('analytics')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                    activeTab === 'analytics'
                      ? 'bg-rec-purple text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                  }`}
                >
                  <TrendingUp className="w-4 h-4" />
                  <span>Executive Analytics & Calendar</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Welcome Banner */
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-rec-purple-900 via-rec-purple-800 to-rec-purple-950 p-8 lg:p-10 text-white shadow-xl border border-rec-gold/20">
            <div className="absolute -right-12 -top-12 w-64 h-64 bg-rec-gold/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 max-w-2xl space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rec-gold/20 text-rec-gold text-xs font-semibold tracking-wide border border-rec-gold/30">
                <ShieldCheck className="w-3.5 h-3.5" /> 3-Day Rolling Window Live
              </div>
              <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight">
                College Gym Management System
              </h1>
              <p className="text-sm lg:text-base text-gray-200 leading-relaxed">
                Book gym time slots within the 3-day rolling window. 100 maximum capacity per slot with real-time occupancy gauges.
              </p>
            </div>
          </div>
        )}

        {/* Tab Content Display */}
        {activeTab === 'uat_demo' ? (
          <UatDemonstrationCenter />
        ) : activeTab === 'students' && isAdminOrTrainer ? (
          <StudentDirectory onOpenImport={() => setImportModalOpen(true)} />
        ) : activeTab === 'authorized_persons' && isAdminOrTrainer ? (
          <AuthorizedPersonsManager />
        ) : activeTab === 'live_attendance' && isAdminOrTrainer ? (
          <LiveOccupancyMonitor />
        ) : activeTab === 'floor_management' && isAdminOrTrainer ? (
          <TrainerFloorManager />
        ) : activeTab === 'biometrics' && isAdminOrTrainer ? (
          <DeviceBiometricsManager />
        ) : activeTab === 'violations' && isAdminOrTrainer ? (
          <ViolationManager />
        ) : activeTab === 'conflicts' && isAdminOrTrainer ? (
          <ConflictResolutionDesk />
        ) : activeTab === 'reports' && isAdminOrTrainer ? (
          <ReportsCenter />
        ) : activeTab === 'lifecycle' && isAdminOrTrainer ? (
          <DataLifecycleManager />
        ) : activeTab === 'memberships' ? (
          <MembershipStore />
        ) : activeTab === 'trainer_shifts' ? (
          <TrainerTimesheet />
        ) : activeTab === 'analytics' && isAdminOrTrainer ? (
          <ExecutiveAnalyticsDashboard />
        ) : (
          <>
            {/* Stakeholder UAT & 12 Flows Console */}
            <UatDemonstrationCenter />

            {/* Student Active Bookings */}
            <MyBookingsCard />

            {/* Slot Booking 3-Day Calendar View */}
            <SlotBookingView />

            {/* System Health Check Component */}
            <SystemHealth />

            {/* Architecture & Roadmap Capabilities Grid */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-rec-purple dark:text-rec-gold" />
                  Sprint Deliverables & Roadmap
                </h2>
                <span className="text-xs text-gray-500 dark:text-gray-400">17 Sprints (34 Weeks)</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Sprint 2 */}
                <div className="p-5 rounded-2xl bg-white dark:bg-[#18181B] border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <UserCheck className="w-4 h-4" />
                    </div>
                    <h4 className="font-semibold text-gray-900 dark:text-white text-sm">Sprint 2: Identity & Session Management</h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-normal">
                      Google OAuth PKCE login, provisioned-only gating, role-based Redis session TTLs, and HttpOnly cookies.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                    <span>Completed & Verified</span>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                </div>

                {/* Sprint 3 */}
                <div className="p-5 rounded-2xl bg-white dark:bg-[#18181B] border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <h4 className="font-semibold text-gray-900 dark:text-white text-sm">Sprint 3: Excel Bulk Ingestion</h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-normal">
                      College Excel student/staff template generation, validation engine, non-destructive error reports, and authorized persons CRM.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                    <span>Completed & Verified</span>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                </div>

                {/* Sprint 4-7 */}
                <div className="p-5 rounded-2xl bg-white dark:bg-[#18181B] border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                      <CalendarCheck className="w-4 h-4" />
                    </div>
                    <h4 className="font-semibold text-gray-900 dark:text-white text-sm">Sprint 4–7: Slot Booking Engine</h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-normal">
                      3-day rolling window, zero-overbooking concurrent capacity locking (100 cap), unified 3-day violation ban.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-[11px] text-gray-500">
                    <span>Next Sprint</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Excel Import Modal */}
        <ExcelImportModal
          isOpen={importModalOpen}
          onClose={() => setImportModalOpen(false)}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800/80 py-6 px-4 lg:px-8 text-center text-xs text-gray-500 dark:text-gray-400 bg-white/50 dark:bg-[#0F0F12]/50">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 Rajalakshmi Engineering College. All rights reserved.</p>
          <p className="flex items-center gap-2">
            <span>Modular Monolith</span>
            <span>•</span>
            <span>PostgreSQL 16 (UTC)</span>
            <span>•</span>
            <span>MinIO Ingestion</span>
          </p>
        </div>
      </footer>
    </div>
  );
};
