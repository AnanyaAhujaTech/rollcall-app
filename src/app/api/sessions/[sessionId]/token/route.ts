import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { generateSessionToken, generateSessionPin } from '@/lib/utils/antiProxy';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1].trim();
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    const { sessionId } = await context.params;
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const sessionDoc = await adminDb.collection('sessions').doc(sessionId).get();
    if (!sessionDoc.exists) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const sessionData = sessionDoc.data();

    // Verify ownership
    const userDoc = await adminDb.collection('users').doc(uid).get();
    const userRole = userDoc.data()?.role;

    if (userRole !== 'admin' && sessionData?.teacherId !== uid) {
      return NextResponse.json({ error: 'Forbidden: You do not own this session' }, { status: 403 });
    }

    if (sessionData?.status !== 'active') {
      return NextResponse.json(
        { error: 'Session has ended', status: sessionData?.status },
        { status: 410 }
      );
    }

    // Check expiry
    const expiresAtMs = sessionData.expiresAt?.toDate
      ? sessionData.expiresAt.toDate().getTime()
      : new Date(sessionData.expiresAt).getTime();

    if (Date.now() > expiresAtMs) {
      // Mark session as ended if expired
      await adminDb.collection('sessions').doc(sessionId).update({ status: 'ended' });
      return NextResponse.json(
        { error: 'Session duration expired', status: 'ended' },
        { status: 410 }
      );
    }

    const mode = sessionData.mode || 'DYNAMIC_QR';

    if (mode === 'DYNAMIC_QR') {
      const { token, windowIndex, expiresInSeconds } = generateSessionToken(sessionId, 10);
      return NextResponse.json({
        mode: 'DYNAMIC_QR',
        token,
        windowIndex,
        expiresInSeconds,
        session: {
          id: sessionId,
          className: sessionData.className,
          section: sessionData.section,
          status: sessionData.status,
          presentCount: sessionData.presentCount || 0,
          lateCount: sessionData.lateCount || 0,
          absentCount: sessionData.absentCount || 0,
          geofence: sessionData.geofence,
          expiresAt: new Date(expiresAtMs).toISOString(),
        },
      });
    }

    if (mode === 'ROTATING_PIN') {
      const { pin, windowIndex, expiresInSeconds } = generateSessionPin(sessionId, 20);
      return NextResponse.json({
        mode: 'ROTATING_PIN',
        pin,
        windowIndex,
        expiresInSeconds,
        session: {
          id: sessionId,
          className: sessionData.className,
          section: sessionData.section,
          status: sessionData.status,
          presentCount: sessionData.presentCount || 0,
          lateCount: sessionData.lateCount || 0,
          absentCount: sessionData.absentCount || 0,
          geofence: sessionData.geofence,
          expiresAt: new Date(expiresAtMs).toISOString(),
        },
      });
    }

    return NextResponse.json({
      mode: 'MANUAL_ROSTER',
      session: {
        id: sessionId,
        className: sessionData.className,
        section: sessionData.section,
        status: sessionData.status,
        presentCount: sessionData.presentCount || 0,
        lateCount: sessionData.lateCount || 0,
        absentCount: sessionData.absentCount || 0,
        geofence: sessionData.geofence,
        expiresAt: new Date(expiresAtMs).toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Error getting session token:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to generate session credentials' },
      { status: 500 }
    );
  }
}
