import React from 'react';
import { Camera, Loader2, RotateCcw, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Alert } from '../ui/primitives';
import { Button } from '../ui/Button';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { FaceIdIcon } from './FaceIdIcon';

type SelfState = 'ready' | 'no_id_photo' | 'already' | 'managed' | 'not_student' | 'service_offline';

interface SelfStatus {
  state: SelfState;
  canRegister: boolean;
  message: string;
}

interface SelfResult {
  status: string;
  message: string;
  gateStatus?: 'enrolled' | 'pending';
}

/**
 * Student portal: a student registers their own face with the camera.
 * The live photo is checked against the ID photo the admin uploaded; only a match is saved.
 */
export const FaceRegistrationStatus: React.FC<{ onRegistered?: () => void }> = ({ onRegistered }) => {
  const { user, refreshSession } = useAuth();
  const toast = useToast();

  const [status, setStatus] = React.useState<SelfStatus | null>(null);
  const [step, setStep] = React.useState<'idle' | 'camera' | 'preview' | 'sending' | 'done'>('idle');
  const [photo, setPhoto] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<SelfResult | null>(null);
  const [cameraError, setCameraError] = React.useState<string | null>(null);

  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);

  const stopCamera = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const loadStatus = React.useCallback(async () => {
    try {
      setStatus(await api.get<SelfStatus>('/api/v1/face-ml/me/status'));
    } catch {
      setStatus(null);
    }
  }, []);

  React.useEffect(() => {
    if (user) void loadStatus();
    return stopCamera;
  }, [user, loadStatus, stopCamera]);

  // Attach the stream once the <video> exists.
  React.useEffect(() => {
    if (step !== 'camera') return;
    const v = videoRef.current;
    if (v && streamRef.current) {
      v.srcObject = streamRef.current;
      void v.play().catch(() => setCameraError('Could not start the camera preview.'));
    }
  }, [step]);

  if (!user) return null;

  const enrolled =
    user.faceEnrollmentStatus === 'enrolled' || user.studentDetails?.faceEnrollmentStatus === 'enrolled';

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

  if (!status || status.state === 'not_student') return null;

  const startCamera = async () => {
    setCameraError(null);
    setResult(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera needs HTTPS or localhost in a supported browser.');
      return;
    }
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      setStep('camera');
    } catch (err) {
      setCameraError(err instanceof Error ? err.message : 'Camera access was denied.');
    }
  };

  const capture = () => {
    const v = videoRef.current;
    if (!v || v.videoWidth === 0) {
      toast.error('The camera is still starting. Wait a second and try again.', 'Camera');
      return;
    }
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0);
    setPhoto(c.toDataURL('image/jpeg', 0.92));
    stopCamera();
    setStep('preview');
  };

  const submit = async () => {
    if (!photo) return;
    setStep('sending');
    try {
      const r = await api.post<SelfResult>('/api/v1/face-ml/me/register', { imageBase64: photo.split(',')[1] });
      setResult(r);
      if (r.status === 'REGISTERED') {
        toast.success(r.message, 'Face registered');
        setStep('done');
        await refreshSession();
        await loadStatus();
        onRegistered?.();
      } else {
        toast.error(r.message, 'Not registered');
        setStep('preview');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setResult({ status: 'ERROR', message: msg });
      toast.error(msg, 'Not registered');
      setStep('preview');
    }
  };

  const retake = () => {
    setPhoto(null);
    setResult(null);
    void startCamera();
  };

  /* Not allowed to register from here: show why. */
  if (!status.canRegister && step !== 'done') {
    const saved = status.state === 'already';
    return (
      <Alert tone={saved ? 'success' : 'warning'}>
        <div className="flex items-start gap-2">
          <FaceIdIcon className={`w-8 h-8 shrink-0 ${saved ? 'text-success' : 'text-warning'}`} />
          <div className="flex-1">
            <p className="font-bold">{saved ? 'Face saved' : 'Face registration'}</p>
            <p className="mt-0.5 text-xs text-secondary">{status.message}</p>
          </div>
        </div>
      </Alert>
    );
  }

  if (step === 'done') {
    return (
      <Alert tone="success">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="w-8 h-8 text-success shrink-0" />
          <div>
            <p className="font-bold">Face registered</p>
            <p className="mt-0.5 text-xs text-secondary">{result?.message}</p>
          </div>
        </div>
      </Alert>
    );
  }

  return (
    <Alert tone="warning">
      <div className="flex items-start gap-2">
        <FaceIdIcon className="w-8 h-8 text-warning shrink-0" />
        <div className="flex-1 space-y-3">
          <div>
            <p className="font-bold">Register your face</p>
            <p className="mt-0.5 text-xs text-secondary">
              Take a live photo. It is checked against your ID photo, and only a match is saved.
            </p>
          </div>

          {cameraError && <p className="text-xs text-danger">{cameraError}</p>}

          {step === 'idle' && (
            <Button size="sm" variant="primary" onClick={startCamera}>
              <Camera className="w-4 h-4" /> Open camera
            </Button>
          )}

          {step === 'camera' && (
            <div className="space-y-2">
              <div className="relative overflow-hidden rounded-xl bg-black aspect-[4/3] max-w-sm">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                />
              </div>
              <p className="text-xs text-secondary">Look straight at the camera in good light.</p>
              <Button size="sm" variant="primary" onClick={capture}>
                <Camera className="w-4 h-4" /> Take photo
              </Button>
            </div>
          )}

          {(step === 'preview' || step === 'sending') && photo && (
            <div className="space-y-2">
              <img src={photo} alt="Your photo" className="max-w-sm w-full rounded-xl" />
              {result && result.status !== 'REGISTERED' && <p className="text-xs text-danger">{result.message}</p>}
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={retake} disabled={step === 'sending'}>
                  <RotateCcw className="w-4 h-4" /> Retake
                </Button>
                <Button size="sm" variant="primary" onClick={submit} disabled={step === 'sending'}>
                  {step === 'sending' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Check and register
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Alert>
  );
};
