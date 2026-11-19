'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { RoleBadge } from '@/components/ui/RoleBadge';
import { Shield, LogOut, User, UserPlus } from 'lucide-react';

export function Navbar() {
  const { user, profile, signOutUser } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOutUser();
      router.push('/login');
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

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
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link href={user && profile ? getDashboardHref() : '/'} className="flex items-center space-x-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-lg tracking-tight text-white">RollCall</span>
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                IGDTUW
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">Indira Gandhi Delhi Technical University for Women</p>
          </div>
        </Link>

        {/* Right Nav State */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          {user && profile ? (
            <div className="flex items-center space-x-3">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-medium text-slate-200">
                  {profile.displayName}
                </span>
                <span className="text-xs text-slate-400">
                  {profile.role === 'student' && profile.rollNumber ? `Roll: ${profile.rollNumber}` : profile.email}
                </span>
              </div>

              <RoleBadge role={profile.role} size="sm" />

              <button
                onClick={handleSignOut}
                title="Sign Out"
                className="inline-flex items-center justify-center p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="sr-only">Sign out</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2 sm:space-x-3">
              <Link
                href="/login"
                className="text-sm font-medium text-slate-300 hover:text-white px-3 py-2 rounded-lg hover:bg-slate-800/60 transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center space-x-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg shadow-sm shadow-indigo-600/30 transition-all hover:scale-[1.02]"
              >
                <UserPlus className="w-4 h-4" />
                <span>Register</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
