'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { RoleBadge } from '@/components/ui/RoleBadge';
import {
  GraduationCap,
  Plus,
  BookOpen,
  Check,
  RefreshCw,
  AlertCircle,
  QrCode,
  Sparkles,
  ArrowRight,
  Hash,
  X,
  User,
  Radio,
  MapPin,
  BarChart3,
} from 'lucide-react';

interface EnrolledClassItem {
  id: string;
  classId: string;
  className: string;
  section?: string;
  teacherName: string;
  joinedAt: string;
}

interface ActiveSessionItem {
  id: string;
  classId: string;
  className: string;
  section?: string;
  teacherName: string;
  mode: string;
  geofence?: { enabled: boolean; radiusMeters?: number };
}

export default function StudentDashboardPage() {
  return (
    <ProtectedRoute allowedRoles={['student']}>
      <StudentDashboardContent />
    </ProtectedRoute>
  );
}

function StudentDashboardContent() {
  const { user, profile } = useAuth();

  const [enrolledClasses, setEnrolledClasses] = useState<EnrolledClassItem[]>([]);
  const [activeSessions, setActiveSessions] = useState<ActiveSessionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const fetchEnrolledClasses = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const idToken = await user.getIdToken();
      // 1. Fetch enrollments
      const res = await fetch('/api/classes/my-classes', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        setEnrolledClasses(data.enrollments || []);
      } else {
        setErrorBanner(data.error || 'Failed to load enrolled classes');
      }

      // 2. Fetch active sessions
      const sessionRes = await fetch('/api/sessions/active', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const sessionData = await sessionRes.json();
      if (sessionRes.ok) {
        setActiveSessions(sessionData.activeSessions || []);
      }
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      setErrorBanner('Failed to load courses');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchEnrolledClasses();
  }, [fetchEnrolledClasses]);

  const handleJoinClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const cleanCode = joinCode.trim().toUpperCase();

    if (!cleanCode || cleanCode.length < 5) {
      setErrorBanner('Please enter a valid 6-character class join code.');
      return;
    }

    setJoining(true);
    setErrorBanner(null);

    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/classes/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ joinCode: cleanCode }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccessBanner(data.message || `Enrolled in ${data.class?.name || 'course'}!`);
        setJoinCode('');
        setIsJoinModalOpen(false);
        fetchEnrolledClasses();
      } else {
        setErrorBanner(data.error || 'Failed to enroll in class');
      }
    } catch (err: any) {
      console.error('Error joining class:', err);
      setErrorBanner(err.message || 'Network error while joining class');
    } finally {
      setJoining(false);
    }
  };

  // Helper map for active session lookup by classId
  const activeSessionMap = new Map<string, ActiveSessionItem>();
  activeSessions.forEach((s) => activeSessionMap.set(s.classId, s));

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      {/* Student Profile Card */}
      <div className="mb-6 p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-sky-950/20 border border-slate-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                {profile?.displayName || 'Student Portal'}
              </h1>
              <RoleBadge role="student" size="sm" />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-400">
              {profile?.rollNumber && (
                <span className="flex items-center gap-1 font-mono font-semibold text-sky-300">
                  <Hash className="w-3.5 h-3.5 text-sky-400" />
                  {profile.rollNumber}
                </span>
              )}
              <span>{profile?.email}</span>
            </div>
          </div>
        </div>

        {/* Dual Actions: Check In Now + Join Class */}
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/student/checkin"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 hover:from-indigo-500 hover:to-sky-400 text-white font-semibold text-sm shadow-lg shadow-indigo-600/25 transition-all hover:scale-[1.02]"
          >
            <QrCode className="w-4 h-4" />
            <span>Check In to Class</span>
          </Link>

          <button
            onClick={() => setIsJoinModalOpen(true)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Join Class</span>
          </button>
        </div>
      </div>

      {/* LIVE SESSION ATTENTION BANNER (If any enrolled class has an active session) */}
      {activeSessions.length > 0 && (
        <div className="mb-8 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-indigo-950/30 border border-emerald-500/40 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <Radio className="w-5 h-5 animate-pulse text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-extrabold text-emerald-400 tracking-wider">
                  Live Attendance Active
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  {activeSessions.length} Available
                </span>
              </div>
              <p className="text-sm text-white font-bold mt-0.5">
                {activeSessions[0].className}
                {activeSessions[0].section ? ` (${activeSessions[0].section})` : ''} — Instructor is currently recording attendance.
              </p>
            </div>
          </div>

          <Link
            href={`/student/checkin?sessionId=${activeSessions[0].id}`}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 transition-all hover:scale-[1.02] shrink-0"
          >
            <span>Check In Now</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Notifications */}
      {errorBanner && (
        <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between text-rose-300 text-sm">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
            <span>{errorBanner}</span>
          </div>
          <button onClick={() => setErrorBanner(null)} className="text-rose-400 hover:text-rose-200 text-xs font-bold">
            Dismiss
          </button>
        </div>
      )}

      {successBanner && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-emerald-300 text-sm">
          <div className="flex items-center gap-3">
            <Check className="w-5 h-5 shrink-0 text-emerald-400" />
            <span>{successBanner}</span>
          </div>
          <button onClick={() => setSuccessBanner(null)} className="text-emerald-400 hover:text-emerald-200 text-xs font-bold">
            Dismiss
          </button>
        </div>
      )}

      {/* Enrolled Courses Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-sky-400" />
            My Enrolled Courses
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Courses linked to your university roll number for anti-proxy verification.
          </p>
        </div>

        <button
          onClick={() => fetchEnrolledClasses()}
          title="Refresh courses"
          disabled={loading}
          className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Enrolled Classes List */}
      {loading ? (
        <div className="p-16 text-center text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-sky-400" />
          <p className="text-sm">Retrieving your enrolled classes...</p>
        </div>
      ) : enrolledClasses.length === 0 ? (
        <div className="p-12 sm:p-16 text-center rounded-2xl bg-slate-900/60 border border-slate-800">
          <BookOpen className="w-12 h-12 mx-auto mb-3 text-slate-600" />
          <h3 className="text-base sm:text-lg font-bold text-slate-200">You are not enrolled in any classes yet</h3>
          <p className="text-xs sm:text-sm text-slate-400 max-w-sm mx-auto mt-1 mb-6">
            Obtain the 6-character access code from your instructor and join below to begin recording attendance.
          </p>
          <button
            onClick={() => setIsJoinModalOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Enter Class Code</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {enrolledClasses.map((item) => {
            const activeSession = activeSessionMap.get(item.classId);

            return (
              <div
                key={item.id}
                className={`rounded-2xl bg-slate-900 border p-5 sm:p-6 flex flex-col justify-between transition-all shadow-md ${
                  activeSession
                    ? 'border-emerald-500/50 shadow-emerald-950/20 ring-1 ring-emerald-500/30'
                    : 'border-slate-800 hover:border-sky-500/40'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    {item.section ? (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-sky-300 border border-slate-700">
                        {item.section}
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                        General
                      </span>
                    )}

                    {activeSession ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        Session Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                        Enrolled
                      </span>
                    )}
                  </div>

                  <h3 className="text-base sm:text-lg font-bold text-white mb-2 leading-snug">
                    {item.className}
                  </h3>

                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-4">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    <span>Instructor: <span className="text-slate-200 font-medium">{item.teacherName}</span></span>
                  </div>
                </div>

                {/* Attendance Check-in & History Action Buttons */}
                <div className="pt-4 border-t border-slate-800 space-y-2.5">
                  {activeSession ? (
                    <Link
                      href={`/student/checkin?sessionId=${activeSession.id}`}
                      className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/30 transition-all hover:scale-[1.02]"
                    >
                      <Radio className="w-4 h-4 animate-pulse" />
                      <span>Check In to Active Session</span>
                    </Link>
                  ) : (
                    <Link
                      href="/student/checkin"
                      className="w-full py-2.5 px-3 rounded-xl bg-slate-800/90 hover:bg-slate-800 text-sky-300 font-semibold text-xs flex items-center justify-center gap-2 border border-slate-700 transition-colors"
                    >
                      <QrCode className="w-4 h-4 text-sky-400" />
                      <span>Open Attendance Scanner</span>
                    </Link>
                  )}

                  <Link
                    href={`/student/class/${item.classId}`}
                    className="w-full py-2 px-3 rounded-xl bg-slate-950/70 hover:bg-slate-800 text-slate-300 font-semibold text-xs flex items-center justify-center gap-1.5 border border-slate-800 hover:border-slate-700 transition-colors"
                  >
                    <BarChart3 className="w-3.5 h-3.5 text-sky-400" />
                    <span>View History &amp; 75% Calc</span>
                  </Link>

                  <p className="text-[11px] text-center text-slate-500 pt-1">
                    Enrolled on {item.joinedAt ? new Date(item.joinedAt).toLocaleDateString() : 'Active'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* JOIN CLASS MODAL */}
      {isJoinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 sm:p-8 shadow-2xl">
            <button
              onClick={() => setIsJoinModalOpen(false)}
              className="absolute top-5 right-5 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <div className="inline-flex w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 items-center justify-center mb-3">
                <BookOpen className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-white">Join a Course</h2>
              <p className="text-xs text-slate-400 mt-1">
                Enter the 6-character code provided by your course faculty.
              </p>
            </div>

            <form onSubmit={handleJoinClass} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 text-center">
                  6-Character Class Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  autoFocus
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="e.g. XK94P2"
                  className="w-full text-center font-mono text-2xl font-extrabold tracking-widest py-3 px-4 rounded-xl bg-slate-950/80 border border-slate-800 text-sky-400 placeholder-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 uppercase transition-colors"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 flex items-start gap-2.5">
                <Hash className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <span>
                  Attendance will be tied to your verified roll number:{' '}
                  <span className="font-mono text-sky-300 font-semibold">
                    {profile?.rollNumber || 'Not specified'}
                  </span>
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsJoinModalOpen(false)}
                  className="w-1/2 py-2.5 px-4 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={joining || joinCode.trim().length < 5}
                  className="w-1/2 py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-sm shadow-md shadow-sky-600/30 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {joining ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Joining...</span>
                    </>
                  ) : (
                    <>
                      <span>Enroll</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
