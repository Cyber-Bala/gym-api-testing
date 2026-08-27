import React from 'react';
import { useAuth } from '../context/AuthContext';

import { Alert } from '../ui/primitives';
import { FaceIdIcon } from './FaceIdIcon';

export const FaceRegistrationStatus: React.FC = () => {
  const { user } = useAuth();
  if (!user) return null;

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

  return (
    <Alert tone="warning">
      <div className="flex items-start gap-2">
        <FaceIdIcon className="w-8 h-8 text-warning shrink-0" />
        <div>
          <p className="font-bold">Register your face at the turnstile</p>
          <p className="mt-0.5 text-xs text-secondary">
            Face ID can only be captured on the gym machine. Visit the turnstile to register before entry.
          </p>
        </div>
      </div>
    </Alert>
  );
};
