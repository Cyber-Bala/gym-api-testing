import React, { useState, useEffect } from 'react';
import {
  Mail,
  Shield,
  GraduationCap,
  Home,
  Lock,
  Pencil,
  CheckCircle2,
  Building2,
  Calendar,
  Camera,
  RefreshCw,
  Award,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card, Badge } from '../ui/primitives';
import { Button } from '../ui/Button';
import { Input, Textarea } from '../ui/Input';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { FaceEnrollmentModal, StudentSummary } from './FaceEnrollmentModal';
import { cn } from '../lib/cn';

interface UserProfileViewProps {
  onBack?: () => void;
}

export const UserProfileView: React.FC<UserProfileViewProps> = ({ onBack }) => {
  const { user, refreshSession } = useAuth();
  const toast = useToast();
  const details = user?.studentDetails;
  const staffDetails = user?.staffDetails;


  // Editable fields state
  const [phone, setPhone] = useState<string>(details?.phone || '');
  const [emergencyContact, setEmergencyContact] = useState<string>(details?.emergencyContact || '');
  const [address, setAddress] = useState<string>(details?.address || '');
  const [healthConcerns, setHealthConcerns] = useState<string>(details?.healthConcerns || '');

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [faceModalOpen, setFaceModalOpen] = useState<boolean>(false);

  // Sync state when user session updates
  useEffect(() => {
    if (details) {
      setPhone(details.phone || '');
      setEmergencyContact(details.emergencyContact || '');
      setAddress(details.address || '');
      setHealthConcerns(details.healthConcerns || '');
    }
  }, [details]);

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

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (user?.role === 'student' || user?.personType === 'student') {
        await api.patch('/api/v1/people/students/me', {
          phone: phone.trim(),
          emergencyContact: emergencyContact.trim(),
          address: address.trim(),
          healthConcerns: healthConcerns.trim(),
        });
      }

      toast.success('Your profile details have been updated successfully!');
      setIsEditing(false);
      await refreshSession();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg, 'Update Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (details) {
      setPhone(details.phone || '');
      setEmergencyContact(details.emergencyContact || '');
      setAddress(details.address || '');
      setHealthConcerns(details.healthConcerns || '');
    }
    setIsEditing(false);
  };

  const isStudent = user?.role === 'student' || user?.personType === 'student';

  const studentSummary: StudentSummary | null = isStudent && user && details
    ? {
        id: user.personId,
        name: user.name,
        rollNumber: details.rollNumber,
        email: user.email,
        department: details.department,
        faceEnrollmentStatus: 'enrolled',
      }
    : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Profile Card */}
      <Card className="p-6 bg-gradient-to-br from-surface to-surface-elevated border border-border shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border-2 border-primary/30 flex items-center justify-center text-primary font-bold text-2xl shadow-inner shrink-0">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-bold text-text">{user?.name}</h2>
                <Badge tone="primary" className="capitalize text-xs font-semibold">
                  {user?.role.replace('_', ' ')}
                </Badge>
                {details?.residency && (
                  <Badge tone={details.residency === 'hosteller' ? 'accent' : 'neutral'} className="capitalize text-xs">
                    {details.residency === 'hosteller' ? 'Hosteller (Free Inclusive)' : 'Day Scholar'}
                  </Badge>
                )}
              </div>
              <p className="text-xs sm:text-sm text-secondary font-mono mt-0.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-muted" />
                <span>{user?.email}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
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

            {isStudent && (
              <Button
                variant={isEditing ? 'secondary' : 'primary'}
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
              >
                <Pencil className="w-3.5 h-3.5 mr-1.5" />
                <span>{isEditing ? 'Viewing Mode' : 'Edit Contact Details'}</span>
              </Button>
            )}
          </div>

        </div>
      </Card>

      {/* Main Grid: Institutional Info & Editable Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Section 1: Official Institutional Information (Read-Only / Locked) */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-border-subtle text-muted">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-text">Institutional Profile</h3>
                <p className="text-[11px] text-muted">Official college academic records</p>
              </div>
            </div>
            <Badge tone="neutral" className="text-[10px] flex items-center gap-1">
              <Lock className="w-2.5 h-2.5" /> Read-Only
            </Badge>
          </div>

          <div className="space-y-3 text-xs">
            {isStudent && details && (
              <>
                <div className="p-3 rounded-xl bg-surface-elevated border border-border flex items-center justify-between">
                  <div className="flex items-center gap-2 text-secondary">
                    <GraduationCap className="w-4 h-4 text-primary" />
                    <span>Roll Number:</span>
                  </div>
                  <span className="font-mono font-bold text-text text-sm">{details.rollNumber}</span>
                </div>

                <div className="p-3 rounded-xl bg-surface-elevated border border-border flex items-center justify-between">
                  <div className="flex items-center gap-2 text-secondary">
                    <Building2 className="w-4 h-4 text-accent" />
                    <span>Department:</span>
                  </div>
                  <span className="font-semibold text-text">{details.department}</span>
                </div>

                <div className="p-3 rounded-xl bg-surface-elevated border border-border flex items-center justify-between">
                  <div className="flex items-center gap-2 text-secondary">
                    <Calendar className="w-4 h-4 text-muted" />
                    <span>Joining Year / Batch:</span>
                  </div>
                  <span className="font-mono font-semibold text-text">{details.joiningYear}</span>
                </div>

                <div className="p-3 rounded-xl bg-surface-elevated border border-border flex items-center justify-between">
                  <div className="flex items-center gap-2 text-secondary">
                    <Home className="w-4 h-4 text-secondary" />
                    <span>Residency Status:</span>
                  </div>
                  <span className="font-semibold text-text capitalize">
                    {details.residency === 'hosteller' ? 'Hosteller (Inclusive Access)' : 'Day Scholar (Pass Required)'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-surface-elevated border border-border flex items-center justify-between">
                  <div className="flex items-center gap-2 text-secondary">
                    <Shield className="w-4 h-4 text-success" />
                    <span>Access Standing:</span>
                  </div>
                  <Badge tone={details.isBanned ? 'danger' : 'success'}>
                    {details.isBanned ? 'Access Restricted' : 'Active & In Good Standing'}
                  </Badge>
                </div>
              </>
            )}

            {staffDetails && (
              <>
                <div className="p-3 rounded-xl bg-surface-elevated border border-border flex items-center justify-between">
                  <div className="flex items-center gap-2 text-secondary">
                    <Award className="w-4 h-4 text-primary" />
                    <span>Staff ID:</span>
                  </div>
                  <span className="font-mono font-bold text-text">{staffDetails.staffId}</span>
                </div>

                <div className="p-3 rounded-xl bg-surface-elevated border border-border flex items-center justify-between">
                  <div className="flex items-center gap-2 text-secondary">
                    <Building2 className="w-4 h-4 text-accent" />
                    <span>Department:</span>
                  </div>
                  <span className="font-semibold text-text">{staffDetails.department}</span>
                </div>
              </>
            )}

            <div className="p-3 rounded-xl bg-surface-elevated/40 border border-dashed border-border flex items-start gap-2 text-[11px] text-muted">
              <Shield className="w-3.5 h-3.5 text-muted shrink-0 mt-0.5" />
              <span>
                To request modifications to your institutional name, roll number, or department, please contact the Physical Education Directorate or Dean Office.
              </span>
            </div>
          </div>
        </Card>

        {/* Section 2: Contact & Safety Details (EDITABLE ✏️) */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary-muted text-primary">
                <Pencil className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-text">Contact & Medical Details</h3>
                <p className="text-[11px] text-muted">Self-managed personal & emergency information</p>
              </div>
            </div>
            <Badge tone="success" className="text-[10px] flex items-center gap-1 font-semibold">
              <Pencil className="w-2.5 h-2.5" /> Editable
            </Badge>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
            <div>
              <Input
                label="Contact Phone Number"
                type="tel"
                required
                disabled={!isEditing}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                hint="Your active personal mobile number"
              />
            </div>

            <div>
              <Input
                label="Emergency Contact Number"
                type="tel"
                required
                disabled={!isEditing}
                value={emergencyContact}
                onChange={(e) => setEmergencyContact(e.target.value)}
                placeholder="+91 98765 00000"
                hint="Parent, guardian, or hostel warden phone"
              />
            </div>

            <div>
              <Textarea
                label="Hostel Block / Home Address"
                disabled={!isEditing}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Block C, Room 304 / Residential Address"
                hint="Current campus or residential address"
              />
            </div>

            <div>
              <Textarea
                label="Health Concerns & Medical Notes"
                disabled={!isEditing}
                value={healthConcerns}
                onChange={(e) => setHealthConcerns(e.target.value)}
                placeholder="e.g. Asthma, cardiac precautions, joint injuries — leave blank if none"
                hint="Shared confidentially with gym trainers for safety"
              />
            </div>

            {isEditing ? (
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button variant="secondary" size="sm" type="button" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" loading={saving} type="submit">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                  <span>Save Changes</span>
                </Button>
              </div>
            ) : (
              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="w-full"
                >
                  <Pencil className="w-3.5 h-3.5 mr-1.5" />
                  <span>Edit Contact & Medical Info</span>
                </Button>
              </div>
            )}
          </form>
        </Card>
      </div>

      {/* Section 3: Biometric Turnstile Access Status */}
      {isStudent && (
        <Card className="p-5 border border-border bg-surface-elevated/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-accent-muted text-accent shrink-0">
                <Camera className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-text">Biometric Face Turnstile Access</h4>
                  <Badge tone="success" className="text-[10px]">
                    Turnstile Ready
                  </Badge>
                </div>
                <p className="text-xs text-secondary mt-0.5">
                  Your biometric facial recognition profile is active for instant touchless turnstile check-in and check-out.
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setFaceModalOpen(true)}
              className="shrink-0 self-start sm:self-center"
            >
              <Camera className="w-3.5 h-3.5 mr-1.5" />
              <span>Update Face Capture</span>
            </Button>
          </div>
        </Card>
      )}

      {/* Face Enrollment Modal */}
      {faceModalOpen && studentSummary && (
        <FaceEnrollmentModal
          open={faceModalOpen}
          onClose={() => setFaceModalOpen(false)}
          initialStudent={studentSummary}
          onEnrolled={() => {
            setFaceModalOpen(false);
            refreshSession();
          }}
        />
      )}
    </div>
  );
};
