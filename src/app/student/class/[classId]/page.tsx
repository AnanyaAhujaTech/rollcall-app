'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Calendar,
  Percent,
  ShieldCheck,
  ShieldAlert,
  Calculator,
  Radio,
  RefreshCw,
  Sparkles,
  MapPin,
  QrCode,
  KeyRound,
  BookOpen,
  User,
  Sliders,
} from 'lucide-react';

interface SessionHistoryItem {
  sessionId: string;
  sessionName: string;
  createdAt: string;
  mode: string;
  sessionStatus: 'active' | 'ended';
  status: 'present' | 'late' | 'absent' | 'flagged' | 'unrecorded';
  method?: string;
  verifiedAt?: string;
  distanceMeters?: number;
}

interface ClassData {
  id: string;
  name: string;
  code?: string;
  section?: string;
  teacherName: string;
  teacherEmail?: string;
}

interface SummaryData {
  totalSessions: number;
  attendedCount: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  flaggedCount: number;
  percentage: number;
  belowThreshold: boolean;
  canMiss: number;
  mustAttend: number;
}

export default function StudentClassHistoryPage() {
  return (
    <ProtectedRoute allowedRoles={['student', 'admin']}>
      <StudentClassHistoryContent />
    </ProtectedRoute>
  );
}

function StudentClassHistoryContent() {
  const params = useParams();
  const classId = params.classId as string;
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [classInfo, setClassInfo] = useState<ClassData | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [history, setHistory] = useState<SessionHistoryItem[]>([]);

  // What-If interactive simulator state
  const [simAttended, setSimAttended] = useState<number>(1);
  const [simMissed, setSimMissed] = useState<number>(0);

  const fetchHistory = useCallback(async () => {
    if (!user || !classId) return;
    setLoading(true);
    setErrorBanner(null);

    try {
      const idToken = await user.getIdToken();
      const res = await fetch(`/api/student/classes/${classId}/history`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      const data = await res.json();
      if (res.ok) {
        setClassInfo(data.class);
        setSummary(data.summary);
        setHistory(data.history || []);
      } else {
        setErrorBanner(data.error || 'Failed to load class attendance history');
      }
    } catch (err: any) {
      console.error('Error fetching student class history:', err);
      setErrorBanner(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }, [user, classId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Projected percentage for What-If simulator
  const projectedTotal = (summary?.totalSessions ?? 0) + simAttended + simMissed;
  const projectedAttended = (summary?.attendedCount ?? 0) + simAttended;
  const projectedPct =
    projectedTotal > 0
      ? Math.round((projectedAttended / projectedTotal) * 1000) / 10
      : 100;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <Link
              href="/student/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white mb-2 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Dashboard</span>
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                {classInfo ? classInfo.name : 'Course Attendance'}
              </h1>
              {classInfo?.code && (
                <span className="px-2.5 py-0.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-wider">
                  {classInfo.code}
                </span>
              )}
              {classInfo?.section && (
                <span className="px-2.5 py-0.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold">
                  Sec {classInfo.section}
                </span>
              )}
            </div>
            {classInfo && (
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-500" />
                <span>Instructor: <strong className="text-slate-300">{classInfo.teacherName}</strong></span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchHistory}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
              <span>Refresh</span>
            </button>
            <Link
              href="/student/checkin"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-md shadow-indigo-600/20"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Scan Attendance</span>
            </Link>
          </div>
        </div>

        {/* Error Banner */}
        {errorBanner && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
            <span>{errorBanner}</span>
          </div>
        )}

        {loading ? (
          <div className="py-24 text-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-indigo-400" />
            <p className="text-sm">Calculating attendance statistics and recovery projection...</p>
          </div>
        ) : !summary ? (
          <div className="py-20 text-center text-slate-400">
            <BookOpen className="w-12 h-12 mx-auto mb-3 text-slate-600" />
            <p className="text-sm">No course information found.</p>
          </div>
        ) : (
          <>
            {/* Top Stat & 75% Recovery Section */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Overall Attendance Meter (5 cols) */}
              <div className="lg:col-span-5 rounded-2xl bg-slate-900 border border-slate-800 p-6 flex flex-col justify-between shadow-xl">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Percent className="w-4 h-4 text-indigo-400" />
                      Attendance Metric
                    </span>
                    {summary.belowThreshold ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Shortage Warning (&lt;75%)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Good Standing (&ge;75%)
                      </span>
                    )}
                  </div>

                  {/* Percentage Display */}
                  <div className="flex items-baseline gap-3 mb-4">
                    <div
                      className={`text-5xl sm:text-6xl font-extrabold tracking-tight font-mono ${
                        summary.belowThreshold ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      {summary.percentage}%
                    </div>
                    <div className="text-xs text-slate-400 leading-tight">
                      <div>Institutional Req: <strong className="text-slate-200">75%</strong></div>
                      <div>Attended: <strong className="text-white">{summary.attendedCount}</strong> of <strong className="text-white">{summary.totalSessions}</strong></div>
                    </div>
                  </div>

                  {/* Progress Bar with 75% Marker */}
                  <div className="relative mb-6 pt-2">
                    <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden flex">
                      <div
                        className={`h-full transition-all duration-500 ${
                          summary.belowThreshold
                            ? 'bg-gradient-to-r from-rose-600 to-rose-400'
                            : 'bg-gradient-to-r from-emerald-600 to-emerald-400'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, summary.percentage))}%` }}
                      />
                    </div>
                    {/* Visual 75% Marker Line */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-indigo-400 z-10"
                      style={{ left: '75%' }}
                      title="75% Institutional Threshold"
                    />
                    <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1 font-mono">
                      <span>0%</span>
                      <span className="text-indigo-400 font-bold">75% Target</span>
                      <span>100%</span>
                    </div>
                  </div>

                  {/* Stat Breakdown Grid */}
                  <div className="grid grid-cols-4 gap-2 pt-4 border-t border-slate-800 text-center">
                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                      <div className="text-emerald-400 font-bold text-lg font-mono">{summary.presentCount}</div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Present</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                      <div className="text-amber-400 font-bold text-lg font-mono">{summary.lateCount}</div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Late</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                      <div className="text-slate-400 font-bold text-lg font-mono">{summary.absentCount}</div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Absent</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                      <div className="text-rose-400 font-bold text-lg font-mono">{summary.flaggedCount}</div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Flagged</div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-800/60 text-[11px] text-slate-500 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span>Late arrivals count toward attended percentage per university rules.</span>
                </div>
              </div>

              {/* Right Column: 75% Recovery / Safe Margin Calculator (7 cols) */}
              <div className="lg:col-span-7 rounded-2xl bg-slate-900 border border-slate-800 p-6 flex flex-col justify-between shadow-xl">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Calculator className="w-4 h-4 text-indigo-400" />
                      75% Compliance Calculator
                    </span>
                    <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                      Exam Eligibility Engine
                    </span>
                  </div>

                  {summary.totalSessions === 0 ? (
                    <div className="p-6 rounded-xl bg-slate-950/60 border border-slate-800 text-center my-4">
                      <Sparkles className="w-8 h-8 mx-auto mb-2 text-indigo-400" />
                      <h4 className="text-sm font-bold text-white mb-1">No sessions recorded yet</h4>
                      <p className="text-xs text-slate-400">
                        Once your instructor starts conducting dynamic attendance sessions, your compliance and safe buffer will calculate automatically.
                      </p>
                    </div>
                  ) : !summary.belowThreshold ? (
                    <div className="p-5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 space-y-3 my-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                        <h4 className="text-base font-bold text-emerald-300">
                          {summary.canMiss > 0 ? (
                            <>
                              Safe Buffer: You can safely miss{' '}
                              <span className="text-xl font-mono underline decoration-emerald-400 font-extrabold text-white">
                                {summary.canMiss}
                              </span>{' '}
                              more class{summary.canMiss > 1 ? 'es' : ''}
                            </>
                          ) : (
                            'Zero Buffer: You are exactly at threshold'
                          )}
                        </h4>
                      </div>
                      <p className="text-xs text-emerald-200/90 leading-relaxed">
                        {summary.canMiss > 0 ? (
                          <>
                            Even if you miss the next <strong>{summary.canMiss}</strong> upcoming lecture
                            {summary.canMiss > 1 ? 's' : ''}, your overall verified attendance will stay at or above the
                            institutional <strong>75.0%</strong> examination eligibility threshold.
                          </>
                        ) : (
                          <>
                            Your current attendance is right at or barely above 75%. If you miss the upcoming lecture,
                            your attendance will drop below 75% and trigger an examination shortage warning.
                          </>
                        )}
                      </p>
                    </div>
                  ) : (
                    <div className="p-5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 space-y-3 my-2">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
                        <h4 className="text-base font-bold text-rose-300">
                          Recovery Plan: Attend next{' '}
                          <span className="text-xl font-mono underline decoration-rose-400 font-extrabold text-white">
                            {summary.mustAttend}
                          </span>{' '}
                          consecutive class{summary.mustAttend > 1 ? 'es' : ''}
                        </h4>
                      </div>
                      <p className="text-xs text-rose-200/90 leading-relaxed">
                        To recover from your current <strong>{summary.percentage}%</strong> standing and regain final
                        exam eligibility, you must maintain 100% attendance across the next <strong>{summary.mustAttend}</strong> class
                        {summary.mustAttend > 1 ? 'es' : ''} without missing any.
                      </p>
                    </div>
                  )}

                  {/* Interactive "What-If" Simulator */}
                  <div className="mt-5 p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                        Interactive &quot;What-If&quot; Attendance Simulator
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-400">
                        Projected: <span className={projectedPct >= 75 ? 'text-emerald-400' : 'text-rose-400'}>{projectedPct}%</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <label className="block text-slate-400 mb-1">Future Classes Attended (+):</label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSimAttended(Math.max(0, simAttended - 1))}
                            className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold"
                          >
                            -
                          </button>
                          <span className="w-10 text-center font-mono font-bold text-white text-sm">
                            {simAttended}
                          </span>
                          <button
                            type="button"
                            onClick={() => setSimAttended(simAttended + 1)}
                            className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1">Future Classes Missed (-):</label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSimMissed(Math.max(0, simMissed - 1))}
                            className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold"
                          >
                            -
                          </button>
                          <span className="w-10 text-center font-mono font-bold text-white text-sm">
                            {simMissed}
                          </span>
                          <button
                            type="button"
                            onClick={() => setSimMissed(simMissed + 1)}
                            className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/60 text-[11px] text-slate-500">
                  Calculated using exact integer arithmetic per university examination regulations.
                </div>
              </div>
            </div>

            {/* Attendance History Timeline / Table */}
            <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
              <div className="p-5 sm:p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-indigo-400" />
                    Lecture Attendance History
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Individual record of all conducted sessions, verification methods, and anti-proxy telemetry.
                  </p>
                </div>
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-800 text-slate-300">
                  {history.length} session{history.length !== 1 ? 's' : ''} recorded
                </span>
              </div>

              {history.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <Calendar className="w-10 h-10 mx-auto mb-3 text-slate-600" />
                  <p className="text-sm">No lecture sessions have been conducted for this class yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/70 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
                      <tr>
                        <th className="py-3.5 px-4 sm:px-6">Date &amp; Time</th>
                        <th className="py-3.5 px-4">Session Name</th>
                        <th className="py-3.5 px-4">Verification Mode</th>
                        <th className="py-3.5 px-4">Attendance Status</th>
                        <th className="py-3.5 px-4 sm:px-6">Telemetry &amp; Verification Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {history.map((s) => {
                        const dateStr = s.createdAt
                          ? new Date(s.createdAt).toLocaleString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Recent';

                        return (
                          <tr key={s.sessionId} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-4 px-4 sm:px-6 font-mono text-slate-300 whitespace-nowrap">
                              {dateStr}
                            </td>
                            <td className="py-4 px-4 font-semibold text-white max-w-[200px] truncate">
                              {s.sessionName}
                            </td>
                            <td className="py-4 px-4 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 text-[11px] font-medium border border-slate-700/60">
                                {s.mode === 'DYNAMIC_QR' ? (
                                  <>
                                    <QrCode className="w-3 h-3 text-indigo-400" />
                                    Dynamic QR
                                  </>
                                ) : s.mode === 'ROTATING_PIN' ? (
                                  <>
                                    <KeyRound className="w-3 h-3 text-amber-400" />
                                    Rotating PIN
                                  </>
                                ) : (
                                  <>
                                    <Radio className="w-3 h-3 text-emerald-400" />
                                    Manual Roster
                                  </>
                                )}
                              </span>
                            </td>
                            <td className="py-4 px-4 whitespace-nowrap">
                              {s.status === 'present' && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold text-xs">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Present
                                </span>
                              )}
                              {s.status === 'late' && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 font-bold text-xs">
                                  <Clock className="w-3.5 h-3.5" />
                                  Late
                                </span>
                              )}
                              {s.status === 'absent' && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-semibold text-xs">
                                  <XCircle className="w-3.5 h-3.5" />
                                  Absent
                                </span>
                              )}
                              {s.status === 'flagged' && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30 font-bold text-xs">
                                  <ShieldAlert className="w-3.5 h-3.5" />
                                  Proxy Flagged
                                </span>
                              )}
                              {s.status === 'unrecorded' && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 font-bold text-xs animate-pulse">
                                  <Radio className="w-3.5 h-3.5" />
                                  In Progress
                                </span>
                              )}
                            </td>
                            <td className="py-4 px-4 sm:px-6 text-slate-400">
                              {s.status === 'present' || s.status === 'late' ? (
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2 text-slate-300">
                                    <span className="font-semibold">{s.method || 'Verified'}</span>
                                    {s.distanceMeters !== undefined && (
                                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                        <MapPin className="w-3 h-3" />
                                        {Math.round(s.distanceMeters)}m from instructor
                                      </span>
                                    )}
                                  </div>
                                  {s.verifiedAt && (
                                    <div className="text-[10px] text-slate-500">
                                      Checked in at {new Date(s.verifiedAt).toLocaleTimeString()}
                                    </div>
                                  )}
                                </div>
                              ) : s.status === 'flagged' ? (
                                <span className="text-rose-400 font-semibold text-[11px]">
                                  Spot-Audit Check Failed or Proxy Detected
                                </span>
                              ) : s.status === 'unrecorded' ? (
                                <Link
                                  href={`/student/checkin?sessionId=${s.sessionId}`}
                                  className="text-indigo-400 hover:text-indigo-300 font-semibold underline text-xs"
                                >
                                  Check in now &rarr;
                                </Link>
                              ) : (
                                <span className="text-slate-500 italic text-[11px]">No check-in recorded</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
