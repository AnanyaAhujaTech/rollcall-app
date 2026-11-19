import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1].trim();
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // 1. Fetch student's enrolled classIds
    const enrollmentsSnap = await adminDb
      .collection('enrollments')
      .where('studentId', '==', uid)
      .get();

    if (enrollmentsSnap.empty) {
      return NextResponse.json({ activeSessions: [] });
    }

    const enrolledClassIds = new Set<string>();
    enrollmentsSnap.forEach((doc) => {
      const data = doc.data();
      if (data.classId) enrolledClassIds.add(data.classId);
    });

    // 2. Fetch all active sessions (Single-field index only)
    const sessionsSnap = await adminDb
      .collection('sessions')
      .where('status', '==', 'active')
      .get();

    const now = Date.now();
    const activeSessions: any[] = [];

    sessionsSnap.forEach((doc) => {
      const data = doc.data();
      if (!enrolledClassIds.has(data.classId)) return;

      const expiresAtMs = data.expiresAt?.toDate
        ? data.expiresAt.toDate().getTime()
        : new Date(data.expiresAt).getTime();

      // Skip expired sessions
      if (now > expiresAtMs) return;

      activeSessions.push({
        id: doc.id,
        classId: data.classId,
        className: data.className,
        section: data.section || '',
        teacherName: data.teacherName,
        mode: data.mode,
        durationMinutes: data.durationMinutes,
        lateAfterMinutes: data.lateAfterMinutes,
        geofence: data.geofence,
        expiresAt: new Date(expiresAtMs).toISOString(),
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
      });
    });

    // Sort in memory by createdAt desc (avoid composite indexes)
    activeSessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ activeSessions });
  } catch (error: any) {
    console.error('Error fetching active sessions:', error);
    return NextResponse.json({ error: error?.message || 'Failed to fetch sessions' }, { status: 500 });
  }
}
