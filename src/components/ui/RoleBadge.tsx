import React from 'react';
import { UserRole } from '@/lib/types';
import { GraduationCap, BookOpen, ShieldCheck } from 'lucide-react';

interface RoleBadgeProps {
  role: UserRole;
  size?: 'sm' | 'md';
}

export function RoleBadge({ role, size = 'md' }: RoleBadgeProps) {
  const isSmall = size === 'sm';
  const sizeClasses = isSmall ? 'text-xs px-2.5 py-0.5' : 'text-xs md:text-sm px-3 py-1';
  const iconSize = isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5';

  switch (role) {
    case 'admin':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 ${sizeClasses}`}
        >
          <ShieldCheck className={iconSize} />
          Admin
        </span>
      );
    case 'teacher':
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 ${sizeClasses}`}
        >
          <BookOpen className={iconSize} />
          Faculty
        </span>
      );
    case 'student':
    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/30 ${sizeClasses}`}
        >
          <GraduationCap className={iconSize} />
          Student
        </span>
      );
  }
}
