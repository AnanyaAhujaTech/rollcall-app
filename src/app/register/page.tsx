'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { UserRole } from '@/lib/types';
import {
  Shield,
  GraduationCap,
  BookOpen,
  User,
  Mail,
  Lock,
  KeyRound,
  Hash,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading: authLoading, signUpWithEmail, signInWithGoogle, refreshProfile } = useAuth();

  const initialRoleParam = searchParams.get('role');
  const [selectedRole, setSelectedRole] = useState<UserRole>(
    initialRoleParam === 'teacher' ? 'teacher' : 'student'
  );

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // If user is already authenticated and has a complete profile, redirect
  useEffect(() => {
    if (!authLoading && user && profile) {
      router.replace(`/${profile.role}/dashboard`);
    }
  }, [user, profile, authLoading, router]);

  // If user signed in via Google but needs to complete their profile
  const isGoogleOnboarding = Boolean(user && !profile && !authLoading);

  useEffect(() => {
    if (user && !profile) {
      if (user.displayName && !displayName) {
        setDisplayName(user.displayName);
      }
      if (user.email && !email) {
        setEmail(user.email);
      }
    }
  }, [user, profile, displayName, email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validation
    if (!displayName.trim()) {
      setErrorMessage('Full name is required.');
      return;
    }

    if (selectedRole === 'student' && !rollNumber.trim()) {
      setErrorMessage('Roll number is mandatory for students.');
      return;
    }

    if (selectedRole === 'teacher' && !inviteCode.trim()) {
      setErrorMessage('A valid teacher invite code issued by an administrator is required.');
      return;
    }

    if (!isGoogleOnboarding) {
      if (!email.trim() || !password) {
        setErrorMessage('Email and password are required.');
        return;
      }

      if (password.length < 6) {
        setErrorMessage('Password must be at least 6 characters long.');
        return;
      }

      if (password !== confirmPassword) {
        setErrorMessage('Passwords do not match.');
        return;
      }
    }

    setSubmitting(true);

    try {
      let activeUser = user;

      // 1. If not already signed in via Google, create email/password account
      if (!activeUser) {
        const cred = await signUpWithEmail(email.trim(), password);
        activeUser = cred.user;
      }

      // 2. Fetch fresh Firebase ID Token
      const idToken = await activeUser.getIdToken(true);

      // 3. Register role securely on server
      const response = await fetch('/api/auth/register-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          role: selectedRole,
          displayName: displayName.trim(),
          rollNumber: selectedRole === 'student' ? rollNumber.trim() : undefined,
          inviteCode: selectedRole === 'teacher' ? inviteCode.trim() : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to complete registration');
      }

      // 4. Refresh local profile state and redirect
      await refreshProfile();
      router.replace(`/${selectedRole}/dashboard`);
    } catch (err: any) {
      console.error('Registration error:', err);
      let msg = err.message || 'Registration failed. Please try again.';
      if (err.code === 'auth/email-already-in-use') {
        msg = 'An account with this email address already exists. Please sign in instead.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password is too weak. Please use at least 6 characters.';
      }
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setErrorMessage(null);
    setSubmitting(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setErrorMessage(err.message || 'Failed to sign in with Google');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 items-center justify-center mb-4 shadow-lg shadow-indigo-600/10">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            {isGoogleOnboarding ? 'Complete Your Academic Profile' : 'Create Your Account'}
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            {isGoogleOnboarding
              ? 'Select your role and provide academic credentials to proceed'
              : 'Join the IGDTUW attendance portal with verified credentials'}
          </p>
        </div>

        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 sm:p-8 shadow-xl shadow-slate-950/40">
          {errorMessage && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {isGoogleOnboarding && (
            <div className="mb-6 p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center gap-3 text-indigo-300 text-sm">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-indigo-400" />
              <div>
                Signed in as <span className="font-semibold text-white">{user?.email}</span>. Complete your profile below.
              </div>
            </div>
          )}

          {/* Role Selector Tabs */}
          <div className="mb-6">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Select Academic Role
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedRole('student')}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-sm font-semibold transition-all ${
                  selectedRole === 'student'
                    ? 'bg-sky-500/15 border-sky-500/50 text-sky-300 shadow-sm'
                    : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <GraduationCap className="w-4 h-4" />
                <span>Student</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedRole('teacher')}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-sm font-semibold transition-all ${
                  selectedRole === 'teacher'
                    ? 'bg-indigo-500/15 border-indigo-500/50 text-indigo-300 shadow-sm'
                    : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>Faculty / Teacher</span>
              </button>
            </div>
          </div>

          {/* Google Sign-up (Only if not already logged into Google) */}
          {!isGoogleOnboarding && (
            <>
              <button
                type="button"
                onClick={handleGoogleSignUp}
                disabled={submitting || authLoading}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700/80 text-white font-medium border border-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-6 shadow-sm"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Sign up with Google</span>
              </button>

              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-800" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-slate-900 px-3 text-slate-500 font-semibold tracking-wider">
                    Or register with email
                  </span>
                </div>
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Alex Johnson"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>
            </div>

            {/* Student-specific: Roll Number */}
            {selectedRole === 'student' && (
              <div>
                <label className="block text-xs font-semibold text-sky-400 uppercase tracking-wider mb-2">
                  University Roll Number
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-sky-500">
                    <Hash className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={rollNumber}
                    onChange={(e) => setRollNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. 21BCS1089"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 uppercase tracking-wider transition-colors"
                  />
                </div>
                <p className="mt-1.5 text-xs text-slate-500">
                  Required for official roster verification and attendance records.
                </p>
              </div>
            )}

            {/* Teacher-specific: Invite Code */}
            {selectedRole === 'teacher' && (
              <div>
                <label className="block text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-2">
                  Faculty Invite Code
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-indigo-500">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="e.g. TCH-9F82A1"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 uppercase font-mono tracking-wider transition-colors"
                  />
                </div>
                <p className="mt-1.5 text-xs text-slate-500">
                  Issued by department administration. Single-use only.
                </p>
              </div>
            )}

            {/* Email Address (disabled/read-only if Google onboarding) */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  disabled={isGoogleOnboarding}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@university.edu"
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors ${
                    isGoogleOnboarding ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                />
              </div>
            </div>

            {/* Password (Only if not Google onboarding) */}
            {!isGoogleOnboarding && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                    />
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={submitting || authLoading}
              className={`w-full py-3 px-4 mt-6 rounded-xl text-white font-semibold text-sm shadow-lg flex items-center justify-center gap-2 transition-all hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed ${
                selectedRole === 'student'
                  ? 'bg-sky-600 hover:bg-sky-500 shadow-sky-600/30'
                  : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30'
              }`}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing Registration...</span>
                </>
              ) : (
                <>
                  <span>
                    {isGoogleOnboarding
                      ? 'Confirm & Launch Dashboard'
                      : `Complete Registration as ${selectedRole === 'student' ? 'Student' : 'Faculty'}`}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-slate-400">
          Already registered?{' '}
          <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-semibold underline underline-offset-4">
            Sign in here
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center p-8 bg-slate-950 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
