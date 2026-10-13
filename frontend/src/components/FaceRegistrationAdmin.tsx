import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  ScanFace,
  Search,
  Camera,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Video,
  VideoOff,
  Loader2,
  User,
  AlertTriangle,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { Card, Badge, Alert, EmptyState } from '../ui/primitives';
import { Button } from '../ui/Button';
import { SearchInput } from '../ui/Input';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { cn } from '../lib/cn';
import { FaceIdIcon } from './FaceIdIcon';
import { SyncStatusBanner } from './SyncStatusBanner';

/* ─────────── Types ─────────── */

interface StudentSearchResult {
  id: string;
  personId: string;
  rollNumber: string;
  name: string;
  email: string;
  department: string;
  residency: string;
  faceEnrollmentStatus: string;
  joiningYear: number;
}

type CaptureStep = 'idle' | 'searching' | 'selected' | 'camera' | 'preview' | 'submitting' | 'success' | 'error';

/* ─────────── Component ─────────── */

export const FaceRegistrationAdmin: React.FC = () => {
  const toast = useToast();

  // Student search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StudentSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentSearchResult | null>(null);

  // Is the student's photo already uploaded (Face Upload)? Needed before camera capture.
  const [photoState, setPhotoState] = useState<'checking' | 'yes' | 'no' | 'offline'>('checking');

  // Camera state
  const [step, setStep] = useState<CaptureStep>('idle');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ─────────── Student Search (debounced) ─────────── */

  const searchStudents = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const data = await api.get<{ items: StudentSearchResult[]; pagination: { total: number } }>(
        '/api/v1/people/students',
        { params: { search: query, limit: 10, page: 1 } }
      );
      const students = (data as any).items || (data as any).students || (Array.isArray(data) ? data : []);
      setSearchResults(students);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    searchTimeoutRef.current = setTimeout(() => searchStudents(searchQuery), 350);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery, searchStudents]);

  /* ─────────── Camera Controls ─────────── */

  const startCamera = useCallback(async () => {
    setCameraError(null);
    if (!window.isSecureContext) {
      const msg = 'Camera requires HTTPS or localhost. You are on an insecure origin.';
      setCameraError(msg);
      toast.error(msg, 'Camera Error');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      const msg = 'Camera API not supported in this browser. Use Chrome/Edge over HTTPS or localhost.';
      setCameraError(msg);
      toast.error(msg, 'Camera Error');
      return;
    }
    try {
      // Stop any previous stream first
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false,
      });
      streamRef.current = stream;
      // Render the <video> element first; attachment happens in the
      // effect below once it is mounted (fixes black screen race).
      setStep('camera');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Camera access denied';
      setCameraError(msg);
      toast.error('Unable to access camera. Please grant camera permissions.', 'Camera Error');
    }
  }, [toast]);

  // Attach the stream once the <video> element is mounted.
  useEffect(() => {
    if (step !== 'camera') return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    let cancelled = false;
    video.srcObject = stream;
    video.play().catch((err) => {
      if (!cancelled) {
        const msg = err instanceof Error ? err.message : 'Unable to play camera stream';
        setCameraError(msg);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [step]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  /* ─────────── Photo Capture ─────────── */

  // Snapshot the current video frame. Retries briefly to cover the case
  // where the video element is mid-render when the countdown finishes.
  const snapPhoto = useCallback(
    (attempt = 0) => {
      const v = videoRef.current;
      const canvas = canvasRef.current;
      if (!v || !canvas) return;
      if (v.readyState < 2 || v.videoWidth === 0 || v.videoHeight === 0) {
        if (attempt < 10) {
          setTimeout(() => snapPhoto(attempt + 1), 200);
          return;
        }
        setCountdown(null);
        toast.error('Video frame not ready. Retake once the live feed is visible.', 'Capture Failed');
        return;
      }
      canvas.width = v.videoWidth;
      canvas.height = v.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setCountdown(null);
        toast.error('Could not read the camera frame. Please retry.', 'Capture Failed');
        return;
      }
      // Mirror horizontally for selfie-style
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      ctx.setTransform(1, 0, 0, 1, 0, 0); // reset
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      setCountdown(null);
      if (!dataUrl || dataUrl.length < 1000 || !dataUrl.startsWith('data:image')) {
        toast.error('Captured an empty frame. Make sure the live feed is visible and retry.', 'Capture Failed');
        return;
      }
      setCapturedImage(dataUrl);
      setStep('preview');
      stopCamera();
    },
    [stopCamera, toast]
  );

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    if (!video || !streamRef.current) {
      toast.error('Camera is not running. Click Start Camera first.', 'Camera Not Ready');
      return;
    }
    if (video.readyState < 2 || video.videoWidth === 0) {
      toast.error('Camera is still starting. Wait a second for the live feed, then capture.', 'Camera Not Ready');
      return;
    }
    // Plain countdown state — the actual snapshot runs in snapPhoto,
    // outside of any state updater (updaters must stay side-effect free).
    setCountdown(3);
    let remaining = 3;
    const timer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(timer);
        snapPhoto();
      } else {
        setCountdown(remaining);
      }
    }, 1000);
  }, [snapPhoto, toast]);

  const retakePhoto = useCallback(() => {
    setCapturedImage(null);
    setStep('selected');
    setSubmitError(null);
  }, []);

  /* ─────────── Submit Face Enrollment ─────────── */

  const submitFaceRegistration = useCallback(async () => {
    if (!selectedStudent || !capturedImage) return;

    setStep('submitting');
    setSubmitError(null);
    try {
      // Extract base64 data from data URL
      const base64Data = capturedImage.split(',')[1];

      const result = await api.post<{
        status: string;
        message: string;
        gateStatus?: 'enrolled' | 'pending';
        score?: number;
      }>('/api/v1/face-ml/capture-enroll', {
        studentId: selectedStudent.id,
        imageBase64: base64Data,
      });

      // Anything but REGISTERED means: no uploaded photo, face does not match, bad capture, ...
      if (result.status !== 'REGISTERED') {
        setSubmitError(result.message);
        setStep('error');
        toast.error(result.message, 'Not Registered');
        if (result.status === 'NO_PHOTO') setPhotoState('no');
        return;
      }

      const msg = result.message;
      const status = result.gateStatus === 'enrolled' ? 'enrolled' : 'pending';
      setSuccessMessage(msg);
      setStep('success');
      if (status === 'pending') {
        toast.success(msg, 'Face Saved');
      } else {
        toast.success(msg, 'Face Registered');
      }

      // Update the selected student status locally
      setSelectedStudent((prev) =>
        prev ? { ...prev, faceEnrollmentStatus: status } : null
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSubmitError(msg);
      setStep('error');
      toast.error(msg, 'Registration Failed');
    }
  }, [selectedStudent, capturedImage, toast]);

  /* ─────────── Reset Flow ─────────── */

  const resetFlow = useCallback(() => {
    stopCamera();
    setSelectedStudent(null);
    setCapturedImage(null);
    setStep('idle');
    setSubmitError(null);
    setSuccessMessage(null);
    setSearchQuery('');
    setSearchResults([]);
  }, [stopCamera]);

  const selectStudent = useCallback(
    (student: StudentSearchResult) => {
      stopCamera();
      setSelectedStudent(student);
      setCapturedImage(null);
      setStep('selected');
      setSubmitError(null);
      setSuccessMessage(null);
      setSearchResults([]);
      setSearchQuery('');
      setPhotoState('checking');
      api
        .get<{ registered: boolean; online: boolean }>(
          `/api/v1/face-ml/status/${encodeURIComponent(student.rollNumber)}`
        )
        .then((r) => setPhotoState(!r.online ? 'offline' : r.registered ? 'yes' : 'no'))
        .catch(() => setPhotoState('offline'));
    },
    [stopCamera]
  );

  /* ─────────── Enrollment Status Badge ─────────── */

  const enrollmentBadge = (status: string) => {
    if (status === 'enrolled') return <Badge tone="success">✓ Enrolled</Badge>;
    if (status === 'on_zkbio') return <Badge tone="neutral">In ZKBio</Badge>;
    if (status === 'pending') return <Badge tone="warning">Pending</Badge>;
    return <Badge tone="danger">Not Enrolled</Badge>;
  };

  /* ─────────── Render ─────────── */

  return (
    <div className="space-y-6">
      <SyncStatusBanner />
      {/* Header Card */}
      <Card className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
                <ScanFace className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-base sm:text-lg text-text">
                  Face Registration Center
                </h3>
                <p className="text-xs text-secondary mt-0.5">
                  Register student faces for gym turnstile access via webcam capture
                </p>
              </div>
            </div>
          </div>

          {selectedStudent && (
            <Button variant="ghost" size="sm" onClick={resetFlow}>
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Start Over</span>
            </Button>
          )}
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1 text-xs text-muted">
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-medium transition-all',
              !selectedStudent
                ? 'bg-primary text-primary-foreground'
                : 'bg-surface-elevated text-secondary'
            )}
          >
            1. Select Student
          </span>
          <ChevronRight className="w-3 h-3 text-muted" />
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-medium transition-all',
              step === 'camera' || step === 'preview'
                ? 'bg-primary text-primary-foreground'
                : 'bg-surface-elevated text-secondary'
            )}
          >
            2. Capture Face
          </span>
          <ChevronRight className="w-3 h-3 text-muted" />
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-medium transition-all',
              step === 'submitting' || step === 'success'
                ? 'bg-primary text-primary-foreground'
                : 'bg-surface-elevated text-secondary'
            )}
          >
            3. Register
          </span>
        </div>
      </Card>

      {/* ────── Step 1: Student Search ────── */}
      {!selectedStudent && (
        <Card className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Search className="w-4 h-4 text-primary" />
            <h4 className="font-semibold text-sm text-text">Find Student</h4>
          </div>

          <SearchInput
            placeholder="Search by name, roll number, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />

          {searchLoading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="ml-2 text-sm text-secondary">Searching...</span>
            </div>
          )}

          {!searchLoading && searchQuery.length >= 2 && searchResults.length === 0 && (
            <EmptyState
              icon={<User className="w-5 h-5" />}
              title="No students found"
              description="Try a different name, roll number, or email"
            />
          )}

          {searchResults.length > 0 && (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {searchResults.map((student) => (
                <button
                  key={student.id}
                  type="button"
                  onClick={() => selectStudent(student)}
                  className={cn(
                    'w-full flex items-center gap-4 p-4 rounded-xl border border-border',
                    'hover:bg-surface-elevated hover:border-primary/30 transition-all duration-200',
                    'text-left group cursor-pointer'
                  )}
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 shrink-0">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-text truncate">{student.name}</p>
                    <p className="text-xs text-muted font-mono">{student.rollNumber}</p>
                    <p className="text-xs text-secondary truncate">{student.department}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {enrollmentBadge(student.faceEnrollmentStatus)}
                    <Badge tone="neutral">{student.residency}</Badge>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted group-hover:text-primary transition-colors shrink-0" />
                </button>
              ))}
            </div>
          )}

          {searchQuery.length < 2 && searchResults.length === 0 && !searchLoading && (
            <div className="text-center py-8 space-y-3">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <ScanFace className="w-8 h-8 text-primary" />
                </div>
              </div>
              <p className="text-sm text-secondary">
                Search for a student to begin face registration
              </p>
              <p className="text-xs text-muted">
                Enter at least 2 characters to search by name, roll number, or email
              </p>
            </div>
          )}
        </Card>
      )}

      {/* ────── Step 2: Selected Student + Camera ────── */}
      {selectedStudent && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Student Info Card */}
          <Card className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <User className="w-4 h-4 text-primary" />
              <h4 className="font-semibold text-sm text-text">Student Details</h4>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-xl bg-surface-elevated">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-xl font-bold text-primary">
                  {selectedStudent.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <p className="font-bold text-text truncate">{selectedStudent.name}</p>
                <p className="text-xs text-muted font-mono">{selectedStudent.rollNumber}</p>
                <p className="text-xs text-secondary truncate">{selectedStudent.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-surface-elevated">
                <p className="text-[11px] text-muted uppercase tracking-wider mb-0.5">Department</p>
                <p className="text-xs font-medium text-text truncate">{selectedStudent.department}</p>
              </div>
              <div className="p-3 rounded-lg bg-surface-elevated">
                <p className="text-[11px] text-muted uppercase tracking-wider mb-0.5">Residency</p>
                <p className="text-xs font-medium text-text capitalize">{selectedStudent.residency.replace('_', ' ')}</p>
              </div>
              <div className="p-3 rounded-lg bg-surface-elevated">
                <p className="text-[11px] text-muted uppercase tracking-wider mb-0.5">Year</p>
                <p className="text-xs font-medium text-text">{selectedStudent.joiningYear}</p>
              </div>
              <div className="p-3 rounded-lg bg-surface-elevated">
                <p className="text-[11px] text-muted uppercase tracking-wider mb-0.5">Face ID</p>
                <div className="mt-0.5">{enrollmentBadge(selectedStudent.faceEnrollmentStatus)}</div>
              </div>
            </div>

            {selectedStudent.faceEnrollmentStatus === 'enrolled' && (
              <Alert tone="success">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                  <span className="text-xs">This student's face is already registered. You can re-register to update their face data.</span>
                </div>
              </Alert>
            )}

            {photoState === 'checking' && (
              <Alert tone="info">
                <span className="text-xs">Checking for the student's uploaded photo...</span>
              </Alert>
            )}
            {photoState === 'no' && (
              <Alert tone="warning">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span className="text-xs">
                    No photo uploaded for this student. Upload it in <b>Face Upload</b> first, then come back to capture.
                  </span>
                </div>
              </Alert>
            )}
            {photoState === 'offline' && (
              <Alert tone="danger">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span className="text-xs">Face service is not reachable. Start face_ML/start.bat and reselect the student.</span>
                </div>
              </Alert>
            )}
            {photoState === 'yes' && (
              <Alert tone="success">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span className="text-xs">Student photo found. The capture will be checked against it.</span>
                </div>
              </Alert>
            )}

            {step !== 'camera' && step !== 'preview' && step !== 'submitting' && step !== 'success' && (
              <Button
                variant="primary"
                size="md"
                className="w-full"
                onClick={startCamera}
                disabled={photoState !== 'yes'}
              >
                <Camera className="w-4 h-4" />
                <span>{selectedStudent.faceEnrollmentStatus === 'enrolled' ? 'Re-capture Face' : 'Start Camera'}</span>
              </Button>
            )}
          </Card>

          {/* Camera / Preview Card */}
          <Card className="lg:col-span-3 space-y-4">
            {/* Camera active */}
            {step === 'camera' && (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Video className="w-4 h-4 text-success animate-pulse" />
                    <h4 className="font-semibold text-sm text-text">Live Camera Feed</h4>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { stopCamera(); setStep('selected'); }}>
                    <VideoOff className="w-3.5 h-3.5" />
                    <span>Stop</span>
                  </Button>
                </div>

                <div className="relative rounded-2xl overflow-hidden bg-black aspect-[4/3]">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    style={{ transform: 'scaleX(-1)' }}
                  />

                  {/* Face guide overlay */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-52 h-64 border-2 border-white/40 rounded-[50%] relative">
                      <div className="absolute -top-1 -left-1 w-5 h-5 border-t-2 border-l-2 border-primary rounded-tl-lg" />
                      <div className="absolute -top-1 -right-1 w-5 h-5 border-t-2 border-r-2 border-primary rounded-tr-lg" />
                      <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-2 border-l-2 border-primary rounded-bl-lg" />
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-2 border-r-2 border-primary rounded-br-lg" />
                    </div>
                  </div>

                  {/* Countdown overlay */}
                  {countdown !== null && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm">
                      <div className="w-24 h-24 rounded-full bg-primary/90 flex items-center justify-center animate-pulse">
                        <span className="text-4xl font-bold text-white">{countdown}</span>
                      </div>
                    </div>
                  )}

                  {/* Guidance text */}
                  <div className="absolute bottom-4 inset-x-4 text-center">
                    <p className="text-xs text-white/80 bg-black/50 inline-block px-3 py-1.5 rounded-full backdrop-blur-sm">
                      Position the student's face within the oval guide
                    </p>
                  </div>
                </div>

                <div className="flex justify-center">
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={capturePhoto}
                    disabled={countdown !== null}
                    className="min-w-[200px]"
                  >
                    <Camera className="w-4 h-4" />
                    <span>{countdown !== null ? 'Capturing...' : 'Capture Photo (3s timer)'}</span>
                  </Button>
                </div>

                <p className="text-center text-xs text-muted">
                  Ensure good lighting and a neutral expression for best recognition accuracy
                </p>
              </>
            )}

            {/* Preview captured photo */}
            {step === 'preview' && capturedImage && (
              <>
                <div className="flex items-center gap-2">
                  <FaceIdIcon className="w-5 h-5 text-primary" />
                  <h4 className="font-semibold text-sm text-text">Captured Photo Preview</h4>
                </div>

                <div className="relative rounded-2xl overflow-hidden bg-black aspect-[4/3]">
                  <img
                    src={capturedImage}
                    alt="Captured face"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-3 right-3">
                    <Badge tone="success">Photo Captured</Badge>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="ghost" size="md" className="flex-1" onClick={retakePhoto}>
                    <RotateCcw className="w-4 h-4" />
                    <span>Retake</span>
                  </Button>
                  <Button variant="success" size="md" className="flex-1" onClick={submitFaceRegistration}>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Register Face</span>
                  </Button>
                </div>
              </>
            )}

            {/* Submitting state */}
            {step === 'submitting' && (
              <div className="flex flex-col items-center justify-center py-16 space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
                <p className="text-sm font-medium text-text">Registering face data...</p>
                <p className="text-xs text-muted">Syncing biometric template with gym turnstile hardware</p>
              </div>
            )}

            {/* Success state */}
            {step === 'success' && (
              <div className="flex flex-col items-center justify-center py-16 space-y-4">
                <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10 text-success" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-lg font-bold text-text">Face Registered Successfully!</p>
                  <p className="text-sm text-secondary max-w-md">
                    {successMessage || `${selectedStudent?.name} can now use facial recognition to enter the gym.`}
                  </p>
                </div>
                <div className="flex gap-3 mt-4">
                  <Button variant="secondary" size="md" onClick={resetFlow}>
                    <Sparkles className="w-4 h-4" />
                    <span>Register Another Student</span>
                  </Button>
                </div>
              </div>
            )}

            {/* Error state */}
            {step === 'error' && (
              <div className="flex flex-col items-center justify-center py-16 space-y-4">
                <div className="w-20 h-20 rounded-full bg-danger/10 flex items-center justify-center">
                  <XCircle className="w-10 h-10 text-danger" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-lg font-bold text-text">Registration Failed</p>
                  <p className="text-sm text-danger max-w-md">{submitError}</p>
                </div>
                <div className="flex gap-3 mt-4">
                  <Button variant="ghost" size="md" onClick={() => { setStep('selected'); setSubmitError(null); }}>
                    <RotateCcw className="w-4 h-4" />
                    <span>Try Again</span>
                  </Button>
                </div>
              </div>
            )}

            {/* Initial camera prompt */}
            {step === 'selected' && (
              <div className="flex flex-col items-center justify-center py-16 space-y-4">
                <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Camera className="w-10 h-10 text-primary" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-base font-bold text-text">Ready to Capture</p>
                  <p className="text-sm text-secondary">
                    Click "Start Camera" on the left to begin capturing {selectedStudent?.name}'s face
                  </p>
                </div>

                {cameraError && (
                  <Alert tone="danger">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span className="text-xs">{cameraError}</span>
                    </div>
                  </Alert>
                )}

                <div className="p-4 rounded-xl bg-surface-elevated space-y-2 max-w-sm w-full">
                  <p className="text-xs font-medium text-text">Tips for best results:</p>
                  <ul className="text-xs text-muted space-y-1.5 list-none">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-3 h-3 text-success mt-0.5 shrink-0" />
                      Good, even lighting on the face
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-3 h-3 text-success mt-0.5 shrink-0" />
                      Student facing directly at the camera
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-3 h-3 text-success mt-0.5 shrink-0" />
                      Neutral expression, no glasses if possible
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-3 h-3 text-success mt-0.5 shrink-0" />
                      No hats, scarves, or face coverings
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Hidden canvas for photo capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};
