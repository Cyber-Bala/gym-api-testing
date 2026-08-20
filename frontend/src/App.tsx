import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { AppShell } from './layout/AppShell';
import { AppView } from './layout/nav';
import { LoginPage } from './components/LoginPage';
import { HomeDashboard } from './components/HomeDashboard';
import { SlotBookingView } from './components/SlotBookingView';
import { MyBookingsCard } from './components/MyBookingsCard';
import { MembershipStore } from './components/MembershipStore';
import { MyAccessHistory } from './components/MyAccessHistory';
import { LiveOccupancyMonitor } from './components/LiveOccupancyMonitor';
import { TrainerFloorManager } from './components/TrainerFloorManager';
import { StudentDirectory } from './components/StudentDirectory';
import { AuthorizedPersonsManager } from './components/AuthorizedPersonsManager';
import { ViolationManager } from './components/ViolationManager';
import { ConflictResolutionDesk } from './components/ConflictResolutionDesk';
import { DeviceBiometricsManager } from './components/DeviceBiometricsManager';
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
          src="/icons/desktop-icon-256x256.png"
          alt="REC Gym Logo"
          className="w-14 h-14 rounded-2xl object-contain shadow-md animate-pulse"
        />
        <div className="flex items-center gap-2 text-xs font-semibold text-muted">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span>Verifying institutional session...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const renderContent = () => {
    switch (activeView) {
      case 'home':
        return <HomeDashboard onNavigate={setActiveView} />;
      case 'profile':
        return <UserProfileView />;
      case 'book':
        return (
          <div className="space-y-6">
            <MyBookingsCard />
            <SlotBookingView />
          </div>
        );
      case 'memberships':
        if (user.studentDetails?.residency === 'hosteller') {
          return <HomeDashboard onNavigate={setActiveView} />;
        }
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


