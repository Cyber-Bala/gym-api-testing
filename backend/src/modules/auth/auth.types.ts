export type UserRole = 'student' | 'trainer' | 'staff' | 'authorized_person' | 'admin' | 'super_admin';

export interface SessionUser {
  accountId: string;
  personId: string;
  email: string;
  name: string;
  role: UserRole;
  personType: string;
  status: string;
  faceEnrollmentStatus?: string | null;
  faceReferenceId?: string | null;
  hasActiveMembership?: boolean;
  activeMembershipEndDate?: string | null;
  /** Always true; contact details and face capture are not app onboarding steps */
  hasCompletedOnboarding?: boolean;
  permissions: string[];
  isProtectedSuperAdmin?: boolean;

  studentDetails?: {
    rollNumber: string;
    department: string;
    joiningYear: number;
    residency: string;
    isBanned: boolean;
    violationCount: number;
    faceEnrollmentStatus?: string | null;
    faceReferenceId?: string | null;
    phone?: string | null;
    emergencyContact?: string | null;
    address?: string | null;
    healthConcerns?: string | null;
  };
  trainerDetails?: {
    hourlyRate: string;
  };
  staffDetails?: {
    staffId: string;
    department: string;
  };
}

export interface SessionData {
  id: string;
  user: SessionUser;
  userAgent?: string;
  ipAddress?: string;
  createdAt: string;
  lastActivityAt: string;
  expiresAt: string;
}

export interface GoogleTokenPayload {
  email: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  sub: string;
}

export interface AuthResponse {
  user: SessionUser;
  expiresAt: string;
}
