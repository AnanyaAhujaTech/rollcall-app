'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import {
  Users,
  Calendar,
  AlertTriangle,
  Download,
  Search,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Clock,
  Sparkles,
  RefreshCw,
  Loader2,
  Check,
  CheckCircle2,
  XCircle,
  Flag,
} from 'lucide-react';

export default function TeacherClassAnalyticsPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const resolvedParams = use(params);
  const classId = resolvedParams.classId;

  return (
    <ProtectedRoute allowedRoles={['teacher', 'admin']}>
      <ClassAnalyticsContent classId={classId} />
    </ProtectedRoute>
  );
}

function ClassAnalyticsContent({ classId }: { classId: string }) {
  const { user } = useAuth();

  const [loading, setLoading] = useState<boolean>(true);
  const [classInfo, setClassInfo] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionRecordsMap, setSessionRecordsMap] = useState<Record<string, Record<string, any>>>({});

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterBelow75, setFilterBelow75] = useState<boolean>(false);

  // Past session accordion state
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [overridingRecord, setOverridingRecord] = useState<{ sessionId: string; studentId: string } | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch(`/api/teacher/classes/${classId}/analytics`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        setClassInfo(data.class);
        setSummary(data.summary);
        setStudents(data.students || []);
        setSessions(data.sessions || []);
        setSessionRecordsMap(data.sessionRecordsMap || {});
      } else {
        console.error('Failed to load analytics:', data.error);
      }
    } catch (err) {
      console.error('Network error loading analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [user, classId]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Handle Session Override
  const handleOverride = async (sessionId: string, studentId: string, status: string) => {
    if (!user) return;
    setOverridingRecord({ sessionId, studentId });
    setActionMessage(null);
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
      if (res.ok) {
        setActionMessage('Record updated.');
        // Refresh analytics data
        await fetchAnalytics();
      }
    } catch (err) {
      console.error('Override error:', err);
    } finally {
      setOverridingRecord(null);
    }
  };

  // CSV Export Handler
  const handleExportCSV = () => {
    if (students.length === 0) return;

    // Header row
    const headers = [
      'Student Name',
      'Roll Number',
      'Email',
      ...sessions.map((s) => `"${new Date(s.createdAt).toLocaleDateString()} (${s.mode})"`),
      'Attended Sessions',
      'Total Sessions',
      'Percentage (%)',
      'Attendance Shortage (<75%)',
    ];

    const rows = students.map((st) => {
      const sessionCols = sessions.map((s) => {
        const status = st.sessionStatuses?.[s.id] || 'absent';
        return `"${status.toUpperCase()}"`;
      });

      return [
        `"${st.studentName}"`,
        `"${st.studentRollNumber}"`,
        `"${st.studentEmail}"`,
        ...sessionCols,
        st.attendedCount,
        st.totalSessions,
        `${st.percentage}%`,
        st.belowThreshold ? 'YES' : 'NO',
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeTitle = (classInfo?.name || 'Class').replace(/[^a-zA-Z0-9_-]/g, '_');
    link.href = url;
    link.download = `${safeTitle}_attendance_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter students
  const filteredStudents = students.filter((st) => {
    const matchesSearch =
      st.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (st.studentRollNumber && st.studentRollNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
      st.studentEmail.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesThreshold = filterBelow75 ? st.belowThreshold : true;
    return matchesSearch && matchesThreshold;
  });

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Navigation */}
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/teacher/dashboard"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </Link>
        <button
          onClick={handleExportCSV}
          disabled={students.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all hover:scale-[1.02] disabled:opacity-40"
        >
          <Download className="w-4 h-4 text-indigo-400" />
          <span>Export Attendance CSV</span>
        </button>
      </div>

      {/* Class Title Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {classInfo?.name || 'Course Analytics'}
          </h1>
          {classInfo?.code && (
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-slate-800 text-indigo-300 border border-slate-700 font-mono">
              {classInfo.code}
            </span>
          )}
          {classInfo?.section && (
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300">
              {classInfo.section}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Complete semester attendance audit, roster stats, past-session record overrides, and official exports.
        </p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Total Sessions */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-2">
            <span>Total Sessions</span>
            <Calendar className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white">
            {summary?.totalSessions ?? 0}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Recorded to date</span>
        </div>

        {/* Class Average % */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-2">
            <span>Class Average</span>
            <Users className="w-4 h-4 text-sky-400" />
          </div>
          <div
            className={`text-2xl sm:text-3xl font-extrabold ${
              (summary?.classAverage ?? 100) >= 75 ? 'text-emerald-400' : 'text-amber-400'
            }`}
          >
            {summary?.classAverage ?? 100}%
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Across all students</span>
        </div>

        {/* Students Below 75% */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-2">
            <span>Shortage (&lt;75%)</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-rose-400">
            {summary?.studentsBelow75 ?? 0}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">At risk of debarment</span>
        </div>

        {/* Total Proxy Alerts */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-2">
            <span>Proxy Alerts</span>
            <ShieldAlert className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-amber-400">
            {summary?.totalProxyAlerts ?? 0}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Blocked attempts</span>
        </div>
      </div>

      {/* Main Grid: Student Roster Table (Top) & Past Sessions (Bottom) */}
      <div className="space-y-8">
        {/* SECTION 1: STUDENT-BY-STUDENT ROSTER ATTENDANCE TABLE */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
          {/* Table Toolbar */}
          <div className="p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950/40">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-400" />
                Student Roster Attendance ({students.length})
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Search input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter student..."
                  className="pl-9 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Threshold toggle button */}
              <button
                type="button"
                onClick={() => setFilterBelow75(!filterBelow75)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  filterBelow75
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                }`}
              >
                {filterBelow75 ? 'Showing &lt;75% Only' : 'Show All Students'}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400 text-sm">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3 text-indigo-400" />
              Loading student analytics...
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs">
              No students match your filter criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/70 uppercase text-[11px] text-slate-400 font-semibold tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-3.5">Roll No</th>
                    <th className="px-6 py-3.5">Student Name</th>
                    <th className="px-6 py-3.5 text-center">Attended / Total</th>
                    <th className="px-6 py-3.5">Attendance %</th>
                    <th className="px-6 py-3.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredStudents.map((st) => (
                    <tr key={st.studentId} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-sky-400">
                        {st.studentRollNumber || '—'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-white text-sm">{st.studentName}</div>
                        <div className="text-[11px] text-slate-500">{st.studentEmail}</div>
                      </td>
                      <td className="px-6 py-4 text-center font-mono">
                        <span className="font-bold text-white">{st.attendedCount}</span>
                        <span className="text-slate-500"> / {st.totalSessions}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span
                            className={`font-bold font-mono text-sm ${
                              st.percentage >= 75 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {st.percentage}%
                          </span>
                          <div className="w-24 h-2 rounded-full bg-slate-800 overflow-hidden hidden sm:block">
                            <div
                              className={`h-full rounded-full ${
                                st.percentage >= 75 ? 'bg-emerald-500' : 'bg-rose-500'
                              }`}
                              style={{ width: `${st.percentage}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {st.belowThreshold ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                            <AlertTriangle className="w-3 h-3" />
                            &lt; 75% Shortage
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            <Check className="w-3 h-3" />
                            Eligible
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* SECTION 2: PAST SESSIONS & ATTENDANCE OVERRIDES */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                Past Sessions & Record Overrides ({sessions.length})
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Click any session to expand records and manually override attendance marks.
              </p>
            </div>
            {actionMessage && (
              <span className="text-xs text-emerald-400 font-semibold">{actionMessage}</span>
            )}
          </div>

          {sessions.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No attendance sessions conducted for this class yet.
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((s) => {
                const isExpanded = expandedSessionId === s.id;
                const recordsForSession = sessionRecordsMap[s.id] || {};

                return (
                  <div
                    key={s.id}
                    className="rounded-xl bg-slate-950/60 border border-slate-800 overflow-hidden transition-all"
                  >
                    {/* Session Row Bar */}
                    <button
                      type="button"
                      onClick={() => setExpandedSessionId(isExpanded ? null : s.id)}
                      className="w-full p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left hover:bg-slate-800/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-600/15 text-indigo-400 border border-indigo-500/20 flex items-center justify-center font-bold text-xs shrink-0">
                          {s.mode === 'ROTATING_PIN' ? 'PIN' : 'QR'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">
                              {s.createdAt ? new Date(s.createdAt).toLocaleDateString() : 'Session'}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {s.createdAt ? new Date(s.createdAt).toLocaleTimeString() : ''}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                s.status === 'active'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-slate-800 text-slate-400 border border-slate-700'
                              }`}
                            >
                              {s.status.toUpperCase()}
                            </span>
                          </div>
                          <span className="text-xs text-slate-400">
                            Duration: {s.durationMinutes}m • {s.mode}
                          </span>
                        </div>
                      </div>

                      {/* Summary Tally in Row */}
                      <div className="flex items-center gap-4 text-xs font-mono self-end sm:self-auto">
                        <span className="text-emerald-400 font-bold">{s.presentCount || 0} Present</span>
                        <span className="text-amber-400 font-bold">{s.lateCount || 0} Late</span>
                        <span className="text-rose-400 font-bold">{s.absentCount || 0} Absent</span>
                        {(s.flaggedCount ?? 0) > 0 && (
                          <span className="text-purple-400 font-bold">{s.flaggedCount} Flagged</span>
                        )}
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-400 ml-2" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400 ml-2" />
                        )}
                      </div>
                    </button>

                    {/* Expanded Record Overrides Drawer */}
                    {isExpanded && (
                      <div className="p-4 bg-slate-900 border-t border-slate-800">
                        <div className="mb-3 flex items-center justify-between text-xs text-slate-400">
                          <span className="font-semibold text-slate-200">
                            Student Attendance Records for this Session
                          </span>
                          <span>Select status to override</span>
                        </div>

                        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                          {students.map((st) => {
                            const currentRec = recordsForSession[st.studentId];
                            const currentStatus = currentRec?.status || 'absent';
                            const isOverriding =
                              overridingRecord?.sessionId === s.id &&
                              overridingRecord?.studentId === st.studentId;

                            return (
                              <div
                                key={st.studentId}
                                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-slate-950/80 border border-slate-800/80 text-xs"
                              >
                                <div>
                                  <div className="font-semibold text-white">{st.studentName}</div>
                                  <div className="font-mono text-[11px] text-slate-400">
                                    Roll: {st.studentRollNumber || 'N/A'}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                                  {/* Present Button */}
                                  <button
                                    type="button"
                                    disabled={isOverriding}
                                    onClick={() => handleOverride(s.id, st.studentId, 'present')}
                                    className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                                      currentStatus === 'present'
                                        ? 'bg-emerald-500 text-slate-950 font-extrabold shadow-sm'
                                        : 'bg-slate-800 text-slate-400 hover:text-emerald-300'
                                    }`}
                                  >
                                    Present
                                  </button>

                                  {/* Late Button */}
                                  <button
                                    type="button"
                                    disabled={isOverriding}
                                    onClick={() => handleOverride(s.id, st.studentId, 'late')}
                                    className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                                      currentStatus === 'late'
                                        ? 'bg-amber-500 text-slate-950 font-extrabold shadow-sm'
                                        : 'bg-slate-800 text-slate-400 hover:text-amber-300'
                                    }`}
                                  >
                                    Late
                                  </button>

                                  {/* Absent Button */}
                                  <button
                                    type="button"
                                    disabled={isOverriding}
                                    onClick={() => handleOverride(s.id, st.studentId, 'absent')}
                                    className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                                      currentStatus === 'absent'
                                        ? 'bg-rose-500 text-white font-extrabold shadow-sm'
                                        : 'bg-slate-800 text-slate-400 hover:text-rose-300'
                                    }`}
                                  >
                                    Absent
                                  </button>

                                  {/* Flagged Button */}
                                  <button
                                    type="button"
                                    disabled={isOverriding}
                                    onClick={() => handleOverride(s.id, st.studentId, 'flagged')}
                                    className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                                      currentStatus === 'flagged'
                                        ? 'bg-purple-600 text-white font-extrabold shadow-sm'
                                        : 'bg-slate-800 text-slate-400 hover:text-purple-300'
                                    }`}
                                  >
                                    Flag
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
