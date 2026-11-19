'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Vortex } from '@/components/ui/Vortex';
import {
  ShieldCheck,
  QrCode,
  GraduationCap,
  BookOpen,
  ArrowRight,
  Lock,
  Zap,
} from 'lucide-react';

export default function HomePage() {
  const { user, profile } = useAuth();

  const getDashboardHref = () => {
    if (!profile) return '/login';
    switch (profile.role) {
      case 'student':
        return '/student/dashboard';
      case 'teacher':
        return '/teacher/dashboard';
      case 'admin':
        return '/admin/dashboard';
      default:
        return '/login';
    }
  };

  return (
    <div className="relative flex-1 flex flex-col justify-between">
      {/* Fixed Full-Viewport Flowing Vortex Background */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <Vortex
          particleCount={450}
          baseHue={235}
          rangeHue={45}
          baseSpeed={0.05}
          rangeSpeed={0.85}
          rangeY={160}
          backgroundColor="#060918"
        />
      </div>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-16 sm:py-24 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          {user && profile && (
            <div className="mb-8 inline-flex items-center gap-3 px-4 py-2 rounded-full bg-slate-900/60 backdrop-blur-md border border-indigo-500/30 text-indigo-300 text-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Signed in as <span className="font-semibold text-white">{profile.displayName}</span> ({profile.role})
              <Link
                href={getDashboardHref()}
                className="font-medium text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 underline underline-offset-4"
              >
                Go to Dashboard <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}

          <div className="max-w-3xl">
            {/* Hero Pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/60 backdrop-blur-md border border-slate-700/60 text-indigo-300 text-xs font-semibold tracking-wide mb-6 shadow-sm">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <span>IGDTUW · Digital Classroom Attendance</span>
            </div>

            {/* Hero Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.15]">
              Fair, Fast Classroom Attendance for{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-sky-300 to-violet-400">
                IGDTUW
              </span>
            </h1>

            {/* Hero Paragraph */}
            <p className="mt-6 text-lg sm:text-xl text-slate-300 leading-relaxed max-w-2xl font-normal">
              Built for lectures, labs, and tutorials at Indira Gandhi Delhi Technical University for Women. Check in with rotating QR codes or live classroom PINs, track your 75% eligibility in real time, and keep every class roster accurate.
            </p>

            {/* Hero CTA Buttons */}
            <div className="mt-10 flex flex-wrap gap-4 items-center">
              {user && profile ? (
                <Link
                  href={getDashboardHref()}
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02]"
                >
                  Enter {profile.role.charAt(0).toUpperCase() + profile.role.slice(1)} Dashboard
                  <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <>
                  <Link
                    href="/register"
                    className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02]"
                  >
                    <span>Get Started</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-slate-900/60 backdrop-blur-md hover:bg-slate-800 text-slate-200 border border-slate-700/60 font-semibold transition-all hover:border-slate-600"
                  >
                    <span>Sign In</span>
                  </Link>
                </>
              )}
            </div>

            {/* Hero Bottom Strip */}
            <div className="mt-12 pt-8 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div className="flex items-center gap-2.5 text-sm text-slate-300">
                <QrCode className="w-4 h-4 text-sky-400 shrink-0" />
                <span>Rotating QR &amp; Live PIN Check-In</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-slate-300">
                <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>Location &amp; Device Verified</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-slate-300">
                <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Live 75% Attendance Tracker</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Role Architecture Breakdown */}
      <section className="py-16 sm:py-20 bg-slate-950/40 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Built for Everyone on Campus
            </h2>
            <p className="mt-3 text-slate-400 text-sm sm:text-base">
              Dedicated workspaces tailored for IGDTUW students, faculty members, and department coordinators.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {/* Student Card */}
            <div className="rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-700/60 p-6 sm:p-8 flex flex-col justify-between hover:border-sky-500/40 transition-all shadow-xl">
              <div>
                <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center mb-6">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Student Portal</h3>
                <p className="text-sm text-slate-400 leading-relaxed mb-6">
                  Join your semester courses with a 6-character code, mark attendance in seconds from your phone, and stay ahead of the 75% requirement.
                </p>
                <ul className="space-y-2.5 text-xs text-slate-300 mb-8">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                    Linked to your IGDTUW enrollment number
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                    Scan rotating QR codes or enter live PINs
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                    Live attendance percentage &amp; 75% recovery calculator
                  </li>
                </ul>
              </div>
              <Link
                href="/register?role=student"
                className="w-full py-2.5 px-4 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 text-center text-sm font-semibold transition-colors"
              >
                Join as Student
              </Link>
            </div>

            {/* Teacher Card */}
            <div className="rounded-2xl bg-slate-900/60 backdrop-blur-md border border-indigo-500/40 p-6 sm:p-8 flex flex-col justify-between relative shadow-xl shadow-indigo-950/20 hover:border-indigo-500/60 transition-all">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-indigo-600 text-[11px] font-bold text-white uppercase tracking-wider shadow-sm">
                Faculty Access
              </div>
              <div>
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-6">
                  <BookOpen className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Faculty Hub</h3>
                <p className="text-sm text-slate-400 leading-relaxed mb-6">
                  Take attendance in under a minute with rotating QR codes, board PINs, or manual lab rosters—backed by geofencing, spot-audits, and one-click CSV exports.
                </p>
                <ul className="space-y-2.5 text-xs text-slate-300 mb-8">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                    Verified signup with department invite codes
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                    Rotating QR, 6-digit PIN &amp; manual roster modes
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                    Live proxy alerts, spot-audits &amp; CSV exports
                  </li>
                </ul>
              </div>
              <Link
                href="/register?role=teacher"
                className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-center text-sm font-semibold transition-colors shadow-sm shadow-indigo-600/30"
              >
                Register as Faculty
              </Link>
            </div>

            {/* Admin Card */}
            <div className="rounded-2xl bg-slate-900/60 backdrop-blur-md border border-slate-700/60 p-6 sm:p-8 flex flex-col justify-between hover:border-violet-500/40 transition-all shadow-xl">
              <div>
                <div className="w-12 h-12 rounded-xl bg-violet-500/15 border border-violet-500/30 text-violet-400 flex items-center justify-center mb-6">
                  <Lock className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Administration</h3>
                <p className="text-sm text-slate-400 leading-relaxed mb-6">
                  Manage faculty onboarding across departments, oversee registered accounts, and review campus-wide attendance integrity alerts.
                </p>
                <ul className="space-y-2.5 text-xs text-slate-300 mb-8">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                    Issue and revoke single-use faculty invite codes
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                    View department user directory &amp; class rosters
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                    Monitor campus-wide proxy audit logs
                  </li>
                </ul>
              </div>
              <Link
                href="/login"
                className="w-full py-2.5 px-4 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-violet-200 border border-violet-500/40 text-center text-sm font-semibold transition-colors shadow-sm"
              >
                Admin Sign In
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-8 bg-slate-950/70 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-4">
          <p>© {new Date().getFullYear()} RollCall · Indira Gandhi Delhi Technical University for Women (IGDTUW)</p>
          <div className="flex items-center gap-6">
            <span className="text-slate-400">
              Kashmere Gate, New Delhi
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
