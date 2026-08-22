import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Upload,
  RefreshCw,
  Search,
  UserCheck,
  SwitchCamera,
} from 'lucide-react';
import { Modal, Badge } from '../ui/primitives';
import { Button, IconButton } from '../ui/Button';
import { Input } from '../ui/Input';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { cn } from '../lib/cn';

export interface StudentSummary {
  id: string;
  name: string;
  rollNumber: string;
  email?: string;
  department?: string;
  faceEnrollmentStatus?: string;
}

interface FaceEnrollmentModalProps {
  open: boolean;
  onClose: () => void;
  initialStudent?: StudentSummary | null;
  onEnrolled?: (student: StudentSummary) => void;
}

export const FaceEnrollmentModal: React.FC<FaceEnrollmentModalProps> = ({
  open,
  onClose,
  initialStudent,
  onEnrolled,
}) => {
  const toast = useToast();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedStudent, setSelectedStudent] = useState<StudentSummary | null>(initialStudent || null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<StudentSummary[]>([]);
  const [searching, setSearching] = useState<boolean>(false);

  // Camera state
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraLoading, setCameraLoading] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Sync initial student
  useEffect(() => {
    if (open) {
      setSelectedStudent(initialStudent || null);
      setSearchQuery('');
      setSearchResults([]);
      setCapturedImage(null);
      setCameraError(null);
    }
  }, [open, initialStudent]);

  // Stop camera tracks helper
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }, [stream]);

  // Start camera stream
  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraLoading(true);
    setCameraError(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported on this browser or connection. Please use file upload.');
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

      setStream(mediaStream);
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
        setCameraError('Camera permission denied. Please allow camera access in your browser settings.');
      } else if (msg.includes('NotFoundError') || msg.includes('DevicesNotFoundError')) {
        setCameraError('No camera found on this device. You can upload a face photo below.');
      } else {
        setCameraError(msg || 'Unable to access camera.');
      }
    } finally {
      setCameraLoading(false);
    }
  }, [facingMode, stopCamera]);

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play().catch(() => {});
      };
      videoRef.current.play().catch(() => {});
    }
  }, [stream, facingMode]);


  // Start camera when modal opens and no captured image
  useEffect(() => {
    if (open && !capturedImage) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [open, capturedImage, startCamera, stopCamera]);

  // Search students if not preselected
  useEffect(() => {
    if (!open || selectedStudent || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get<{ data?: StudentSummary[]; students?: StudentSummary[] } | StudentSummary[]>(
          `/api/v1/students?search=${encodeURIComponent(searchQuery.trim())}&limit=5`
        );
        const list = Array.isArray(res)
          ? res
          : Array.isArray((res as any)?.data)
          ? (res as any).data
          : Array.isArray((res as any)?.students)
          ? (res as any).students
          : [];
        setSearchResults(list);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedStudent, open]);

  // Capture frame from video
  const handleCapture = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Flip horizontally if front-facing for natural mirror
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const base64 = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(base64);
    stopCamera();
  };

  // Retake photo
  const handleRetake = () => {
    setCapturedImage(null);
    startCamera();
  };

  // Toggle front/back camera
  const handleToggleCamera = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  // File upload fallback
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

  // Submit enrollment
  const handleSubmit = async () => {
    if (!selectedStudent) {
      toast.error('Please select a student first.');
      return;
    }
    if (!capturedImage) {
      toast.error('Please capture or upload a face photo.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/api/v1/biometrics/face-enroll', {
        studentId: selectedStudent.id,
        faceImageBase64: capturedImage,
      });

      toast.success(`Face biometrics enrolled for ${selectedStudent.name} (${selectedStudent.rollNumber}).`);
      if (onEnrolled) {
        onEnrolled(selectedStudent);
      }
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg, 'Enrollment Failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title={selectedStudent?.faceEnrollmentStatus === 'enrolled' ? 'Re-enroll Face Biometric' : 'Enroll Face Biometric'}
      onClose={() => {
        stopCamera();
        onClose();
      }}
      wide
      footer={
        <>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              stopCamera();
              onClose();
            }}
          >
            Cancel
          </Button>

          {capturedImage ? (
            <>
              <Button variant="outline" size="sm" onClick={handleRetake} disabled={submitting}>
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retake</span>
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={submitting}
                disabled={!selectedStudent}
                onClick={handleSubmit}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Confirm & Enroll</span>
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              size="sm"
              disabled={cameraLoading || Boolean(cameraError) || !selectedStudent}
              onClick={handleCapture}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Capture Photo</span>
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-5 text-xs">
        {/* Hidden Canvas for Frame Capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Student Selector / Display */}
        {selectedStudent ? (
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-surface-elevated border border-border">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                {selectedStudent.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-bold text-sm text-text">{selectedStudent.name}</p>
                <p className="text-[11px] text-muted font-mono">
                  {selectedStudent.rollNumber} {selectedStudent.department ? `• ${selectedStudent.department}` : ''}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge tone={selectedStudent.faceEnrollmentStatus === 'enrolled' ? 'success' : 'warning'}>
                {selectedStudent.faceEnrollmentStatus === 'enrolled' ? 'Enrolled' : 'Pending Scan'}
              </Badge>
              {!initialStudent && (
                <Button variant="ghost" size="xs" onClick={() => setSelectedStudent(null)}>
                  Change
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="font-semibold text-text">Select Student for Face Enrollment</label>
            <div className="relative">
              <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search by student name, roll number, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {searching && <p className="text-muted text-[11px]">Searching students...</p>}

            {searchResults.length > 0 && (
              <div className="rounded-xl border border-border bg-surface-elevated divide-y divide-border overflow-hidden">
                {searchResults.map((stu) => (
                  <button
                    key={stu.id}
                    type="button"
                    onClick={() => {
                      setSelectedStudent(stu);
                      setSearchQuery('');
                      setSearchResults([]);
                    }}
                    className="w-full text-left p-3 flex items-center justify-between hover:bg-surface transition-colors"
                  >
                    <div>
                      <p className="font-bold text-text">{stu.name}</p>
                      <p className="text-[11px] text-muted font-mono">{stu.rollNumber}</p>
                    </div>
                    <UserCheck className="w-4 h-4 text-primary" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Camera Viewport / Captured Preview */}
        <div className="relative rounded-2xl border border-border bg-black/90 overflow-hidden min-h-[260px] flex items-center justify-center">
          {capturedImage ? (
            <div className="relative w-full h-[280px] flex items-center justify-center bg-black">
              <img
                src={capturedImage}
                alt="Captured Face Preview"
                className="max-h-full max-w-full object-contain rounded-xl"
              />
              <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[11px] text-white flex items-center gap-1.5 border border-white/10">
                <CheckCircle2 className="w-3.5 h-3.5 text-success" /> Photo Ready for Enrollment
              </div>
            </div>
          ) : cameraError ? (
            <div className="p-6 text-center space-y-3 max-w-sm">
              <AlertCircle className="w-8 h-8 text-danger mx-auto" />
              <p className="text-danger font-medium text-xs">{cameraError}</p>
              <div className="flex items-center justify-center gap-2 pt-2">
                <Button variant="outline" size="xs" onClick={startCamera}>
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Camera</span>
                </Button>
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Photo</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="relative w-full h-[280px] flex items-center justify-center">
              <video
                ref={(el) => {
                  videoRef.current = el;
                  if (el && stream && el.srcObject !== stream) {
                    el.srcObject = stream;
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


              {/* Facial Alignment Guideline Overlay */}
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                <div className="w-44 h-56 rounded-[50%] border-2 border-dashed border-primary/70 shadow-[0_0_20px_rgba(59,130,246,0.3)] flex items-center justify-center">
                  <div className="w-40 h-52 rounded-[50%] border border-primary/30" />
                </div>
                <p className="mt-2 text-[11px] font-medium text-white/90 bg-black/50 px-2.5 py-0.5 rounded-full backdrop-blur-sm">
                  Align face within the oval guideline
                </p>
              </div>

              {/* Camera Switch Control */}
              <div className="absolute top-3 right-3 flex items-center gap-2">
                <IconButton
                  label="Switch Camera"
                  size="sm"
                  variant="ghost"
                  className="bg-black/50 text-white hover:bg-black/80 backdrop-blur-sm"
                  onClick={handleToggleCamera}
                >
                  <SwitchCamera className="w-4 h-4" />
                </IconButton>
              </div>
            </div>
          )}
        </div>

        {/* Alternative Photo Upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileUpload}
        />

        <div className="flex items-center justify-between text-[11px] text-muted px-1">
          <span>Camera stream is processed locally. Biometric vectors are encrypted.</span>
          <button
            type="button"
            className="text-primary hover:underline font-medium inline-flex items-center gap-1"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-3 h-3" /> Upload from file
          </button>
        </div>
      </div>
    </Modal>
  );
};
