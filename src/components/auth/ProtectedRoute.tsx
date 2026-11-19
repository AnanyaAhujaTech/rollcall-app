'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { UserRole } from '@/lib/types';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    // 1. Not authenticated at all -> Redirect to login
    if (!user) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }

    // 2. Authenticated but no profile record yet -> Redirect to complete registration
    if (!profile) {
      if (pathname !== '/register') {
        router.replace('/register?needProfile=true');
      }
      return;
    }

    // 3. User has a profile but attempts to visit an unauthorized role route
    if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(profile.role)) {
      if (profile.role === 'student') {
        router.replace('/student/dashboard');
      } else if (profile.role === 'teacher') {
        router.replace('/teacher/dashboard');
      } else if (profile.role === 'admin') {
        router.replace('/admin/dashboard');
      }
    }
  }, [user, profile, loading, allowedRoles, router, pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-slate-100">
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin"></div>
            <Loader2 className="w-6 h-6 text-indigo-400 absolute inset-0 m-auto animate-pulse" />
          </div>
          <p className="text-sm font-medium text-slate-400 tracking-wide">
            Verifying academic credentials...
          </p>
        </div>
      </div>
    );
  }

  // Not authenticated or pending role redirect
  if (!user || !profile) {
    return null;
  }

  // Role mismatch
  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return null;
  }

  return <>{children}</>;
}
