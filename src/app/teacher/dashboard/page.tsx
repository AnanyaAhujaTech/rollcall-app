'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { RoleBadge } from '@/components/ui/RoleBadge';
import { ClassRoom, SessionMode } from '@/lib/types';
import {
  BookOpen,
  Plus,
  Users,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  QrCode,
  Sparkles,
  X,
  MapPin,
  Clock,
  Radio,
  KeyRound,
  ShieldAlert,
  Loader2,
  ArrowRight,
  BarChart3,
} from 'lucide-react';

export default function TeacherDashboardPage() {
  return (
    <ProtectedRoute allowedRoles={['teacher', 'admin']}>
      <TeacherDashboardContent />
    </ProtectedRoute>
  );
}

function TeacherDashboardContent() {
  const router = useRouter();
  const { user, profile } = useAuth();

  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Create Class Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [className, setClassName] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [section, setSection] = useState('');
  const [description, setDescription] = useState('');

  // Start Session Modal State
  const [sessionTargetClass, setSessionTargetClass] = useState<ClassRoom | null>(null);
  const [sessionMode, setSessionMode] = useState<SessionMode>('DYNAMIC_QR');
  const [durationMinutes, setDurationMinutes] = useState<number>(15);
  const [lateAfterMinutes, setLateAfterMinutes] = useState<number>(5);
  const [geofenceEnabled, setGeofenceEnabled] = useState<boolean>(false);
  const [geofenceRadius, setGeofenceRadius] = useState<number>(100);
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'requesting' | 'acquired' | 'failed'>('idle');
  const [startingSession, setStartingSession] = useState<boolean>(false);

  // Newly created class highlight
  const [newlyCreatedClass, setNewlyCreatedClass] = useState<ClassRoom | null>(null);

  const fetchClasses = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/classes/my-classes', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        setClasses(data.classes || []);
      } else {
        setErrorBanner(data.error || 'Failed to load courses');
      }
    } catch (err: any) {
      console.error('Error fetching classes:', err);
      setErrorBanner('Failed to load courses');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!className.trim()) {
      setErrorBanner('Course name is required');
      return;
    }

    setCreating(true);
    setErrorBanner(null);

    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/classes/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          name: className.trim(),
          code: courseCode.trim(),
          section: section.trim(),
          description: description.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setNewlyCreatedClass(data.class);
        setSuccessBanner(`Class created! Students can join using code: ${data.class.joinCode}`);
        setClassName('');
        setCourseCode('');
        setSection('');
        setDescription('');
        setIsModalOpen(false);
        fetchClasses();
      } else {
        setErrorBanner(data.error || 'Failed to create class');
      }
    } catch (err: any) {
      console.error('Error creating class:', err);
      setErrorBanner(err.message || 'Network error');
    } finally {
      setCreating(false);
    }
  };

  // Capture GPS coordinates for Classroom Geofence
  const handleCaptureLocation = () => {
    if (!navigator.geolocation) {
      setErrorBanner('Geolocation is not supported by this browser.');
      return;
    }

    setLocationStatus('requesting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocationCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setLocationStatus('acquired');
      },
      (err) => {
        console.error('GPS error:', err);
        setLocationStatus('failed');
        setErrorBanner('Failed to acquire location. Please grant browser GPS permissions.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !sessionTargetClass) return;

    if (geofenceEnabled && (!locationCoords || locationStatus !== 'acquired')) {
      setErrorBanner('Please capture your current classroom GPS location before enabling geofencing.');
      return;
    }

    setStartingSession(true);
    setErrorBanner(null);

    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/sessions/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          classId: sessionTargetClass.id,
          mode: sessionMode,
          durationMinutes: Number(durationMinutes) || 15,
          lateAfterMinutes: Number(lateAfterMinutes) || 0,
          geofence: {
            enabled: geofenceEnabled,
            lat: locationCoords?.lat,
            lng: locationCoords?.lng,
            radiusMeters: Number(geofenceRadius) || 100,
          },
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSessionTargetClass(null);
        router.push(`/teacher/session/${data.sessionId}`);
      } else {
        setErrorBanner(data.error || 'Failed to start session');
      }
    } catch (err: any) {
      console.error('Error starting session:', err);
      setErrorBanner(err.message || 'Network error starting session');
    } finally {
      setStartingSession(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Faculty Course Hub
            </h1>
            <RoleBadge role={profile?.role || 'teacher'} />
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Create courses, launch anti-proxy attendance sessions (Dynamic QR, Rotating PIN, or Geofenced), and view live rosters.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchClasses()}
            title="Refresh classes"
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-md shadow-indigo-600/30 transition-all hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Class</span>
          </button>
        </div>
      </div>

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

      {/* Newly Created Class Highlight Banner */}
      {newlyCreatedClass && (
        <div className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-indigo-900/40 via-indigo-950/30 to-slate-900 border border-indigo-500/40 shadow-xl shadow-indigo-950/30 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              Course Created Successfully
            </div>
            <h3 className="text-xl font-bold text-white">{newlyCreatedClass.name}</h3>
            <p className="text-sm text-slate-300 mt-1">
              Give this 6-character Join Code to your students to enroll:
            </p>
          </div>

          <div className="flex items-center gap-3 bg-slate-950/80 px-6 py-4 rounded-xl border border-indigo-500/30">
            <span className="font-mono text-3xl font-extrabold text-indigo-300 tracking-widest">
              {newlyCreatedClass.joinCode}
            </span>
            <button
              onClick={() => copyToClipboard(newlyCreatedClass.joinCode)}
              className="p-2 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 transition-colors"
              title="Copy Join Code"
            >
              {copiedCode === newlyCreatedClass.joinCode ? (
                <Check className="w-5 h-5 text-emerald-400" />
              ) : (
                <Copy className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Class List Grid */}
      {loading ? (
        <div className="p-16 text-center text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-indigo-400" />
          <p className="text-sm">Fetching enrolled classes and rosters...</p>
        </div>
      ) : classes.length === 0 ? (
        <div className="p-16 text-center rounded-2xl bg-slate-900/50 border border-slate-800">
          <BookOpen className="w-12 h-12 mx-auto mb-4 text-slate-600" />
          <h3 className="text-lg font-bold text-slate-200">No classes created yet</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto mt-1 mb-6">
            Get started by creating your first course. An unguessable 6-character join code will be generated for student self-enrollment.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create First Class</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes.map((c) => (
            <div
              key={c.id}
              className="rounded-2xl bg-slate-900 border border-slate-800 p-6 flex flex-col justify-between hover:border-indigo-500/40 transition-all shadow-lg hover:shadow-indigo-950/20"
            >
              <div>
                {/* Header info */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    {c.code && (
                      <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-indigo-400 border border-slate-700">
                        {c.code}
                      </span>
                    )}
                    {c.section && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {c.section}
                      </span>
                    )}
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Active
                  </span>
                </div>

                <h3 className="text-lg font-bold text-white mb-2 leading-snug">{c.name}</h3>
                {c.description && (
                  <p className="text-xs text-slate-400 line-clamp-2 mb-4 leading-relaxed">
                    {c.description}
                  </p>
                )}
              </div>

              {/* Bottom Card Footer */}
              <div className="pt-4 border-t border-slate-800/80 space-y-4">
                {/* Join Code Display */}
                <div className="flex items-center justify-between bg-slate-950/70 px-3.5 py-2.5 rounded-xl border border-slate-800">
                  <div className="text-xs text-slate-400">
                    Join Code:
                    <span className="ml-2 font-mono font-bold text-white text-base tracking-wider">
                      {c.joinCode}
                    </span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(c.joinCode)}
                    title="Copy Join Code"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition-colors"
                  >
                    {copiedCode === c.joinCode ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-slate-500" />
                    <span className="font-semibold text-slate-200">{c.studentCount || 0}</span> students enrolled
                  </div>
                  <span>{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : ''}</span>
                </div>

                {/* Phase 2 & 3: Actions */}
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href={`/teacher/class/${c.id}`}
                    className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700/80 text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all text-center"
                  >
                    <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Analytics</span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => {
                      setSessionTargetClass(c);
                      setLocationStatus('idle');
                      setLocationCoords(null);
                    }}
                    className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all hover:scale-[1.01]"
                  >
                    <Radio className="w-3.5 h-3.5 animate-pulse" />
                    <span>Start Session</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* START ATTENDANCE SESSION MODAL */}
      {sessionTargetClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 sm:p-8 shadow-2xl my-8">
            <button
              onClick={() => setSessionTargetClass(null)}
              className="absolute top-5 right-5 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-6">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-2">
                <Radio className="w-3.5 h-3.5" />
                Live Attendance Engine
              </div>
              <h2 className="text-xl font-bold text-white">Start Attendance Session</h2>
              <p className="text-xs text-slate-400 mt-1">
                Course: <span className="text-slate-200 font-semibold">{sessionTargetClass.name}</span>{' '}
                {sessionTargetClass.section ? `(${sessionTargetClass.section})` : ''}
              </p>
            </div>

            <form onSubmit={handleStartSession} className="space-y-5">
              {/* 1. Mode Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Attendance Verification Mode
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSessionMode('DYNAMIC_QR')}
                    className={`flex flex-col items-center text-center p-3 rounded-xl border text-xs font-semibold transition-all ${
                      sessionMode === 'DYNAMIC_QR'
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200 shadow-sm'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <QrCode className="w-5 h-5 mb-1.5 text-indigo-400" />
                    <span>Dynamic QR</span>
                    <span className="text-[10px] text-slate-500 font-normal mt-0.5">Rotates 10s</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSessionMode('ROTATING_PIN')}
                    className={`flex flex-col items-center text-center p-3 rounded-xl border text-xs font-semibold transition-all ${
                      sessionMode === 'ROTATING_PIN'
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200 shadow-sm'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <KeyRound className="w-5 h-5 mb-1.5 text-indigo-400" />
                    <span>Rotating PIN</span>
                    <span className="text-[10px] text-slate-500 font-normal mt-0.5">Rotates 20s</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSessionMode('MANUAL_ROSTER')}
                    className={`flex flex-col items-center text-center p-3 rounded-xl border text-xs font-semibold transition-all ${
                      sessionMode === 'MANUAL_ROSTER'
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200 shadow-sm'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Users className="w-5 h-5 mb-1.5 text-indigo-400" />
                    <span>Manual Roster</span>
                    <span className="text-[10px] text-slate-500 font-normal mt-0.5">Tap-to-mark</span>
                  </button>
                </div>
              </div>

              {/* 2. Timing Controls */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Total Duration (Mins)
                  </label>
                  <div className="relative">
                    <Clock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="number"
                      min={1}
                      max={180}
                      required
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full pl-10 pr-3 py-2 rounded-xl bg-slate-950/70 border border-slate-800 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Late Grace Window (Mins)
                  </label>
                  <div className="relative">
                    <Clock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="number"
                      min={0}
                      max={durationMinutes}
                      value={lateAfterMinutes}
                      onChange={(e) => setLateAfterMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full pl-10 pr-3 py-2 rounded-xl bg-slate-950/70 border border-slate-800 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    {lateAfterMinutes > 0 ? `Marked LATE after ${lateAfterMinutes}m` : 'No late grace'}
                  </span>
                </div>
              </div>

              {/* 3. Geofencing Toggle & GPS Capture */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white">Classroom GPS Geofencing</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={geofenceEnabled}
                      onChange={(e) => setGeofenceEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>

                {geofenceEnabled && (
                  <div className="pt-2 border-t border-slate-800/80 space-y-3">
                    <p className="text-xs text-slate-400">
                      Enforces that student check-in coordinates are within the classroom radius.
                    </p>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleCaptureLocation}
                        disabled={locationStatus === 'requesting'}
                        className="flex-1 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                      >
                        {locationStatus === 'requesting' ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                            <span>Locating...</span>
                          </>
                        ) : locationStatus === 'acquired' ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>GPS Location Locked</span>
                          </>
                        ) : (
                          <>
                            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Capture Classroom GPS</span>
                          </>
                        )}
                      </button>

                      <select
                        value={geofenceRadius}
                        onChange={(e) => setGeofenceRadius(Number(e.target.value))}
                        className="py-2 px-3 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                      >
                        <option value={50}>50 meters</option>
                        <option value={100}>100 meters</option>
                        <option value={200}>200 meters</option>
                      </select>
                    </div>

                    {locationCoords && (
                      <div className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1.5 rounded-lg border border-emerald-500/20">
                        Lat: {locationCoords.lat.toFixed(6)}, Lng: {locationCoords.lng.toFixed(6)} (Radius: {geofenceRadius}m)
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSessionTargetClass(null)}
                  className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={startingSession || (geofenceEnabled && locationStatus !== 'acquired')}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold text-sm shadow-md shadow-indigo-600/30 transition-all hover:scale-[1.02] disabled:opacity-50 flex items-center gap-2"
                >
                  {startingSession ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Launching Session...</span>
                    </>
                  ) : (
                    <>
                      <span>Launch Live Session</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE CLASS MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 sm:p-8 shadow-2xl">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-400" />
                Create New Academic Course
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                A unique 6-character access code will be generated for student registration.
              </p>
            </div>

            <form onSubmit={handleCreateClass} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Course Title *
                </label>
                <input
                  type="text"
                  required
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="e.g. Distributed Operating Systems"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Course Code
                  </label>
                  <input
                    type="text"
                    value={courseCode}
                    onChange={(e) => setCourseCode(e.target.value.toUpperCase())}
                    placeholder="e.g. CS401"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 transition-colors uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Section
                  </label>
                  <input
                    type="text"
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    placeholder="e.g. Section B"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Description (Optional)
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Semester, prerequisites, lecture room..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-md shadow-indigo-600/30 transition-all hover:scale-[1.02] disabled:opacity-50"
                >
                  {creating ? 'Generating Code...' : 'Create Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
