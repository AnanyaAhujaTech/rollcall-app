import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, Timestamp } from '@/lib/firebase/admin';
import { SessionMode } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1].trim();
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // Check user profile
    const userDoc = await adminDb.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    if (userData?.role !== 'teacher' && userData?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Only faculty and admins can create attendance sessions' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { classId, mode, durationMinutes, lateAfterMinutes, geofence } = body as {
      classId?: string;
      mode?: SessionMode;
      durationMinutes?: number;
      lateAfterMinutes?: number;
      geofence?: {
        enabled?: boolean;
        lat?: number;
        lng?: number;
        radiusMeters?: number;
      };
    };

    if (!classId) {
      return NextResponse.json({ error: 'Class ID is required' }, { status: 400 });
    }

    const validModes: SessionMode[] = ['DYNAMIC_QR', 'ROTATING_PIN', 'MANUAL_ROSTER'];
    const sessionMode: SessionMode = validModes.includes(mode as SessionMode)
      ? (mode as SessionMode)
      : 'DYNAMIC_QR';

    const classDoc = await adminDb.collection('classes').doc(classId).get();
    if (!classDoc.exists) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }

    const classData = classDoc.data();
    if (userData.role !== 'admin' && classData?.teacherId !== uid) {
      return NextResponse.json(
        { error: 'Forbidden: You do not own this class' },
        { status: 403 }
      );
    }

    const duration = Math.max(1, Math.min(180, Number(durationMinutes) || 15));
    const lateGrace = Math.max(0, Number(lateAfterMinutes) || 0);

    const now = Date.now();
    const startTime = Timestamp.fromMillis(now);
    const expiresAt = Timestamp.fromMillis(now + duration * 60 * 1000);

    const isGeofenceEnabled = Boolean(geofence?.enabled && geofence?.lat && geofence?.lng);

    const sessionRef = adminDb.collection('sessions').doc();
    const sessionPayload = {
      id: sessionRef.id,
      classId,
      className: classData?.name || 'Class Session',
      section: classData?.section || '',
      teacherId: uid,
      teacherName: userData?.displayName || decodedToken.name || 'Faculty',
      mode: sessionMode,
      status: 'active' as const,
      durationMinutes: duration,
      lateAfterMinutes: lateGrace,
      geofence: {
        enabled: isGeofenceEnabled,
        lat: isGeofenceEnabled ? Number(geofence?.lat) : null,
        lng: isGeofenceEnabled ? Number(geofence?.lng) : null,
        radiusMeters: isGeofenceEnabled ? Number(geofence?.radiusMeters) || 100 : null,
      },
      usedDeviceHashes: [],
      presentCount: 0,
      lateCount: 0,
      absentCount: 0,
      startTime,
      expiresAt,
      createdAt: Timestamp.now(),
    };

    await sessionRef.set(sessionPayload);

    return NextResponse.json({
      success: true,
      sessionId: sessionRef.id,
      session: {
        ...sessionPayload,
        startTime: startTime.toDate().toISOString(),
        expiresAt: expiresAt.toDate().toISOString(),
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Error creating session:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create attendance session' },
      { status: 500 }
    );
  }
}
