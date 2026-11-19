'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { getOrCreateDeviceHash } from '@/lib/utils/deviceHash';
import {
  QrCode,
  KeyRound,
  Camera,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Smartphone,
  ShieldCheck,
  RefreshCw,
  Send,
  Radio,
} from 'lucide-react';

interface ActiveSessionOption {
  id: string;
  classId: string;
  className: string;
  section?: string;
  teacherName: string;
  mode: string;
  geofence?: { enabled: boolean; radiusMeters?: number };
}

export default function StudentCheckinPage() {
  return (
    <ProtectedRoute allowedRoles={['student']}>
      <Suspense
        fallback={
          <div className="flex-1 flex items-center justify-center p-8 bg-slate-950 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
          </div>
        }
      >
        <StudentCheckinContent />
      </Suspense>
    </ProtectedRoute>
  );
}

function StudentCheckinContent() {
  const searchParams = useSearchParams();
  const preselectedSessionId = searchParams.get('sessionId') || '';
  const { user, profile } = useAuth();

  // Active check-in tab: 'scan_qr' | 'enter_pin'
  const [activeTab, setActiveTab] = useState<'scan_qr' | 'enter_pin'>('scan_qr');

  // Active sessions available for student
  const [activeSessions, setActiveSessions] = useState<ActiveSessionOption[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>(preselectedSessionId);
  const [loadingSessions, setLoadingSessions] = useState<boolean>(true);

  // Inputs
  const [pinInput, setPinInput] = useState<string>('');
  const [manualQrInput, setManualQrInput] = useState<string>('');
  const [showManualQrInput, setShowManualQrInput] = useState<boolean>(false);

  // Camera scanner state
  const [scannerActive, setScannerActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scannerRef = useRef<any>(null);

  // Submission state
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<any>(null);

  // GPS state
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'requesting' | 'ready' | 'denied'>('idle');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  // 1. Fetch active sessions for student's enrolled courses
  useEffect(() => {
    async function loadSessions() {
      if (!user) return;
      setLoadingSessions(true);
      try {
        const idToken = await user.getIdToken();
        const res = await fetch('/api/sessions/active', {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        const data = await res.json();
        if (res.ok) {
          const list: ActiveSessionOption[] = data.activeSessions || [];
          setActiveSessions(list);
          if (preselectedSessionId && list.some((s) => s.id === preselectedSessionId)) {
            setSelectedSessionId(preselectedSessionId);
          } else if (list.length > 0 && !selectedSessionId) {
            setSelectedSessionId(list[0].id);
          }
        }
      } catch (err) {
        console.error('Error fetching active sessions:', err);
      } finally {
        setLoadingSessions(false);
      }
    }
    loadSessions();
  }, [user, preselectedSessionId]);

  const selectedSession = activeSessions.find((s) => s.id === selectedSessionId);

  // 2. Request Geolocation helper
  const acquireLocation = (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        setGpsStatus('denied');
        reject(new Error('Geolocation is not supported by your browser'));
        return;
      }
      setGpsStatus('requesting');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCoords(location);
          setGpsStatus('ready');
          resolve(location);
        },
        (err) => {
          setGpsStatus('denied');
          reject(new Error('Location permission denied. Please allow GPS to check in.'));
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  };

  // 3. Main Check-In Submission
  const submitCheckIn = async (payloadSessionId: string, tokenOrPinValue: string) => {
    if (!user) return;
    setSubmitting(true);
    setErrorMessage(null);
    setSuccessResult(null);

    try {
      // Step A: Read / generate sticky device fingerprint
      const deviceHash = await getOrCreateDeviceHash();

      // Step B: Acquire GPS if required or available
      let latVal: number | undefined = coords?.lat;
      let lngVal: number | undefined = coords?.lng;

      // If geofence is enabled on selected session, enforce GPS prompt
      if (selectedSession?.geofence?.enabled && (latVal === undefined || lngVal === undefined)) {
        try {
          const loc = await acquireLocation();
          latVal = loc.lat;
          lngVal = loc.lng;
        } catch (gpsErr: any) {
          setErrorMessage(gpsErr.message || 'GPS location required for this classroom session');
          setSubmitting(false);
          return;
        }
      }

      // Step C: Send verification request to server
      const idToken = await user.getIdToken();
      const res = await fetch('/api/attendance/checkin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          sessionId: payloadSessionId,
          tokenOrPin: tokenOrPinValue.trim(),
          lat: latVal,
          lng: lngVal,
          deviceHash,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccessResult({
          status: data.status,
          message: data.message,
          className: data.record?.className || selectedSession?.className || 'Course',
          studentRollNumber: profile?.rollNumber,
          timestamp: new Date().toLocaleTimeString(),
        });
      } else {
        setErrorMessage(data.error || 'Attendance verification failed');
      }
    } catch (err: any) {
      console.error('Error submitting checkin:', err);
      setErrorMessage(err.message || 'Network error during check-in');
    } finally {
      setSubmitting(false);
    }
  };

  // 4. Handle QR scan result
  const handleQrDetected = async (decodedText: string) => {
    // If scanner is running, stop it
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        setScannerActive(false);
      } catch (e) {
        // ignore
      }
    }

    // QR format: `${sessionId}.${windowIndex}.${signature}`
    const parts = decodedText.split('.');
    if (parts.length === 3) {
      const qrSessionId = parts[0];
      setSelectedSessionId(qrSessionId);
      await submitCheckIn(qrSessionId, decodedText);
    } else {
      // In case the QR is just the raw text
      if (selectedSessionId) {
        await submitCheckIn(selectedSessionId, decodedText);
      } else {
        setErrorMessage('Invalid QR code format. Please ensure you are scanning the live classroom QR.');
      }
    }
  };

  // Start html5-qrcode scanner
  const startScanner = async () => {
    setCameraError(null);
    setErrorMessage(null);
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          handleQrDetected(decodedText);
        },
        () => {
          // scanning frame - ignore
        }
      );
      setScannerActive(true);
    } catch (err: any) {
      console.error('Scanner error:', err);
      setCameraError(
        'Unable to access camera. Please check browser permissions or use the manual code option below.'
      );
      setScannerActive(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (e) {
        // ignore
      }
      scannerRef.current = null;
    }
    setScannerActive(false);
  };

  // Clean up scanner on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  return (
    <div className="flex-1 max-w-xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-10">
      {/* Top back navigation */}
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/student/dashboard"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Student Portal</span>
        </Link>
        <span className="text-xs font-mono text-sky-400 bg-sky-500/10 px-2.5 py-1 rounded-md border border-sky-500/20">
          Roll: {profile?.rollNumber || 'Verified'}
        </span>
      </div>

      {/* Main Container Card */}
      <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-sky-500/10 blur-[80px] pointer-events-none rounded-full" />

        {/* Card Header */}
        <div className="text-center mb-6">
          <div className="inline-flex w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 items-center justify-center mb-3 shadow-lg shadow-sky-500/10">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Classroom Check-In</h1>
          <p className="text-xs text-slate-400 mt-1">
            Scan the live rotating classroom code or enter your faculty&apos;s 6-character PIN.
          </p>
        </div>

        {/* SUCCESS STATE */}
        {successResult && (
          <div className="mb-6 p-6 rounded-2xl bg-gradient-to-b from-emerald-950/50 to-slate-950 border border-emerald-500/40 text-center animate-in fade-in duration-300">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider mb-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {successResult.status === 'late' ? 'Marked Late' : 'Marked Present'}
            </div>

            <h2 className="text-xl font-bold text-white mb-1">{successResult.className}</h2>
            <p className="text-xs text-slate-300 mb-4">{successResult.message}</p>

            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-400 flex justify-around">
              <div>
                <span className="block text-[10px] text-slate-500 uppercase font-semibold">Roll No</span>
                <span className="font-mono text-white font-bold">{successResult.studentRollNumber}</span>
              </div>
              <div className="w-px bg-slate-800" />
              <div>
                <span className="block text-[10px] text-slate-500 uppercase font-semibold">Recorded At</span>
                <span className="font-mono text-white font-bold">{successResult.timestamp}</span>
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setSuccessResult(null);
                  setPinInput('');
                  setManualQrInput('');
                }}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors"
              >
                Check In to Another Class
              </button>
              <Link
                href="/student/dashboard"
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-colors flex items-center justify-center"
              >
                Return to Dashboard
              </Link>
            </div>
          </div>
        )}

        {/* ERROR NOTIFICATION */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-xs leading-relaxed">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold block mb-0.5">Check-In Blocked</span>
              {errorMessage}
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-400 hover:text-rose-200 font-bold ml-2"
            >
              ×
            </button>
          </div>
        )}

        {/* ACTIVE SESSION PICKER (Required for PIN mode or manual testing) */}
        {!successResult && (
          <div className="mb-6">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Select Enrolled Course
            </label>
            {loadingSessions ? (
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
                <span>Scanning for active class sessions...</span>
              </div>
            ) : activeSessions.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-400">
                <Radio className="w-5 h-5 text-slate-600 mx-auto mb-1.5" />
                <span>No active attendance sessions currently open for your courses.</span>
                <p className="text-[11px] text-slate-500 mt-1">
                  Once your instructor clicks &ldquo;Start Session&rdquo;, it will appear here.
                </p>
              </div>
            ) : (
              <select
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-medium focus:outline-none focus:border-sky-500 transition-colors"
              >
                {activeSessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.className} {s.section ? `(${s.section})` : ''} — Instructor: {s.teacherName}
                  </option>
                ))}
              </select>
            )}

            {selectedSession?.geofence?.enabled && (
              <div className="mt-2 text-[11px] text-emerald-400 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                <span>Classroom geofencing enabled ({selectedSession.geofence.radiusMeters}m). GPS required.</span>
              </div>
            )}
          </div>
        )}

        {/* CHECK-IN METHOD TABS */}
        {!successResult && (
          <div>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-2xl border border-slate-800 mb-6">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('scan_qr');
                  stopScanner();
                }}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === 'scan_qr'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <QrCode className="w-4 h-4" />
                <span>Scan QR Code</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('enter_pin');
                  stopScanner();
                }}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === 'enter_pin'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <KeyRound className="w-4 h-4" />
                <span>Enter 6-Char PIN</span>
              </button>
            </div>

            {/* TAB 1: SCAN QR CODE */}
            {activeTab === 'scan_qr' && (
              <div className="space-y-4">
                {/* Camera Viewfinder Container */}
                <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 min-h-[260px] flex flex-col items-center justify-center p-4">
                  <div id="qr-reader" className="w-full max-w-[280px]" />

                  {!scannerActive && (
                    <div className="text-center py-6">
                      <Camera className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                      <p className="text-xs text-slate-400 max-w-xs mx-auto mb-4">
                        Point your device camera at the rotating QR code projected in class.
                      </p>
                      <button
                        type="button"
                        onClick={startScanner}
                        disabled={submitting}
                        className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs shadow-md shadow-sky-600/30 transition-all hover:scale-[1.02] flex items-center gap-2 mx-auto"
                      >
                        <Camera className="w-4 h-4" />
                        <span>Launch Camera Scanner</span>
                      </button>
                    </div>
                  )}

                  {scannerActive && (
                    <button
                      type="button"
                      onClick={stopScanner}
                      className="mt-4 px-4 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition-colors"
                    >
                      Close Camera
                    </button>
                  )}
                </div>

                {cameraError && (
                  <p className="text-xs text-amber-400 text-center">{cameraError}</p>
                )}

                {/* Manual QR Input Fallback (Ideal for Laptop & Dev Testing) */}
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => setShowManualQrInput(!showManualQrInput)}
                    className="text-xs text-slate-400 hover:text-sky-300 underline underline-offset-4"
                  >
                    {showManualQrInput ? 'Hide manual token input' : 'Paste QR token manually (testing fallback)'}
                  </button>

                  {showManualQrInput && (
                    <div className="mt-3 p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-left space-y-3">
                      <label className="block text-xs font-semibold text-slate-300">
                        Paste Full QR Token Payload
                      </label>
                      <input
                        type="text"
                        value={manualQrInput}
                        onChange={(e) => setManualQrInput(e.target.value)}
                        placeholder="sessionId.windowIndex.signature"
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-sky-500"
                      />
                      <button
                        type="button"
                        disabled={submitting || !manualQrInput.trim()}
                        onClick={() => handleQrDetected(manualQrInput.trim())}
                        className="w-full py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all disabled:opacity-50"
                      >
                        {submitting ? 'Verifying...' : 'Submit Token Payload'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: ENTER ROTATING 6-CHAR PIN */}
            {activeTab === 'enter_pin' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!selectedSessionId) {
                    setErrorMessage('Please select an active class session above.');
                    return;
                  }
                  if (pinInput.trim().length !== 6) {
                    setErrorMessage('PIN must be exactly 6 characters.');
                    return;
                  }
                  submitCheckIn(selectedSessionId, pinInput.trim().toUpperCase());
                }}
                className="space-y-5"
              >
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 text-center">
                    6-Character Rotating PIN
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    autoFocus
                    required
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.toUpperCase())}
                    placeholder="e.g. 7X4K9P"
                    className="w-full text-center font-mono text-3xl font-extrabold tracking-[0.2em] py-4 px-4 rounded-2xl bg-slate-950 border border-slate-800 text-sky-400 placeholder-slate-700 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 uppercase transition-colors"
                  />
                  <p className="text-[11px] text-slate-500 text-center mt-2">
                    Enter the code projected on the classroom screen. PIN rotates every 20 seconds.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={submitting || pinInput.trim().length !== 6 || !selectedSessionId}
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-sky-600/25 transition-all hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying Cryptographic PIN...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Attendance</span>
                      <Send className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Device Security & Geolocation Badges */}
        <div className="mt-8 pt-6 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <Smartphone className="w-3.5 h-3.5 text-sky-400" />
            Device Hash Bound (Anti-Multi-Account)
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
            GPS Geofence Protected
          </span>
        </div>
      </div>
    </div>
  );
}
