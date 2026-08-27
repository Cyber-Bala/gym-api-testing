import React, { useState } from 'react';
import {
  Mail,
  Shield,
  GraduationCap,
  Home,
  Lock,
  Building2,
  Calendar,
  RefreshCw,
  Award,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card, Badge } from '../ui/primitives';
import { Button } from '../ui/Button';
import { useToast } from '../context/ToastContext';
import { cn } from '../lib/cn';
import { FaceIdIcon } from './FaceIdIcon';

interface UserProfileViewProps {
  onBack?: () => void;
}

export const UserProfileView: React.FC<UserProfileViewProps> = ({ onBack }) => {
  const { user, refreshSession } = useAuth();
  const toast = useToast();
  const details = user?.studentDetails;
  const staffDetails = user?.staffDetails;
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const faceEnrolled =
    user?.faceEnrollmentStatus === 'enrolled' || details?.faceEnrollmentStatus === 'enrolled';

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshSession();
      toast.success('Profile synced with server');
    } catch {
      toast.error('Failed to sync profile');
    } finally {
      setRefreshing(false);
    }
  };

  const isStudent = user?.role === 'student' || user?.personType === 'student';

  return (
    <div className="space-y-8 min-w-0 w-full overflow-hidden">
      <Card className="p-6 shadow-lg min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-w-0">
          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-medium text-xl sm:text-2xl shrink-0">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <h2 className="text-2xl font-bold text-card-foreground break-words leading-tight">
                  {user?.name}
                </h2>
                <Badge tone="primary" className="capitalize text-[11px] font-semibold">
                  {user?.role.replace('_', ' ')}
                </Badge>
                {details?.residency && (
                  <Badge tone={details.residency === 'hosteller' ? 'accent' : 'neutral'} className="capitalize text-[11px]">
                    {details.residency === 'hosteller' ? 'Hosteller (Free Inclusive)' : 'Day Scholar'}
                  </Badge>
                )}
              </div>
              <p className="text-xs sm:text-sm text-secondary font-mono flex items-center gap-1.5 min-w-0 break-all">
                <Mail className="w-3.5 h-3.5 text-muted shrink-0" />
                <span className="break-all">{user?.email}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-center shrink-0 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
            {onBack && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onBack}
              >
                <span>Back to Bookings</span>
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={cn('w-3.5 h-3.5 mr-1.5', refreshing && 'animate-spin')} />
              <span>Refresh</span>
            </Button>
          </div>
        </div>
      </Card>

      {/* Main Grid: Institutional Info */}
      <div className="grid grid-cols-1 gap-6 min-w-0">
        {/* Section 1: Official Institutional Information (Read-Only / Locked) */}
        <Card className="space-y-4 min-w-0">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1.5 rounded-lg bg-border-subtle text-muted shrink-0">
                <Lock className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-sm text-text truncate">Institutional Profile</h3>
                <p className="text-[11px] text-muted truncate">Official college academic records</p>
              </div>
            </div>
            <Badge tone="neutral" className="text-[10px] flex items-center gap-1 shrink-0">
              <Lock className="w-2.5 h-2.5" /> Read-Only
            </Badge>
          </div>

          <div className="space-y-2.5 text-xs min-w-0">
            {isStudent && details && (
              <>
                <div className="p-3 rounded-xl bg-surface-elevated border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-1 min-w-0">
                  <div className="flex items-center gap-2 text-secondary shrink-0">
                    <GraduationCap className="w-4 h-4 text-primary shrink-0" />
                    <span>Roll Number:</span>
                  </div>
                  <span className="font-mono font-bold text-text text-sm break-all sm:text-right">
                    {details.rollNumber}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-surface-elevated border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-1 min-w-0">
                  <div className="flex items-center gap-2 text-secondary shrink-0">
                    <Building2 className="w-4 h-4 text-accent shrink-0" />
                    <span>Department:</span>
                  </div>
                  <span className="font-semibold text-text break-words sm:text-right">
                    {details.department}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-surface-elevated border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-1 min-w-0">
                  <div className="flex items-center gap-2 text-secondary shrink-0">
                    <Calendar className="w-4 h-4 text-muted shrink-0" />
                    <span>Joining Year / Batch:</span>
                  </div>
                  <span className="font-mono font-semibold text-text sm:text-right">
                    {details.joiningYear}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-surface-elevated border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-1 min-w-0">
                  <div className="flex items-center gap-2 text-secondary shrink-0">
                    <Home className="w-4 h-4 text-secondary shrink-0" />
                    <span>Residency Status:</span>
                  </div>
                  <span className="font-semibold text-text capitalize sm:text-right">
                    {details.residency === 'hosteller' ? 'Hosteller (Inclusive Access)' : 'Day Scholar (Pass Required)'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-surface-elevated border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-1 min-w-0">
                  <div className="flex items-center gap-2 text-secondary shrink-0">
                    <Shield className="w-4 h-4 text-success shrink-0" />
                    <span>Access Standing:</span>
                  </div>
                  <Badge tone={details.isBanned ? 'danger' : 'success'} className="self-start sm:self-auto">
                    {details.isBanned ? 'Access Restricted' : 'Active & In Good Standing'}
                  </Badge>
                </div>
              </>
            )}

            {staffDetails && (
              <>
                <div className="p-3 rounded-xl bg-surface-elevated border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-1 min-w-0">
                  <div className="flex items-center gap-2 text-secondary shrink-0">
                    <Award className="w-4 h-4 text-primary shrink-0" />
                    <span>Staff ID:</span>
                  </div>
                  <span className="font-mono font-bold text-text break-all sm:text-right">
                    {staffDetails.staffId}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-surface-elevated border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-1 min-w-0">
                  <div className="flex items-center gap-2 text-secondary shrink-0">
                    <Building2 className="w-4 h-4 text-accent shrink-0" />
                    <span>Department:</span>
                  </div>
                  <span className="font-semibold text-text break-words sm:text-right">
                    {staffDetails.department}
                  </span>
                </div>
              </>
            )}

            <div className="p-3 rounded-xl bg-surface-elevated border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-1 min-w-0">
              <div className="flex items-center gap-2 text-secondary shrink-0">
                <FaceIdIcon className="w-4 h-4 text-primary" />
                <span>Face ID:</span>
              </div>
              <Badge tone={faceEnrolled ? 'success' : 'warning'} className="self-start sm:self-auto">
                {faceEnrolled ? 'Registered at turnstile' : 'Not registered'}
              </Badge>
            </div>

            <div className="p-3 rounded-xl bg-surface-elevated/40 border border-dashed border-border flex items-start gap-2 text-[11px] text-muted min-w-0">
              <Shield className="w-3.5 h-3.5 text-muted shrink-0 mt-0.5" />
              <span className="break-words">
                To request modifications to institutional records, please contact the Physical Education Directorate or Dean Office.
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
