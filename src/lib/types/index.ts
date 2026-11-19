export type UserRole = 'student' | 'teacher' | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  rollNumber?: string;
  createdAt: string | number;
  updatedAt: string | number;
}

export type InviteCodeStatus = 'active' | 'used' | 'revoked';

export interface InviteCode {
  code: string;
  role: 'teacher' | 'admin';
  status: InviteCodeStatus;
  createdBy: string;
  createdByName?: string;
  usedBy?: string;
  usedByName?: string;
  createdAt: string | number;
  usedAt?: string | number;
  expiresAt?: string | number;
}

export interface ClassRoom {
  id: string;
  name: string;
  code?: string;
  section?: string;
  description?: string;
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  joinCode: string; // 6-character unique uppercase code
  studentCount: number;
  isActive: boolean;
  createdAt: string | number;
}

export interface Enrollment {
  id: string; // `${classId}_${studentId}`
  classId: string;
  className: string;
  section?: string;
  teacherId: string;
  teacherName: string;
  studentId: string;
  studentName: string;
  studentRollNumber: string;
  studentEmail: string;
  joinedAt: string | number;
}

// ============================================================================
// Phase 2 & 3: Anti-Proxy Attendance Session Types
// ============================================================================

export type SessionMode = 'DYNAMIC_QR' | 'ROTATING_PIN' | 'MANUAL_ROSTER';
export type SessionStatus = 'active' | 'ended';

export interface GeofenceConfig {
  enabled: boolean;
  lat?: number;
  lng?: number;
  radiusMeters?: number; // e.g. 50, 100, 200
}

export interface AttendanceSession {
  id: string;
  classId: string;
  className: string;
  section?: string;
  teacherId: string;
  teacherName: string;
  mode: SessionMode;
  status: SessionStatus;
  durationMinutes: number;
  lateAfterMinutes?: number;
  geofence: GeofenceConfig;
  usedDeviceHashes: string[];
  presentCount: number;
  lateCount: number;
  absentCount: number;
  flaggedCount?: number; // Optional per Phase 3 tweak 2
  startTime: string | number;
  expiresAt: string | number;
  createdAt: string | number;
  endedAt?: string | number;
}

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'flagged';
export type CheckInMethod = 'QR' | 'PIN' | 'MANUAL';

export interface AttendanceRecord {
  id: string; // studentId
  sessionId: string;
  classId: string;
  studentId: string;
  studentName: string;
  studentRollNumber: string;
  studentEmail: string;
  status: AttendanceStatus;
  timestamp: string | number;
  deviceHash?: string;
  lat?: number;
  lng?: number;
  distanceMeters?: number;
  method: CheckInMethod;
  markedBy?: 'student' | 'teacher';
  flaggedReason?: string;
}

export type ProxyAlertReason =
  | 'Expired or forwarded code'
  | 'Outside classroom radius'
  | 'Duplicate device multi-account attempt'
  | 'Not enrolled in class'
  | 'Session inactive or expired'
  | 'Location missing when geofence active'
  | 'Spot-Audit Failed';

export interface ProxyAlert {
  id: string;
  sessionId: string;
  classId: string;
  className: string;
  studentId: string;
  studentName: string;
  studentRollNumber: string;
  reason: ProxyAlertReason;
  details?: Record<string, any>;
  timestamp: string | number;
}
