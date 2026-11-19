'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { RoleBadge } from '@/components/ui/RoleBadge';
import { InviteCode, UserRole } from '@/lib/types';
import {
  ShieldCheck,
  KeyRound,
  Users,
  Plus,
  Copy,
  Check,
  XCircle,
  RefreshCw,
  Search,
  AlertCircle,
  Calendar,
  Lock,
  ShieldAlert,
  MapPin,
  Smartphone,
  Filter,
} from 'lucide-react';

interface UserListItem {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  rollNumber: string | null;
  createdAt: string | null;
}

interface AdminProxyAlert {
  id: string;
  sessionId: string;
  classId: string;
  className: string;
  studentId: string;
  studentName: string;
  studentRollNumber: string;
  reason: string;
  details: any;
  timestamp: string;
}

export default function AdminDashboardPage() {
  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <AdminDashboardContent />
    </ProtectedRoute>
  );
}

function AdminDashboardContent() {
  const { user, profile } = useAuth();

  const [activeTab, setActiveTab] = useState<'inviteCodes' | 'users' | 'proxyAlerts'>('inviteCodes');
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [usersList, setUsersList] = useState<UserListItem[]>([]);
  const [alertsList, setAlertsList] = useState<AdminProxyAlert[]>([]);
  const [loadingCodes, setLoadingCodes] = useState<boolean>(true);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(false);
  const [loadingAlerts, setLoadingAlerts] = useState<boolean>(false);
  const [generatingCode, setGeneratingCode] = useState<boolean>(false);
  const [revokingCode, setRevokingCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Filter state for users
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');

  // Filter state for proxy alerts
  const [alertReasonFilter, setAlertReasonFilter] = useState<string>('all');
  const [alertSearchQuery, setAlertSearchQuery] = useState<string>('');

  // Fetch Invite Codes
  const fetchCodes = useCallback(async () => {
    if (!user) return;
    setLoadingCodes(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/admin/invite-codes', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        setInviteCodes(data.codes || []);
      } else {
        setErrorBanner(data.error || 'Failed to fetch invite codes');
      }
    } catch (err: any) {
      console.error('Error fetching invite codes:', err);
      setErrorBanner('Failed to load invite codes');
    } finally {
      setLoadingCodes(false);
    }
  }, [user]);

  // Fetch Users
  const fetchUsers = useCallback(async () => {
    if (!user) return;
    setLoadingUsers(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        setUsersList(data.users || []);
      } else {
        setErrorBanner(data.error || 'Failed to fetch user directory');
      }
    } catch (err: any) {
      console.error('Error fetching users:', err);
      setErrorBanner('Failed to load user directory');
    } finally {
      setLoadingUsers(false);
    }
  }, [user]);

  // Fetch Proxy Alerts
  const fetchProxyAlerts = useCallback(async () => {
    if (!user) return;
    setLoadingAlerts(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/admin/proxy-alerts', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        setAlertsList(data.alerts || []);
      } else {
        setErrorBanner(data.error || 'Failed to fetch proxy audit logs');
      }
    } catch (err: any) {
      console.error('Error fetching proxy alerts:', err);
      setErrorBanner('Failed to load proxy audit logs');
    } finally {
      setLoadingAlerts(false);
    }
  }, [user]);

  useEffect(() => {
    fetchCodes();
  }, [fetchCodes]);

  useEffect(() => {
    if (activeTab === 'users' && usersList.length === 0) {
      fetchUsers();
    } else if (activeTab === 'proxyAlerts' && alertsList.length === 0) {
      fetchProxyAlerts();
    }
  }, [activeTab, usersList.length, alertsList.length, fetchUsers, fetchProxyAlerts]);

  // Generate Invite Code
  const handleGenerateCode = async (targetRole: 'teacher' | 'admin' = 'teacher') => {
    if (!user) return;
    setGeneratingCode(true);
    setErrorBanner(null);
    setSuccessBanner(null);

    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/admin/invite-codes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ role: targetRole }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessBanner(`Generated new ${targetRole} invite code: ${data.code.code}`);
        fetchCodes();
      } else {
        setErrorBanner(data.error || 'Failed to generate code');
      }
    } catch (err: any) {
      console.error('Error creating invite code:', err);
      setErrorBanner(err.message || 'Network error');
    } finally {
      setGeneratingCode(false);
    }
  };

  // Revoke Invite Code
  const handleRevokeCode = async (code: string) => {
    if (!user) return;
    setRevokingCode(code);
    setErrorBanner(null);

    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/admin/invite-codes', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ code, action: 'revoke' }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessBanner(`Invite code ${code} revoked.`);
        fetchCodes();
      } else {
        setErrorBanner(data.error || 'Failed to revoke code');
      }
    } catch (err: any) {
      console.error('Error revoking invite code:', err);
      setErrorBanner(err.message || 'Network error');
    } finally {
      setRevokingCode(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const filteredUsers = usersList.filter((u) => {
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesSearch =
      u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.rollNumber && u.rollNumber.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesRole && matchesSearch;
  });

  const filteredAlerts = alertsList.filter((a) => {
    const matchesReason = alertReasonFilter === 'all' || a.reason === alertReasonFilter;
    const matchesSearch =
      a.studentName.toLowerCase().includes(alertSearchQuery.toLowerCase()) ||
      (a.studentRollNumber && a.studentRollNumber.toLowerCase().includes(alertSearchQuery.toLowerCase())) ||
      (a.className && a.className.toLowerCase().includes(alertSearchQuery.toLowerCase())) ||
      a.reason.toLowerCase().includes(alertSearchQuery.toLowerCase());
    return matchesReason && matchesSearch;
  });

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Administration Center
            </h1>
            <RoleBadge role="admin" />
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Control teacher invite credentials, audit identity records, and oversee attendance permissions.
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('inviteCodes')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'inviteCodes'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Invite Codes</span>
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'users'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>User Directory</span>
          </button>
          <button
            onClick={() => setActiveTab('proxyAlerts')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'proxyAlerts'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Proxy Audit Log</span>
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

      {/* TAB 1: INVITE CODES */}
      {activeTab === 'inviteCodes' && (
        <div className="space-y-6">
          {/* Action Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 p-5 rounded-2xl border border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-indigo-400" />
                Faculty Registration Codes
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Faculty cannot self-register without an active invite code generated here.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => fetchCodes()}
                title="Refresh Codes"
                disabled={loadingCodes}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loadingCodes ? 'animate-spin' : ''}`} />
              </button>

              <button
                onClick={() => handleGenerateCode('teacher')}
                disabled={generatingCode}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md shadow-indigo-600/30 transition-all hover:scale-[1.02] disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>{generatingCode ? 'Generating...' : 'Generate Faculty Code'}</span>
              </button>
            </div>
          </div>

          {/* Invite Codes Table */}
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            {loadingCodes ? (
              <div className="p-12 text-center text-slate-400 text-sm">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-indigo-400" />
                Loading invite codes...
              </div>
            ) : inviteCodes.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm">
                <KeyRound className="w-10 h-10 mx-auto mb-3 text-slate-600" />
                <p className="font-semibold text-slate-300">No invite codes generated yet.</p>
                <p className="text-xs text-slate-500 mt-1">
                  Click &ldquo;Generate Faculty Code&rdquo; above to issue the first code for teachers.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-950/60 text-xs uppercase text-slate-400 font-semibold tracking-wider border-b border-slate-800">
                    <tr>
                      <th scope="col" className="px-6 py-4">Invite Code</th>
                      <th scope="col" className="px-6 py-4">Target Role</th>
                      <th scope="col" className="px-6 py-4">Status</th>
                      <th scope="col" className="px-6 py-4">Redeemed By</th>
                      <th scope="col" className="px-6 py-4">Created At</th>
                      <th scope="col" className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {inviteCodes.map((c) => {
                      const isUsed = c.status === 'used';
                      const isRevoked = c.status === 'revoked';
                      const isActive = c.status === 'active';

                      return (
                        <tr key={c.code} className="hover:bg-slate-800/40 transition-colors">
                          <td className="px-6 py-4 font-mono font-bold text-white text-base tracking-wider flex items-center gap-2">
                            <span>{c.code}</span>
                            {isActive && (
                              <button
                                onClick={() => copyToClipboard(c.code)}
                                title="Copy code"
                                className="p-1 rounded text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition-colors"
                              >
                                {copiedCode === c.code ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className="capitalize text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                              {c.role}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {isActive && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                Active
                              </span>
                            )}
                            {isUsed && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                                Redeemed
                              </span>
                            )}
                            {isRevoked && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                                Revoked
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-400">
                            {c.usedByName ? (
                              <div>
                                <span className="font-semibold text-slate-200">{c.usedByName}</span>
                                {c.usedAt && (
                                  <p className="text-[10px] text-slate-500 mt-0.5">
                                    {new Date(c.usedAt).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-400">
                            {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {isActive && (
                              <button
                                onClick={() => handleRevokeCode(c.code)}
                                disabled={revokingCode === c.code}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-2.5 py-1.5 rounded-lg border border-rose-500/30 transition-colors disabled:opacity-50"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>{revokingCode === c.code ? 'Revoking...' : 'Revoke'}</span>
                              </button>
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
        </div>
      )}

      {/* TAB 2: USER DIRECTORY */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 p-5 rounded-2xl border border-slate-800">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, email, or roll number..."
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950/70 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <div className="flex items-center gap-3">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as any)}
                className="px-3.5 py-2 rounded-xl bg-slate-950/70 border border-slate-800 text-sm text-slate-300 focus:outline-none focus:border-indigo-500 transition-colors"
              >
                <option value="all">All Roles</option>
                <option value="student">Students</option>
                <option value="teacher">Faculty</option>
                <option value="admin">Admins</option>
              </select>

              <button
                onClick={() => fetchUsers()}
                title="Refresh directory"
                disabled={loadingUsers}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loadingUsers ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            {loadingUsers ? (
              <div className="p-12 text-center text-slate-400 text-sm">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-indigo-400" />
                Loading user directory...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm">
                <Users className="w-10 h-10 mx-auto mb-3 text-slate-600" />
                <p className="font-semibold text-slate-300">No users match your criteria.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-950/60 text-xs uppercase text-slate-400 font-semibold tracking-wider border-b border-slate-800">
                    <tr>
                      <th scope="col" className="px-6 py-4">User</th>
                      <th scope="col" className="px-6 py-4">Role</th>
                      <th scope="col" className="px-6 py-4">Roll Number</th>
                      <th scope="col" className="px-6 py-4">Registered Date</th>
                      <th scope="col" className="px-6 py-4">UID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredUsers.map((u) => (
                      <tr key={u.uid} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-white">{u.displayName}</div>
                          <div className="text-xs text-slate-400">{u.email}</div>
                        </td>
                        <td className="px-6 py-4">
                          <RoleBadge role={u.role} size="sm" />
                        </td>
                        <td className="px-6 py-4 font-mono text-xs">
                          {u.rollNumber ? (
                            <span className="font-semibold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                              {u.rollNumber}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-400">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-6 py-4 text-[11px] font-mono text-slate-500">
                          {u.uid.slice(0, 10)}...
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: PROXY AUDIT LOG */}
      {activeTab === 'proxyAlerts' && (
        <div className="space-y-6">
          {/* Header & Filter Controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
                Global Proxy Violation Audit Trail
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Institution-wide real-time ledger of flagged checks, GPS geofence breaches, and device collisions.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter student or class..."
                  value={alertSearchQuery}
                  onChange={(e) => setAlertSearchQuery(e.target.value)}
                  className="pl-9 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 w-44 sm:w-56"
                />
              </div>

              {/* Reason Filter */}
              <div className="flex items-center gap-1.5 bg-slate-900 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs">
                <Filter className="w-3.5 h-3.5 text-slate-500" />
                <select
                  value={alertReasonFilter}
                  onChange={(e) => setAlertReasonFilter(e.target.value)}
                  className="bg-transparent text-slate-200 focus:outline-none text-xs"
                >
                  <option value="all" className="bg-slate-900">All Reasons</option>
                  <option value="Outside classroom radius" className="bg-slate-900">GPS Outside Radius</option>
                  <option value="Expired or forwarded code" className="bg-slate-900">Expired / Forwarded Code</option>
                  <option value="Duplicate device multi-account attempt" className="bg-slate-900">Duplicate Device</option>
                  <option value="Spot-Audit Failed" className="bg-slate-900">Spot-Audit Failed</option>
                  <option value="Session inactive or expired" className="bg-slate-900">Session Inactive</option>
                </select>
              </div>

              <button
                onClick={fetchProxyAlerts}
                disabled={loadingAlerts}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800 transition-colors"
                title="Refresh audit logs"
              >
                <RefreshCw className={`w-4 h-4 ${loadingAlerts ? 'animate-spin text-rose-400' : ''}`} />
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-xl font-bold font-mono text-white">{alertsList.length}</div>
              <div className="text-[11px] text-slate-400 uppercase font-semibold">Total Incidents</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-xl font-bold font-mono text-amber-400">
                {alertsList.filter((a) => a.reason === 'Outside classroom radius').length}
              </div>
              <div className="text-[11px] text-slate-400 uppercase font-semibold">Geofence Breaches</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-xl font-bold font-mono text-rose-400">
                {alertsList.filter((a) => a.reason === 'Duplicate device multi-account attempt').length}
              </div>
              <div className="text-[11px] text-slate-400 uppercase font-semibold">Device Collisions</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-xl font-bold font-mono text-indigo-400">
                {alertsList.filter((a) => a.reason === 'Spot-Audit Failed').length}
              </div>
              <div className="text-[11px] text-slate-400 uppercase font-semibold">Audit Overrides</div>
            </div>
          </div>

          {/* Audit Log Table */}
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            {loadingAlerts ? (
              <div className="p-12 text-center text-slate-400 text-sm">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-rose-400" />
                Querying global proxy violation logs...
              </div>
            ) : filteredAlerts.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm">
                <ShieldCheck className="w-10 h-10 mx-auto mb-3 text-emerald-500" />
                <p className="font-semibold text-slate-300">No proxy violations recorded.</p>
                <p className="text-xs text-slate-500 mt-1">All attendance check-ins are verified and clean.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/70 text-[11px] uppercase text-slate-400 font-semibold tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="px-5 py-3.5">Timestamp</th>
                      <th className="px-5 py-3.5">Student</th>
                      <th className="px-5 py-3.5">Course / Class</th>
                      <th className="px-5 py-3.5">Violation Reason</th>
                      <th className="px-5 py-3.5">Forensic Telemetry</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans">
                    {filteredAlerts.map((a) => {
                      const dateStr = a.timestamp
                        ? new Date(a.timestamp).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })
                        : 'Recent';

                      return (
                        <tr key={a.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="px-5 py-4 font-mono text-slate-400 whitespace-nowrap">
                            {dateStr}
                          </td>
                          <td className="px-5 py-4">
                            <div className="font-bold text-white text-sm">{a.studentName}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {a.studentRollNumber ? (
                                <span className="font-mono text-[10px] font-semibold text-sky-400 bg-sky-500/10 px-1.5 py-0.2 rounded border border-sky-500/20">
                                  {a.studentRollNumber}
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-500">ID: {a.studentId.slice(0, 8)}...</span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <div className="font-semibold text-slate-200">{a.className}</div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              Session: {a.sessionId.slice(0, 10)}...
                            </div>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            {a.reason === 'Outside classroom radius' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold text-[11px]">
                                <MapPin className="w-3 h-3" />
                                Geofence Breach
                              </span>
                            ) : a.reason === 'Duplicate device multi-account attempt' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold text-[11px]">
                                <Smartphone className="w-3 h-3" />
                                Duplicate Device
                              </span>
                            ) : a.reason === 'Spot-Audit Failed' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold text-[11px]">
                                <ShieldAlert className="w-3 h-3" />
                                Spot-Audit Failed
                              </span>
                            ) : a.reason === 'Expired or forwarded code' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 font-bold text-[11px]">
                                <KeyRound className="w-3 h-3" />
                                Forwarded / Expired
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-semibold text-[11px]">
                                {a.reason}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-slate-400 text-[11px]">
                            {a.details?.distance !== undefined ? (
                              <div className="flex items-center gap-1 font-mono text-amber-300">
                                <span>Distance: {Math.round(a.details.distance)}m</span>
                                <span className="text-slate-500">(Radius: {a.details.radius || 100}m)</span>
                              </div>
                            ) : a.details?.deviceHash ? (
                              <div className="font-mono text-rose-300">
                                Hash: {a.details.deviceHash.slice(0, 16)}...
                              </div>
                            ) : a.details?.action ? (
                              <div className="text-slate-300">
                                Instructor action: <span className="font-semibold text-rose-400">{a.details.action}</span>
                              </div>
                            ) : (
                              <div className="text-slate-500 font-mono">
                                {JSON.stringify(a.details || {}).slice(0, 50)}
                              </div>
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
        </div>
      )}
    </div>
  );
}
