import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Camera,
  Upload,
  RotateCcw,
  AlertCircle,
  SwitchCamera,
  ShieldCheck,
  Sparkles,
  LogOut,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { Card, Badge } from '../ui/primitives';
import { Button, IconButton } from '../ui/Button';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { cn } from '../lib/cn';

export const MandatoryFaceEnrollment: React.FC = () => {
  const { user, refreshSession, logout } = useAuth();
  const toast = useToast();

  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraLoading, setCameraLoading] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [enrolling, setEnrolling] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraLoading(true);
    setCameraError(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access not supported on this browser. Please use photo upload.');
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
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
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
        setCameraError('Camera permission denied. Please allow camera access or upload a photo.');
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

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

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

    const base64 = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(base64);
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

  const handleEnrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!capturedImage) {
      toast.error('Please capture or upload your face photo to complete biometric registration.');
      return;
    }

    setEnrolling(true);
    try {
      await api.post('/api/v1/biometrics/face-enroll', {
        faceImageBase64: capturedImage,
      });

      toast.success('Face biometric registered successfully! Welcome to the gym portal.');
      await refreshSession();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg, 'Face Registration Failed');
    } finally {
      setEnrolling(false);
    }
  };

  const roleLabel =
    user?.role === 'student'
      ? 'Student'
      : user?.role === 'staff'
      ? 'Staff Member'
      : user?.role === 'trainer'
      ? 'Trainer'
      : 'Member';

  return (
    <div className="min-h-screen bg-background text-text flex flex-col items-center justify-center p-4 sm:p-6 relative">
      {/* Hidden capture elements */}
      <canvas ref={canvasRef} className="hidden" />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload}
      />

      <div className="w-full max-w-lg space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-surface-elevated border border-border shadow-sm mb-1">
            <img
              src="/icons/desktop-icon-256x256.png"
              alt="REC Gym Logo"
              className="w-12 h-12 object-contain rounded-xl shadow-sm"
            />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-text">Biometric Face Registration</h1>
          <p className="text-xs text-secondary max-w-md mx-auto leading-relaxed">
            Institutional security requires a front-facing facial scan for touchless gym access.
          </p>
        </div>

        {/* Main Card */}
        <Card className="space-y-5 border-2 border-primary/40 bg-surface shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-accent to-primary" />

          {/* User Info Strip */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-surface-elevated border border-border text-xs">
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-text truncate">{user?.name}</span>
                <Badge tone="primary">{roleLabel}</Badge>
              </div>
              <p className="text-[11px] text-muted truncate">{user?.email}</p>
            </div>

            <Badge tone="warning" className="shrink-0 flex items-center gap-1">
              <Lock className="w-3 h-3" /> Face Required
            </Badge>
          </div>

          <form onSubmit={handleEnrollSubmit} className="space-y-4">
            {/* Camera View / Preview Container */}
            <div className="rounded-2xl border border-border bg-black overflow-hidden min-h-[260px] max-h-[320px] flex items-center justify-center relative shadow-inner">
              {capturedImage ? (
                <div className="relative w-full h-[280px] flex items-center justify-center bg-black">
                  <img
                    src={capturedImage}
                    alt="Captured Face Preview"
                    className="max-h-full max-w-full object-contain rounded-xl"
                  />
                  <div className="absolute top-3 left-3 bg-black/75 backdrop-blur-md px-3 py-1 rounded-full text-[11px] text-white flex items-center gap-1.5 border border-white/10 shadow-sm">
                    <CheckCircle2 className="w-3.5 h-3.5 text-success" /> Photo Ready for Verification
                  </div>
                </div>
              ) : isCameraActive ? (
                <div className="relative w-full h-[280px] flex items-center justify-center bg-black">
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

                  {/* Face Framing Guideline */}
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                    <div className="w-40 h-48 rounded-[50%] border-2 border-dashed border-primary flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.4)]">
                      <div className="w-36 h-44 rounded-[50%] border border-primary/40" />
                    </div>
                    <p className="mt-2 text-[10px] font-medium text-white bg-black/70 px-2.5 py-0.5 rounded-full backdrop-blur-sm">
                      Align your face within the oval frame
                    </p>
                  </div>

                  {/* Switch Camera */}
                  <div className="absolute top-3 right-3">
                    <IconButton
                      label="Switch Camera"
                      size="sm"
                      variant="ghost"
                      className="bg-black/60 text-white hover:bg-black/90 shadow-sm"
                      onClick={handleToggleCamera}
                    >
                      <SwitchCamera className="w-4 h-4" />
                    </IconButton>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center text-primary mx-auto shadow-inner">
                    <Camera className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="font-bold text-text text-sm">Position your face in front of the camera</p>
                    <p className="text-muted text-xs mt-0.5 max-w-xs mx-auto">
                      Ensure good lighting and avoid sunglasses or face coverings.
                    </p>
                  </div>

                  {cameraError && (
                    <div className="p-2.5 rounded-xl bg-danger-muted/30 border border-danger/30 text-danger text-xs flex items-center gap-1.5 justify-center max-w-sm mx-auto">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{cameraError}</span>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    <Button
                      variant="primary"
                      size="md"
                      type="button"
                      loading={cameraLoading}
                      onClick={() => startCamera()}
                    >
                      <Camera className="w-4 h-4 mr-1.5" />
                      <span>Open Camera</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="md"
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-4 h-4 mr-1.5" />
                      <span>Upload Photo</span>
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Camera Actions */}
            {isCameraActive && (
              <div className="flex items-center justify-between gap-2 pt-1">
                <Button variant="secondary" size="sm" type="button" onClick={stopCamera}>
                  Cancel
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-3.5 h-3.5 mr-1" />
                    <span>Upload File</span>
                  </Button>
                  <Button variant="primary" size="md" type="button" onClick={handleCapture}>
                    <Camera className="w-4 h-4 mr-1.5" />
                    <span>Capture Photo</span>
                  </Button>
                </div>
              </div>
            )}

            {/* Retake Actions */}
            {capturedImage && (
              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => {
                      setCapturedImage(null);
                      startCamera();
                    }}
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1" />
                    <span>Retake</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-3.5 h-3.5 mr-1" />
                    <span>Choose Another</span>
                  </Button>
                </div>

                <Button
                  variant="primary"
                  size="md"
                  type="submit"
                  loading={enrolling}
                  className="shadow-md"
                >
                  <ShieldCheck className="w-4 h-4 mr-1.5" />
                  <span>Register & Enter Gym</span>
                </Button>
              </div>
            )}
          </form>

          <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted">
            <span className="flex items-center gap-1 text-[11px]">
              <Sparkles className="w-3.5 h-3.5 text-accent" />
              <span>Contact details can be completed anytime in Profile</span>
            </span>

            <button
              type="button"
              onClick={logout}
              className="text-danger hover:underline inline-flex items-center gap-1 text-[11px] font-medium"
            >
              <LogOut className="w-3 h-3" /> Sign out
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
};
