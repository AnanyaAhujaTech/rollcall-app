'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { QRCodeSVG } from 'qrcode.react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import {
  AttendanceRecord,
  ProxyAlert,
  SessionMode,
  Enrollment,
} from '@/lib/types';
import {
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Flag,
  X,
  Users,
  CheckCircle2,
  Check,
  Clock,
  QrCode,
  KeyRound,
  ArrowLeft,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  MapPin,
  ChevronRight,
  Loader2,
  Lock,
} from 'lucide-react';

export default function TeacherSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const resolvedParams = use(params);
  const sessionId = resolvedParams.sessionId;

  return (
    <ProtectedRoute allowedRoles={['teacher', 'admin']}>
      <LiveSessionContent sessionId={sessionId} />
    </ProtectedRoute>
  );
}

function LiveSessionContent({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const { user } = useAuth();

  // Session token/pin state from backend
  const [sessionMeta, setSessionMeta] = useState<any>(null);
  const [tokenOrPin, setTokenOrPin] = useState<string>('');
  const [mode, setMode] = useState<SessionMode>('DYNAMIC_QR');
  const [expiresIn, setExpiresIn] = useState<number>(10);
  const [maxWindow, setMaxWindow] = useState<number>(10);
  const [loadingToken, setLoadingToken] = useState<boolean>(true);

  // Active view tab: 'live_code' | 'manual_roster'
  const [activeTab, setActiveTab] = useState<'live_code' | 'manual_roster'>('live_code');

  // Real-time collections (sorted in memory to avoid Firestore composite indexes)
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [proxyAlerts, setProxyAlerts] = useState<ProxyAlert[]>([]);
  const [enrolledStudents, setEnrolledStudents] = useState<Enrollment[]>([]);
  const [loadingEnrolled, setLoadingEnrolled] = useState<boolean>(true);

  // Ending session state
  const [endingSession, setEndingSession] = useState<boolean>(false);
  const [isEnded, setIsEnded] = useState<boolean>(false);
  const [endSummary, setEndSummary] = useState<any>(null);

  // Spot-Audit state
  const [isAuditModalOpen, setIsAuditModalOpen] = useState<boolean>(false);
  const [auditStudents, setAuditStudents] = useState<AttendanceRecord[]>([]);
  const [auditedStatusMap, setAuditedStatusMap] = useState<Record<string, 'verified' | 'flagged'>>({});
  const [flaggingStudentId, setFlaggingStudentId] = useState<string | null>(null);

  // Manual marking in progress
  const [markingStudentId, setMarkingStudentId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // 1. Fetch live token / PIN from server
  const fetchToken = useCallback(async () => {
    if (!user || isEnded) return;
    try {
      const idToken = await user.getIdToken();
      const res = await fetch(`/api/sessions/${sessionId}/token`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (res.status === 410) {
        setIsEnded(true);
        return;
      }

      const data = await res.json();
      if (res.ok) {
        setSessionMeta(data.session);
        setMode(data.mode);
        const windowDuration = data.mode === 'ROTATING_PIN' ? 20 : 10;
        setMaxWindow(windowDuration);
        setExpiresIn(data.expiresInSeconds || windowDuration);
        setTokenOrPin(data.token || data.pin || '');
      }
    } catch (err) {
      console.error('Error fetching session token:', err);
    } finally {
      setLoadingToken(false);
    }
  }, [user, sessionId, isEnded]);

  // Initial token fetch
  useEffect(() => {
    fetchToken();
  }, [fetchToken]);

  // Countdown timer & rotation tick
  useEffect(() => {
    if (isEnded || mode === 'MANUAL_ROSTER') return;

    const interval = setInterval(() => {
      setExpiresIn((prev) => {
        if (prev <= 1) {
          fetchToken();
          return maxWindow;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [fetchToken, isEnded, maxWindow, mode]);

  // 2. Real-time Listener: Verified Records (sessions/{sessionId}/records)
  useEffect(() => {
    const recordsCol = collection(db, 'sessions', sessionId, 'records');
    const unsubscribe = onSnapshot(
      recordsCol,
      (snapshot) => {
        const list: AttendanceRecord[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          list.push({
            id: docSnap.id,
            sessionId,
            classId: d.classId,
            studentId: d.studentId || docSnap.id,
            studentName: d.studentName || 'Student',
            studentRollNumber: d.studentRollNumber || '',
            studentEmail: d.studentEmail || '',
            status: d.status || 'present',
            timestamp: d.timestamp?.toDate ? d.timestamp.toDate().toISOString() : d.timestamp,
            deviceHash: d.deviceHash,
            lat: d.lat,
            lng: d.lng,
            distanceMeters: d.distanceMeters,
            method: d.method || 'QR',
            markedBy: d.markedBy,
          });
        });
        // Sort in memory by timestamp desc
        list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setRecords(list);
      },
      (err) => console.error('Error in records listener:', err)
    );

    return () => unsubscribe();
  }, [sessionId]);

  // 3. Real-time Listener: Proxy Alert Feed (proxyAlerts where sessionId == sessionId)
  useEffect(() => {
    const alertsQuery = query(
      collection(db, 'proxyAlerts'),
      where('sessionId', '==', sessionId)
    );

    const unsubscribe = onSnapshot(
      alertsQuery,
      (snapshot) => {
        const list: ProxyAlert[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          list.push({
            id: docSnap.id,
            sessionId: d.sessionId,
            classId: d.classId,
            className: d.className,
            studentId: d.studentId,
            studentName: d.studentName || 'Unknown Student',
            studentRollNumber: d.studentRollNumber || '',
            reason: d.reason,
            details: d.details || {},
            timestamp: d.timestamp?.toDate ? d.timestamp.toDate().toISOString() : d.timestamp,
          });
        });
        // Sort in memory by timestamp desc
        list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setProxyAlerts(list);
      },
      (err) => console.error('Error in alerts listener:', err)
    );

    return () => unsubscribe();
  }, [sessionId]);

  // 4. Fetch Enrolled Students for Manual Roster via Server Admin SDK
  const fetchRoster = useCallback(async () => {
    if (!user) return;
    setLoadingEnrolled(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch(`/api/sessions/${sessionId}/roster`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        setEnrolledStudents(data.roster || []);
      } else {
        console.error('Failed to load roster from API:', data.error);
      }
    } catch (err) {
      console.error('Error loading enrolled students:', err);
    } finally {
      setLoadingEnrolled(false);
    }
  }, [user, sessionId]);

  useEffect(() => {
    fetchRoster();
  }, [fetchRoster]);

  // 5. Manual Mark Handler
  const handleManualMark = async (studentId: string, status: 'present' | 'late' | 'absent' | 'flagged') => {
    if (!user) return;
    setMarkingStudentId(studentId);
    setActionError(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch(`/api/sessions/${sessionId}/manual-mark`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ studentId, status }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || 'Failed to update attendance');
      }
    } catch (err: any) {
      console.error('Error in manual mark:', err);
      setActionError(err.message || 'Network error');
    } finally {
      setMarkingStudentId(null);
    }
  };

  // 6. End Session Handler
  const handleEndSession = async () => {
    if (!user || isEnded) return;
    const confirmEnd = window.confirm(
      'Are you sure you want to end this attendance session? All enrolled students who did not check in will be automatically recorded as ABSENT.'
    );
    if (!confirmEnd) return;

    setEndingSession(true);
    setActionError(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch(`/api/sessions/${sessionId}/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
      });
      const data = await res.json();
      if (res.ok) {
        setIsEnded(true);
        setEndSummary(data.summary);
        fetchRoster();
      } else {
        setActionError(data.error || 'Failed to close session');
      }
    } catch (err: any) {
      console.error('Error ending session:', err);
      setActionError(err.message || 'Network error');
    } finally {
      setEndingSession(false);
    }
  };

  // 7. Spot-Audit Handlers (Tweak 1: sample present OR late students)
  const handleOpenSpotAudit = () => {
    const eligible = records.filter((r) => r.status === 'present' || r.status === 'late');
    if (eligible.length === 0) return;
    const shuffled = [...eligible].sort(() => 0.5 - Math.random());
    setAuditStudents(shuffled.slice(0, 5));
    setAuditedStatusMap({});
    setIsAuditModalOpen(true);
  };

  const handleVerifyPresent = (studentId: string) => {
    setAuditedStatusMap((prev) => ({ ...prev, [studentId]: 'verified' }));
  };

  const handleFlagProxy = async (studentId: string) => {
    if (!user) return;
    setFlaggingStudentId(studentId);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch(`/api/sessions/${sessionId}/spot-audit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ studentId }),
      });
      if (res.ok) {
        setAuditedStatusMap((prev) => ({ ...prev, [studentId]: 'flagged' }));
      } else {
        const data = await res.json();
        setActionError(data.error || 'Failed to flag student');
      }
    } catch (err: any) {
      console.error('Error flagging proxy:', err);
      setActionError(err.message || 'Network error');
    } finally {
      setFlaggingStudentId(null);
    }
  };

  // Count metrics
  const presentCount = records.filter((r) => r.status === 'present').length;
  const lateCount = records.filter((r) => r.status === 'late').length;
  const absentCount = records.filter((r) => r.status === 'absent').length;
  const flaggedCount = records.filter((r) => r.status === 'flagged').length;
  const totalEnrolled = enrolledStudents.length;
  const checkedInTotal = presentCount + lateCount;
  const presentOrLateCount = checkedInTotal;

  const progressPercent = Math.min(100, Math.round((expiresIn / maxWindow) * 100));

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Link
            href="/teacher/dashboard"
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                {sessionMeta?.className || 'Attendance Session'}
              </h1>
              {sessionMeta?.section && (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-slate-800 text-indigo-300 border border-slate-700">
                  {sessionMeta.section}
                </span>
              )}
              {isEnded ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">
                  <span className="w-2 h-2 rounded-full bg-slate-500" />
                  Concluded
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Live Session
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Mode: <span className="text-indigo-300 font-semibold">{mode}</span>
              {sessionMeta?.geofence?.enabled && (
                <span className="ml-3 inline-flex items-center gap-1 text-emerald-400 font-medium">
                  <MapPin className="w-3 h-3" />
                  Geofenced ({sessionMeta.geofence.radiusMeters}m)
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Action Controls & Metrics */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-4 bg-slate-900/90 px-4 py-2 rounded-xl border border-slate-800 text-xs">
            <div>
              <span className="text-slate-400">Enrolled: </span>
              <span className="font-bold text-white">{totalEnrolled}</span>
            </div>
            <div className="h-4 w-px bg-slate-800" />
            <div>
              <span className="text-slate-400">Checked In: </span>
              <span className="font-bold text-emerald-400">{checkedInTotal}</span>
            </div>
            <div className="h-4 w-px bg-slate-800" />
            <div>
              <span className="text-slate-400">Alerts: </span>
              <span className="font-bold text-rose-400">{proxyAlerts.length}</span>
            </div>
          </div>

          {!isEnded && (
            <>
              <button
                type="button"
                onClick={handleOpenSpotAudit}
                disabled={presentOrLateCount === 0}
                className="px-3.5 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 font-semibold text-xs border border-indigo-500/30 transition-all hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                title={presentOrLateCount === 0 ? 'Requires at least 1 checked-in student' : 'Randomly sample up to 5 checked-in students'}
              >
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                <span>Run Spot-Audit</span>
              </button>

              <button
                onClick={handleEndSession}
                disabled={endingSession}
                className="px-4 py-2 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white font-semibold text-xs shadow-md shadow-rose-600/20 transition-all hover:scale-[1.02] disabled:opacity-50 flex items-center gap-1.5"
              >
                {endingSession ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Finalizing...</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4" />
                    <span>End Session & Auto-Absent</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Error alert banner */}
      {actionError && (
        <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between text-rose-300 text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-xs font-bold text-rose-400">
            Dismiss
          </button>
        </div>
      )}

      {/* Session Concluded Summary Card */}
      {isEnded && (
        <div className="mb-6 p-6 rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950/40 border border-indigo-500/30 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
                Session Finalized
              </div>
              <h2 className="text-xl font-bold text-white">Attendance Records Committed</h2>
              <p className="text-xs text-slate-300 mt-1">
                All missing enrolled students have been automatically logged as Absent.
              </p>
            </div>
            <div className="flex items-center gap-4 bg-slate-950/80 px-5 py-3 rounded-xl border border-slate-800 text-sm">
              <div className="text-center">
                <div className="text-lg font-bold text-emerald-400">{presentCount}</div>
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Present</div>
              </div>
              <div className="h-6 w-px bg-slate-800" />
              <div className="text-center">
                <div className="text-lg font-bold text-amber-400">{lateCount}</div>
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Late</div>
              </div>
              <div className="h-6 w-px bg-slate-800" />
              <div className="text-center">
                <div className="text-lg font-bold text-rose-400">{absentCount}</div>
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Absent</div>
              </div>
              <div className="h-6 w-px bg-slate-800" />
              <div className="text-center">
                <div className="text-lg font-bold text-purple-400">{flaggedCount}</div>
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Flagged</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Code Display (Left) + Live Feeds (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Display Engine or Manual Roster */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Tab navigation */}
          <div className="flex items-center justify-between bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('live_code')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'live_code'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {mode === 'ROTATING_PIN' ? (
                <KeyRound className="w-3.5 h-3.5" />
              ) : (
                <QrCode className="w-3.5 h-3.5" />
              )}
              <span>Projector Display ({mode === 'ROTATING_PIN' ? 'PIN' : 'QR'})</span>
            </button>
            <button
              onClick={() => setActiveTab('manual_roster')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'manual_roster'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Full Class Roster ({enrolledStudents.length})</span>
            </button>
          </div>

          {/* TAB 1: PROJECTOR DISPLAY (QR / PIN) */}
          {activeTab === 'live_code' && (
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 sm:p-8 flex flex-col items-center justify-center shadow-xl relative overflow-hidden">
              {/* Background ambient glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-40 bg-indigo-500/10 blur-[80px] pointer-events-none rounded-full" />

              {isEnded ? (
                <div className="py-16 text-center">
                  <XCircle className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-white">This Session Has Ended</h3>
                  <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
                    Check-in rotation is frozen. You can review attendance records on the right or view the manual roster tab.
                  </p>
                </div>
              ) : loadingToken ? (
                <div className="py-20 text-center text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-400" />
                  <p className="text-sm">Initializing anti-proxy token stream...</p>
                </div>
              ) : mode === 'DYNAMIC_QR' ? (
                /* DYNAMIC QR DISPLAY */
                <div className="flex flex-col items-center w-full max-w-sm">
                  {/* Countdown Progress Bar */}
                  <div className="w-full mb-6">
                    <div className="flex items-center justify-between text-xs font-semibold mb-2">
                      <span className="text-indigo-400 flex items-center gap-1.5">
                        <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                        Dynamic QR (Rotates every 10s)
                      </span>
                      <span className="font-mono text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                        {expiresIn}s
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-sky-400 transition-all duration-1000 ease-linear rounded-full"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* QR Code Canvas */}
                  <div className="p-5 rounded-2xl bg-white shadow-2xl border-4 border-indigo-500/20">
                    <QRCodeSVG
                      value={tokenOrPin}
                      size={260}
                      level="H"
                      includeMargin={false}
                    />
                  </div>

                  <p className="text-xs text-slate-400 text-center mt-6 max-w-xs leading-relaxed">
                    Have students open <span className="text-white font-mono">/student/checkin</span> and scan this QR code on their smartphone.
                  </p>
                </div>
              ) : mode === 'ROTATING_PIN' ? (
                /* ROTATING PIN DISPLAY */
                <div className="flex flex-col items-center w-full max-w-md mx-auto">
                  {/* Countdown Bar */}
                  <div className="w-full mb-6">
                    <div className="flex items-center justify-between text-xs font-semibold mb-2">
                      <span className="text-indigo-400 flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5" />
                        Rotating PIN (Rotates every 20s)
                      </span>
                      <span className="font-mono text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                        {expiresIn}s
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-sky-400 transition-all duration-1000 ease-linear rounded-full"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Responsive 6-Tile PIN Display for Class Projector */}
                  <div className="w-full py-6 sm:py-8 px-4 sm:px-6 rounded-2xl bg-slate-950 border-2 border-indigo-500/40 shadow-2xl">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-4 text-center">
                      Enter 6-Character Session PIN
                    </div>
                    <div className="grid grid-cols-6 gap-2 sm:gap-3 w-full max-w-sm sm:max-w-md mx-auto">
                      {(tokenOrPin.length === 6
                        ? tokenOrPin.split('')
                        : tokenOrPin.padEnd(6, '·').slice(0, 6).split('')
                      ).map((char, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-center aspect-square rounded-xl bg-slate-900 border border-indigo-500/30 text-white font-mono font-extrabold text-2xl sm:text-4xl lg:text-5xl shadow-md shadow-indigo-950/40 select-all"
                        >
                          <span className="text-transparent bg-clip-text bg-gradient-to-b from-white via-indigo-100 to-sky-300">
                            {char}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 text-center mt-6 max-w-sm leading-relaxed">
                    Students can select this course on <span className="text-white font-mono">/student/checkin</span> and type this 6-character PIN.
                  </p>
                </div>
              ) : (
                /* MANUAL ROSTER MODE DEFAULT */
                <div className="py-12 text-center text-slate-400">
                  <Users className="w-12 h-12 mx-auto mb-3 text-indigo-400" />
                  <h3 className="text-lg font-bold text-white">Manual Roll-Call Active</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Use the Roster tab to mark students present, late, or absent.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MANUAL ROSTER OVERRIDE */}
          {activeTab === 'manual_roster' && (
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-xl">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-400" />
                  Enrolled Students ({enrolledStudents.length})
                </h3>
                <span className="text-xs text-slate-400">Tap to toggle student status</span>
              </div>

              {loadingEnrolled ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-400" />
                  Loading course roster...
                </div>
              ) : enrolledStudents.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No students enrolled in this course yet.
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {enrolledStudents.map((student) => {
                    // Check if student already has a record in this session
                    const existingRecord = records.find((r) => r.studentId === student.studentId);
                    const currentStatus = existingRecord?.status;
                    const isMarking = markingStudentId === student.studentId;

                    return (
                      <div
                        key={student.studentId}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-colors"
                      >
                        <div>
                          <div className="font-semibold text-white text-sm">
                            {student.studentName}
                          </div>
                          <div className="text-xs text-slate-400 font-mono">
                            {student.studentRollNumber || student.studentEmail}
                          </div>
                        </div>

                        {/* Status Toggle Buttons */}
                        <div className="flex items-center gap-1.5 self-end sm:self-auto">
                          <button
                            type="button"
                            disabled={isMarking || isEnded}
                            onClick={() => handleManualMark(student.studentId, 'present')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                              currentStatus === 'present'
                                ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-emerald-300'
                            }`}
                          >
                            Present
                          </button>

                          <button
                            type="button"
                            disabled={isMarking || isEnded}
                            onClick={() => handleManualMark(student.studentId, 'late')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                              currentStatus === 'late'
                                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-amber-300'
                            }`}
                          >
                            Late
                          </button>

                          <button
                            type="button"
                            disabled={isMarking || isEnded}
                            onClick={() => handleManualMark(student.studentId, 'absent')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                              currentStatus === 'absent'
                                ? 'bg-rose-500 text-white font-bold shadow-sm'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-300'
                            }`}
                          >
                            Absent
                          </button>

                          <button
                            type="button"
                            disabled={isMarking}
                            onClick={() => handleManualMark(student.studentId, 'flagged')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                              currentStatus === 'flagged'
                                ? 'bg-purple-600 text-white font-bold shadow-sm'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-purple-300'
                            }`}
                          >
                            Flag
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column (5 cols): Live Verified Feed & Proxy Alert Feed */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* 1. REAL-TIME PROXY ALERT FEED */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-xl flex flex-col max-h-[340px]">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-bold text-white">Live Proxy Alerts</h3>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30">
                {proxyAlerts.length} Blocked
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {proxyAlerts.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs flex flex-col items-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500/40 mb-2" />
                  <span>No proxy attempts detected. All check-ins legitimate so far.</span>
                </div>
              ) : (
                proxyAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 text-xs flex flex-col gap-1 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-rose-300">{alert.studentName}</span>
                      <span className="text-[10px] text-slate-500">
                        {alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString() : ''}
                      </span>
                    </div>

                    <div className="text-rose-400 font-medium flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                      {alert.reason}
                    </div>

                    {alert.details && (
                      <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                        {alert.details.computedDistanceMeters && (
                          <span>Distance: ~{alert.details.computedDistanceMeters}m (Radius: {alert.details.allowedRadiusMeters}m)</span>
                        )}
                        {alert.details.deviceHash && (
                          <span>Device Hash: {alert.details.deviceHash.substring(0, 16)}...</span>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 2. REAL-TIME VERIFIED ATTENDEES FEED */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-xl flex-1 flex flex-col max-h-[460px]">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Verified Attendees</h3>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                {records.length} Recorded
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {records.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  Waiting for students to check in...
                </div>
              ) : (
                records.map((r) => (
                  <div
                    key={r.id}
                    className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-white">{r.studentName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {r.studentRollNumber || r.studentEmail}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          r.status === 'present'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : r.status === 'late'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            : r.status === 'flagged'
                            ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {r.status}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {r.timestamp ? new Date(r.timestamp).toLocaleTimeString() : ''}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* RANDOM SPOT-AUDIT MODAL */}
      {isAuditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 sm:p-8 shadow-2xl my-8">
            <button
              onClick={() => setIsAuditModalOpen(false)}
              className="absolute top-5 right-5 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-6">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-2">
                <ShieldCheck className="w-3.5 h-3.5" />
                Random Spot-Audit Verification
              </div>
              <h2 className="text-xl font-bold text-white">Physical Classroom Verification</h2>
              <p className="text-xs text-slate-400 mt-1">
                Sampled {auditStudents.length} student(s) currently marked present/late. Verify their physical attendance.
              </p>
            </div>

            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {auditStudents.map((st) => {
                const auditedStatus = auditedStatusMap[st.studentId];
                const isFlagging = flaggingStudentId === st.studentId;

                return (
                  <div
                    key={st.studentId}
                    className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="font-bold text-white text-sm">{st.studentName}</div>
                      <div className="text-xs font-mono text-sky-400">
                        Roll: {st.studentRollNumber || 'N/A'}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Recorded: {st.timestamp ? new Date(st.timestamp).toLocaleTimeString() : 'Recent'} ({st.method})
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {auditedStatus === 'flagged' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                          <Flag className="w-3.5 h-3.5" />
                          Flagged Proxy
                        </span>
                      ) : auditedStatus === 'verified' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          <Check className="w-3.5 h-3.5" />
                          Verified In-Person
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleVerifyPresent(st.studentId)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1 transition-colors"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Verified</span>
                          </button>

                          <button
                            type="button"
                            disabled={isFlagging}
                            onClick={() => handleFlagProxy(st.studentId)}
                            className="px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center gap-1 transition-colors disabled:opacity-50"
                          >
                            {isFlagging ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Flag className="w-3.5 h-3.5" />
                            )}
                            <span>Flag Proxy</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Flagging marks record as &apos;flagged&apos; and writes a proxy alert.
              </span>
              <button
                type="button"
                onClick={() => setIsAuditModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
