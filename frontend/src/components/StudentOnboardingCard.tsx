import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  UserRound,
  CheckCircle2,
  Camera,
  Upload,
  RotateCcw,
  AlertCircle,
  SwitchCamera,
  ShieldCheck,
  Sparkles,
  LogOut,
} from 'lucide-react';
import { Card, Badge } from '../ui/primitives';
import { Button, IconButton } from '../ui/Button';
import { Input, Textarea } from '../ui/Input';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { cn } from '../lib/cn';
import { RecLogo } from './RecLogo';

interface StudentOnboardingCardProps {
  /** Full-screen gate before app access (after membership for day scholars). */
  mandatoryMode?: boolean;
}

export const StudentOnboardingCard: React.FC<StudentOnboardingCardProps> = ({
  mandatoryMode = false,
}) => {
  const { user, refreshSession, logout } = useAuth();
  const toast = useToast();
  const details = user?.studentDetails;

  const [phone, setPhone] = useState(details?.phone || '');
  const [emergencyContact, setEmergencyContact] = useState(details?.emergencyContact || '');
  const [address, setAddress] = useState(details?.address || '');
  const [healthConcerns, setHealthConcerns] = useState(details?.healthConcerns || '');

  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (details) {
      if (details.phone) setPhone(details.phone);
      if (details.emergencyContact) setEmergencyContact(details.emergencyContact);
      if (details.address) setAddress(details.address);
      if (details.healthConcerns) setHealthConcerns(details.healthConcerns);
    }
  }, [details]);

  const isFaceEnrolled =
    details?.faceEnrollmentStatus === 'enrolled' || user?.faceEnrollmentStatus === 'enrolled';
  const isContactFilled = Boolean(details?.phone?.trim() && details?.emergencyContact?.trim());
  const incomplete = (!isContactFilled || !isFaceEnrolled) && !justSaved;

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraLoading(true);
    setCameraError(null);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera not supported on this browser. Please use photo upload.');
      }

      let mediaStream: MediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });
      } catch {
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      streamRef.current = mediaStream;
      setIsCameraActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(() => {});
        };
        videoRef.current.play().catch(() => {});
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
        setCameraError('Camera permission denied. Please allow camera or upload a photo.');
      } else {
        setCameraError(msg || 'Unable to open camera. Please use photo upload.');
      }
    } finally {
      setCameraLoading(false);
    }
  }, [facingMode, stopCamera]);

  useEffect(() => {
    if (isCameraActive && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play().catch(() => {});
      };
      videoRef.current.play().catch(() => {});
    }
  }, [isCameraActive, facingMode]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const handleCapture = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setCapturedImage(canvas.toDataURL('image/jpeg', 0.9));
    stopCamera();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        setCapturedImage(event.target.result);
        stopCamera();
      }
    };
    reader.readAsDataURL(file);
  };

  const handleToggleCamera = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
    if (isCameraActive) {
      setTimeout(() => startCamera(), 100);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!phone.trim() || !emergencyContact.trim()) {
      toast.error('Personal and emergency contact numbers are required.');
      return;
    }

    if (!isFaceEnrolled && !capturedImage) {
      toast.error('Please capture or upload your face photo for touchless turnstile check-in.');
      return;
    }

    setSaving(true);
    try {
      await api.patch('/api/v1/people/students/me', {
        phone: phone.trim(),
        emergencyContact: emergencyContact.trim(),
        address: address.trim(),
        healthConcerns: healthConcerns.trim(),
      });

      if (capturedImage) {
        await api.post('/api/v1/biometrics/face-enroll', {
          faceImageBase64: capturedImage,
        });
      }

      setJustSaved(true);
      toast.success('Your profile and biometric access have been set up successfully!');
      await refreshSession();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg, 'Profile Setup Failed');
    } finally {
      setSaving(false);
    }
  };

  if (!incomplete && !mandatoryMode) return null;
  if (!incomplete && mandatoryMode) return null;

  const isHosteller = details?.residency === 'hosteller';
  const subtitle = isHosteller
    ? 'Complete your safety contacts and face photo to start booking gym slots.'
    : 'Your pass is active. Finish personal details and face enrollment to enter the app.';

  const formCard = (
    <Card
      className={cn(
        'space-y-5 shadow-lg relative overflow-hidden',
        mandatoryMode && 'shadow-xl'
      )}
    >

      <canvas ref={canvasRef} className="hidden" />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-primary-muted text-primary shrink-0 shadow-inner">
            <UserRound className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold text-base sm:text-lg text-text">
                {mandatoryMode ? 'Complete Onboarding' : 'Complete Your Gym Profile'}
              </h3>
              <Badge tone="warning" className="text-[11px] animate-pulse">
                Action Required
              </Badge>
            </div>
            <p className="text-xs text-secondary mt-0.5">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-center">
          {!isContactFilled && (
            <Badge tone="warning" className="text-[10px]">
              Missing Contact Info
            </Badge>
          )}
          {!isFaceEnrolled && (
            <Badge tone="accent" className="text-[10px]">
              Missing Face Photo
            </Badge>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-3">
          <h4 className="font-semibold text-xs text-secondary uppercase tracking-wider">
            1. Contact & Emergency Details
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Personal Contact Mobile Number"
              required
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              hint="Your active WhatsApp or phone number"
            />
            <Input
              label="Emergency Contact Number"
              required
              type="tel"
              value={emergencyContact}
              onChange={(e) => setEmergencyContact(e.target.value)}
              placeholder="+91 98765 00000"
              hint="Parent, local guardian, or hostel warden"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Textarea
              label="Hostel Block / Home Address (Optional)"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Block C, Room 304 / Residential Address"
            />
            <Textarea
              label="Health Concerns & Medical Notes (Optional)"
              value={healthConcerns}
              onChange={(e) => setHealthConcerns(e.target.value)}
              placeholder="e.g. Asthma, cardiac precautions, joint injuries — leave blank if none"
            />
          </div>
        </div>

        <div className="space-y-3 pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-xs text-secondary uppercase tracking-wider flex items-center gap-1.5">
              <span>2. Biometric Turnstile Photo</span>
              <Sparkles className="w-3.5 h-3.5 text-accent" />
            </h4>
            {isFaceEnrolled && !capturedImage && (
              <Badge tone="success" className="text-[11px] flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Face Photo Enrolled
              </Badge>
            )}
          </div>

          {isFaceEnrolled && !capturedImage && !isCameraActive && (
            <div className="p-3.5 rounded-2xl bg-success-muted/20 border border-success/30 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                <div>
                  <p className="font-bold text-text">Biometric Face Profile is Active</p>
                  <p className="text-[11px] text-secondary">
                    Your facial recognition is ready for touchless turnstile check-in.
                  </p>
                </div>
              </div>
              <Button variant="outline" size="xs" type="button" onClick={() => startCamera()}>
                <Camera className="w-3.5 h-3.5 mr-1" />
                <span>Update Photo</span>
              </Button>
            </div>
          )}

          {(!isFaceEnrolled || capturedImage || isCameraActive) && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-border bg-black/90 overflow-hidden min-h-[220px] max-h-[300px] flex items-center justify-center relative">
                {capturedImage ? (
                  <div className="relative w-full h-[240px] flex items-center justify-center bg-black">
                    <img
                      src={capturedImage}
                      alt="Captured Face Preview"
                      className="max-h-full max-w-full object-contain rounded-xl"
                    />
                    <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md px-3 py-1 rounded-full text-[11px] text-white flex items-center gap-1.5 border border-white/10">
                      <CheckCircle2 className="w-3.5 h-3.5 text-success" /> Photo Ready for Enrollment
                    </div>
                  </div>
                ) : isCameraActive ? (
                  <div className="relative w-full h-[240px] flex items-center justify-center">
                    <video
                      ref={(el) => {
                        videoRef.current = el;
                        if (el && streamRef.current && el.srcObject !== streamRef.current) {
                          el.srcObject = streamRef.current;
                          el.onloadedmetadata = () => {
                            el.play().catch(() => {});
                          };
                          el.play().catch(() => {});
                        }
                      }}
                      autoPlay
                      playsInline
                      muted
                      className={cn(
                        'w-full h-full object-cover',
                        facingMode === 'user' && 'scale-x-[-1]'
                      )}
                    />
                    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                      <div className="w-36 h-44 rounded-[50%] border-2 border-dashed border-primary/70 flex items-center justify-center">
                        <div className="w-32 h-40 rounded-[50%] border border-primary/30" />
                      </div>
                      <p className="mt-1.5 text-[10px] font-medium text-white bg-black/60 px-2 py-0.5 rounded-full">
                        Align face within oval
                      </p>
                    </div>
                    <div className="absolute top-2 right-2">
                      <IconButton
                        label="Switch Camera"
                        size="sm"
                        variant="ghost"
                        className="bg-black/60 text-white hover:bg-black/90"
                        onClick={handleToggleCamera}
                      >
                        <SwitchCamera className="w-3.5 h-3.5" />
                      </IconButton>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary mx-auto">
                      <Camera className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold text-text text-sm">Biometric Face Photo Required</p>
                      <p className="text-muted text-[11px] mt-0.5">
                        Capture a clear front-facing photo or upload one from your device.
                      </p>
                    </div>
                    {cameraError && (
                      <div className="p-2 rounded-xl bg-danger-muted/30 border border-danger/30 text-danger text-[11px] flex items-center gap-1.5 justify-center">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{cameraError}</span>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                      <Button
                        variant="primary"
                        size="sm"
                        type="button"
                        loading={cameraLoading}
                        onClick={() => startCamera()}
                      >
                        <Camera className="w-3.5 h-3.5 mr-1.5" />
                        <span>Open Camera</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="w-3.5 h-3.5 mr-1.5" />
                        <span>Upload Photo</span>
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {isCameraActive && (
                <div className="flex items-center justify-between gap-2">
                  <Button variant="secondary" size="xs" type="button" onClick={stopCamera}>
                    Cancel Camera
                  </Button>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="xs"
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-3 h-3 mr-1" />
                      <span>Upload File</span>
                    </Button>
                    <Button variant="primary" size="sm" type="button" onClick={handleCapture}>
                      <Camera className="w-3.5 h-3.5 mr-1.5" />
                      <span>Take Photo</span>
                    </Button>
                  </div>
                </div>
              )}

              {capturedImage && (
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-secondary text-[11px]">
                    Photo will be synced with turnstile entry gates.
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="xs"
                      type="button"
                      onClick={() => {
                        setCapturedImage(null);
                        startCamera();
                      }}
                    >
                      <RotateCcw className="w-3 h-3 mr-1" />
                      <span>Retake</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="xs"
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-3 h-3 mr-1" />
                      <span>Upload Another</span>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border gap-3">
          <p className="text-[11px] text-muted">
            All details are securely stored according to college gym compliance rules.
          </p>
          <Button variant="primary" size="md" loading={saving} type="submit" className="shrink-0">
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            <span>{mandatoryMode ? 'Save & Enter App' : 'Save & Complete Profile'}</span>
          </Button>
        </div>
      </form>
    </Card>
  );

  if (mandatoryMode) {
    return (
      <div className="min-h-screen bg-background text-text flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-3xl space-y-5">
          <div className="text-center space-y-2">
            <RecLogo alt="REC Gym Logo" className="h-24 w-60 mx-auto mb-2" />
            <h1 className="text-2xl font-bold text-foreground">
              {isHosteller ? 'Hosteller Onboarding' : 'Final Step — Personal Details'}
            </h1>
            <p className="text-xs text-secondary max-w-md mx-auto leading-relaxed">
              {isHosteller
                ? 'No membership purchase needed. Complete your profile to book workout slots.'
                : 'Membership is active. Add contacts and your face photo to finish setup.'}
            </p>
            {user && (
              <p className="text-[11px] text-muted font-mono truncate">
                {user.name}
                {details?.rollNumber ? ` · ${details.rollNumber}` : ''}
              </p>
            )}
          </div>

          {formCard}

          <div className="flex justify-center">
            <button
              type="button"
              onClick={logout}
              className="text-danger hover:underline inline-flex items-center gap-1.5 text-[11px] font-medium"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return formCard;
};
