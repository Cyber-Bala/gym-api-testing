import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

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

interface AuthContextType {
  user: SessionUser | null;
  loading: boolean;
  error: string | null;
  loginWithGoogle: (idToken: string) => Promise<void>;
  devLogin: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refreshSession = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/v1/auth/me', {
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.data.user);
      } else {
        setUser(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshSession();
  }, []);

  const loginWithGoogle = async (idToken: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
        credentials: 'include',
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        const errorMsg = data.error?.message || data.message || `Authentication failed (HTTP ${res.status})`;
        throw new Error(errorMsg);
      }

      setUser(data.data.user);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const devLogin = async (email: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/auth/dev-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        credentials: 'include',
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        const errorMsg = data.error?.message || data.message || `Dev login failed (HTTP ${res.status})`;
        throw new Error(errorMsg);
      }

      setUser(data.data.user);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      setUser(null);
    }
  };

  const logoutAll = async () => {
    try {
      await fetch('/api/v1/auth/logout-all', {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        loginWithGoogle,
        devLogin,
        logout,
        logoutAll,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
