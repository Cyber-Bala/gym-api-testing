import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { AppShell } from './layout/AppShell';
import { AppView } from './layout/nav';
import { LoginPage } from './components/LoginPage';
import { HomeDashboard } from './components/HomeDashboard';
import { SlotBookingView } from './components/SlotBookingView';
import { MyBookingsCard } from './components/MyBookingsCard';
import { MembershipStore } from './components/MembershipStore';
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
import { SystemHealth } from './components/SystemHealth';
import { UatDemonstrationCenter } from './components/UatDemonstrationCenter';
import { Dumbbell, Loader2 } from 'lucide-react';

export const App: React.FC = () => {
  const { user, loading } = useAuth();
  const [activeView, setActiveView] = useState<AppView>('home');

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-primary text-accent flex items-center justify-center border border-accent/30 shadow-md animate-pulse">
          <Dumbbell className="w-6 h-6" />
        </div>
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
      case 'health':
        return <SystemHealth />;
      case 'uat_demo':
        return <UatDemonstrationCenter />;
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


