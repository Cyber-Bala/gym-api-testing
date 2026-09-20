import React from 'react';
import { useAuth } from '../context/AuthContext';

import { Alert } from '../ui/primitives';
import { Button } from '../ui/Button';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { FaceIdIcon } from './FaceIdIcon';

export const FaceRegistrationStatus: React.FC = () => {
  const { user, refreshSession } = useAuth();
  const toast = useToast();
  const [verifying, setVerifying] = React.useState(false);
  
  if (!user) return null;

  const isDayScholar = user.studentDetails?.residency === 'day_scholar';
  const hasPassOrPending = user.hasActiveMembership || user.hasPendingMembership;

  const enrolled =
    user.faceEnrollmentStatus === 'enrolled' ||
    user.studentDetails?.faceEnrollmentStatus === 'enrolled';

  if (enrolled) {
    return (
      <Alert tone="success">
        <div className="flex items-start gap-2">
          <FaceIdIcon className="w-8 h-8 text-success shrink-0" />
          <div>
            <p className="font-bold">Face registered</p>
            <p className="mt-0.5 text-xs text-secondary">
              Your Face ID is on file at the gym turnstile. You can enter with facial recognition.
            </p>
          </div>
        </div>
      </Alert>
    );
  }

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const res = await api.post('/api/v1/access/verify-face', {}) as any;
      if (res.data?.enrolled) {
        toast.success(res.message || 'Face successfully verified!');
        await refreshSession(); // reload user data
      } else {
        toast.error(res.message || 'Face not yet registered on the machine.', 'Verification Failed');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg, 'Verification Error');
    } finally {
      setVerifying(false);
    }
  };

  if (isDayScholar && !hasPassOrPending) {
    return (
      <Alert tone="warning">
        <div className="flex items-start gap-2">
          <FaceIdIcon className="w-8 h-8 text-warning shrink-0" />
          <div className="flex-1">
            <p className="font-bold">Purchase a gym pass first</p>
            <p className="mt-0.5 text-xs text-secondary">
              Day Scholars must purchase a gym pass before they can register their face and book slots.
            </p>
          </div>
        </div>
      </Alert>
    );
  }

  return (
    <Alert tone="warning">
      <div className="flex items-start gap-2">
        <FaceIdIcon className="w-8 h-8 text-warning shrink-0" />
        <div className="flex-1">
          <p className="font-bold">Register your face at the turnstile</p>
          <p className="mt-0.5 text-xs text-secondary">
            Face ID must be registered on the physical gym machine. Once registered, click verify below to activate your account.
          </p>
          <div className="mt-3">
            <Button size="sm" variant="primary" loading={verifying} onClick={handleVerify}>
              I have registered my face - Verify Now
            </Button>
          </div>
        </div>
      </div>
    </Alert>
  );
};
