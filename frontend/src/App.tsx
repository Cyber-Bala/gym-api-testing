import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { AppShell } from './layout/AppShell';
import { AppView } from './layout/nav';
import { LoginPage } from './components/LoginPage';
import { HomeDashboard } from './components/HomeDashboard';
import { SlotBookingView } from './components/SlotBookingView';
import { MyBookingsCard } from './components/MyBookingsCard';
import { FaceUploadAdmin } from './components/FaceUploadAdmin';
import { FaceRegistrationStatus } from './components/FaceRegistrationStatus';
import { MembershipStore } from './components/MembershipStore';
import { MyAccessHistory } from './components/MyAccessHistory';
import { LiveOccupancyMonitor } from './components/LiveOccupancyMonitor';
import { TrainerFloorManager } from './components/TrainerFloorManager';
import { StudentDirectory } from './components/StudentDirectory';
import { AuthorizedPersonsManager } from './components/AuthorizedPersonsManager';
import { ViolationManager } from './components/ViolationManager';
import { ConflictResolutionDesk } from './components/ConflictResolutionDesk';
import { DeviceBiometricsManager } from './components/DeviceBiometricsManager';
import { FaceRegistrationAdmin } from './components/FaceRegistrationAdmin';
import { TrainerTimesheet } from './components/TrainerTimesheet';
import { ReportsCenter } from './components/ReportsCenter';
import { ExecutiveAnalyticsDashboard } from './components/ExecutiveAnalyticsDashboard';
import { DataLifecycleManager } from './components/DataLifecycleManager';
import { AdminManagement } from './components/AdminManagement';
import { UserProfileView } from './components/UserProfileView';
import { Loader2 } from 'lucide-react';

export const App: React.FC = () => {
  const { user, loading } = useAuth();
  const [activeView, setActiveView] = useState<AppView>('home');

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 space-y-4">
        <img
          src="/images/rec_logo.png"
          alt="REC Gym Logo"
          className="w-60 h-24 object-contain"
        />
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span>Verifying session...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  // ─────────────────────────────────────────────
  // 1. DAY SCHOLAR: ACTIVE membership required first (no queued passes)
  // ─────────────────────────────────────────────
  const isStudent = user.role === 'student';
  const isDayScholar =
    isStudent && user.studentDetails?.residency === 'day_scholar';

  // Block payment gate ONLY if the student has neither an active membership
  // NOR a pending_activation one. If they've paid (hasPendingMembership=true)
  // but haven't registered their face yet, let them through — the face
  // registration flow will guide them to the next step.
  if (isDayScholar && user.hasActiveMembership === false && !user.hasPendingMembership) {
    return <MembershipStore mandatoryMode />;
  }

  // ─────────────────────────────────────────────
  // 2. ROLE-SPECIFIC CONTENT RENDERING
  // ─────────────────────────────────────────────
  const renderContent = () => {
    // A. STUDENTS: Home shows active reservation; Book shows normal slot booking; Entry/Exit shows access history; Profile & Payments from top menu
    if (user.role === 'student') {
      switch (activeView) {
        case 'book':
          return <SlotBookingView onNavigate={setActiveView} />;
        case 'my_access':
          return <MyAccessHistory />;
        case 'profile':
          return <UserProfileView onBack={() => setActiveView('home')} />;
        case 'home':
        default:
          return (
            <div className="space-y-6">
              <FaceRegistrationStatus />
              <MyBookingsCard onNavigateToBook={() => setActiveView('book')} />
            </div>
          );
      }
    }



    // B. STAFF: Home shows their Profile and Entry/Exit Attendance history
    if (user.role === 'staff') {
      return (
        <div className="space-y-6">
          <FaceRegistrationStatus />
          <UserProfileView />
          <MyAccessHistory />
        </div>
      );
    }

    // C. TRAINERS & ADMINS: Multi-view operations dashboard
    switch (activeView) {
      case 'home':
        return <HomeDashboard onNavigate={setActiveView} />;
      case 'profile':
        return <UserProfileView />;
      case 'book':
        return (
          <div className="space-y-6">
            <MyBookingsCard />
            <SlotBookingView onNavigate={setActiveView} />
          </div>
        );
      case 'memberships':
        return <MembershipStore />;
      case 'my_access':
        return <MyAccessHistory />;
      case 'students':
        return <StudentDirectory />;
      case 'authorized_persons':
        return <AuthorizedPersonsManager />;
      case 'live_attendance':
        return <LiveOccupancyMonitor />;
      case 'floor_management':
        return <TrainerFloorManager />;
      case 'biometrics':
        return <DeviceBiometricsManager />;
      case 'face_registration':
        return <FaceRegistrationAdmin />;
      case 'face_upload':
        return <FaceUploadAdmin />;
      case 'violations':
        return <ViolationManager />;
      case 'conflicts':
        return <ConflictResolutionDesk />;
      case 'reports':
        return <ReportsCenter />;
      case 'lifecycle':
        return <DataLifecycleManager />;
      case 'trainer_shifts':
        return <TrainerTimesheet />;
      case 'analytics':
        return <ExecutiveAnalyticsDashboard />;
      case 'admin_management':
        return <AdminManagement />;
      default:
        return <HomeDashboard onNavigate={setActiveView} />;
    }
  };

  return (
    <AppShell active={activeView} onNavigate={setActiveView}>
      {renderContent()}
    </AppShell>
  );
};
