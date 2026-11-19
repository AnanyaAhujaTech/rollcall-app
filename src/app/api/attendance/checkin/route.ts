import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, Timestamp, FieldValue } from '@/lib/firebase/admin';
import {
  verifySessionToken,
  verifySessionPin,
  calculateHaversineDistance,
} from '@/lib/utils/antiProxy';
import { ProxyAlertReason } from '@/lib/types';

export const dynamic = 'force-dynamic';

async function logProxyAlert(params: {
  sessionId: string;
  classId: string;
  className: string;
  studentId: string;
  studentName: string;
  studentRollNumber: string;
  reason: ProxyAlertReason;
  details?: Record<string, any>;
}) {
  try {
    const alertRef = adminDb.collection('proxyAlerts').doc();
    await alertRef.set({
      id: alertRef.id,
      sessionId: params.sessionId,
      classId: params.classId,
      className: params.className,
      studentId: params.studentId,
      studentName: params.studentName,
      studentRollNumber: params.studentRollNumber,
      reason: params.reason,
      details: params.details || {},
      timestamp: Timestamp.now(),
    });
  } catch (err) {
    console.error('Failed to log proxy alert:', err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1].trim();
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const studentId = decodedToken.uid;

    const body = await request.json();
    const { sessionId, tokenOrPin, lat, lng, deviceHash } = body as {
      sessionId?: string;
      tokenOrPin?: string;
      lat?: number;
      lng?: number;
      deviceHash?: string;
    };

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    if (!tokenOrPin || typeof tokenOrPin !== 'string') {
      return NextResponse.json({ error: 'Attendance verification code or token is required' }, { status: 400 });
    }

    // 1. Fetch student profile
    const userDoc = await adminDb.collection('users').doc(studentId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'Student profile not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    const studentName = userData?.displayName || decodedToken.name || 'Student';
    const studentRollNumber = userData?.rollNumber || '';
    const studentEmail = userData?.email || decodedToken.email || '';

    // 2. Fetch session
    const sessionRef = adminDb.collection('sessions').doc(sessionId);
    const sessionDoc = await sessionRef.get();
    if (!sessionDoc.exists) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const sessionData = sessionDoc.data()!;
    const classId = sessionData.classId;
    const className = sessionData.className || 'Class';

    // 3. User Adjustment 2: Check if record already exists FIRST before running proxy checks
    const recordRef = sessionRef.collection('records').doc(studentId);
    const existingRecord = await recordRef.get();
    if (existingRecord.exists) {
      const rec = existingRecord.data();
      return NextResponse.json({
        success: true,
        alreadyCheckedIn: true,
        status: rec?.status || 'present',
        message: `You have already checked in for this session as "${rec?.status || 'present'}".`,
      });
    }

    // 4. Session status and expiration check
    if (sessionData.status !== 'active') {
      await logProxyAlert({
        sessionId,
        classId,
        className,
        studentId,
        studentName,
        studentRollNumber,
        reason: 'Session inactive or expired',
      });
      return NextResponse.json({ error: 'This attendance session has ended.' }, { status: 400 });
    }

    const expiresAtMs = sessionData.expiresAt?.toDate
      ? sessionData.expiresAt.toDate().getTime()
      : new Date(sessionData.expiresAt).getTime();

    if (Date.now() > expiresAtMs) {
      await sessionRef.update({ status: 'ended' });
      await logProxyAlert({
        sessionId,
        classId,
        className,
        studentId,
        studentName,
        studentRollNumber,
        reason: 'Session inactive or expired',
      });
      return NextResponse.json({ error: 'This attendance session has expired.' }, { status: 400 });
    }

    // 5. Roster check: Confirm enrollments/${classId}_${studentId} exists
    const enrollmentRef = adminDb.collection('enrollments').doc(`${classId}_${studentId}`);
    const enrollmentDoc = await enrollmentRef.get();
    if (!enrollmentDoc.exists) {
      await logProxyAlert({
        sessionId,
        classId,
        className,
        studentId,
        studentName,
        studentRollNumber,
        reason: 'Not enrolled in class',
        details: { classId },
      });
      return NextResponse.json(
        { error: 'You are not enrolled in this course. Please join the class first.' },
        { status: 403 }
      );
    }

    // 6. Cryptographic token / PIN validation
    const mode = sessionData.mode || 'DYNAMIC_QR';
    let isCodeValid = false;
    let codeErrorReason = 'Invalid code';

    if (mode === 'DYNAMIC_QR') {
      const result = verifySessionToken(tokenOrPin.trim(), sessionId, 10);
      isCodeValid = result.valid;
      codeErrorReason = result.reason || 'Expired QR token';
    } else if (mode === 'ROTATING_PIN') {
      const result = verifySessionPin(tokenOrPin.trim(), sessionId, 20);
      isCodeValid = result.valid;
      codeErrorReason = result.reason || 'Invalid or expired PIN';
    } else {
      return NextResponse.json(
        { error: 'This session is set to manual teacher roll-call only.' },
        { status: 400 }
      );
    }

    if (!isCodeValid) {
      await logProxyAlert({
        sessionId,
        classId,
        className,
        studentId,
        studentName,
        studentRollNumber,
        reason: 'Expired or forwarded code',
        details: { mode, codeErrorReason, tokenPreview: tokenOrPin.substring(0, 16) },
      });
      return NextResponse.json(
        {
          error:
            mode === 'DYNAMIC_QR'
              ? 'Invalid or expired QR code. Dynamic QR codes rotate every 10 seconds to prevent forwarding.'
              : 'Invalid or expired 6-character PIN. Codes rotate every 20 seconds.',
        },
        { status: 400 }
      );
    }

    // 7. Geofence verification
    let computedDistance: number | null = null;
    if (sessionData.geofence?.enabled) {
      if (typeof lat !== 'number' || typeof lng !== 'number') {
        await logProxyAlert({
          sessionId,
          classId,
          className,
          studentId,
          studentName,
          studentRollNumber,
          reason: 'Location missing when geofence active',
        });
        return NextResponse.json(
          { error: 'Classroom geofencing is active. Location permission must be granted to check in.' },
          { status: 400 }
        );
      }

      const classroomLat = sessionData.geofence.lat;
      const classroomLng = sessionData.geofence.lng;
      const allowedRadius = sessionData.geofence.radiusMeters || 100;

      computedDistance = calculateHaversineDistance(classroomLat, classroomLng, lat, lng);

      if (computedDistance > allowedRadius) {
        await logProxyAlert({
          sessionId,
          classId,
          className,
          studentId,
          studentName,
          studentRollNumber,
          reason: 'Outside classroom radius',
          details: {
            computedDistanceMeters: computedDistance,
            allowedRadiusMeters: allowedRadius,
            studentLat: lat,
            studentLng: lng,
          },
        });
        return NextResponse.json(
          {
            error: `Outside classroom geofence. You are ~${computedDistance}m away from the instructor (maximum allowed radius: ${allowedRadius}m).`,
          },
          { status: 403 }
        );
      }
    }

    // 8. Device Fingerprint duplicate check
    const cleanDeviceHash = (deviceHash || '').trim();
    if (cleanDeviceHash) {
      const usedHashes = sessionData.usedDeviceHashes || [];
      if (usedHashes.includes(cleanDeviceHash)) {
        await logProxyAlert({
          sessionId,
          classId,
          className,
          studentId,
          studentName,
          studentRollNumber,
          reason: 'Duplicate device multi-account attempt',
          details: { deviceHash: cleanDeviceHash },
        });
        return NextResponse.json(
          {
            error:
              'Proxy Detected: This device has already been used to mark attendance for another student in this session.',
          },
          { status: 403 }
        );
      }
    }

    // 9. Determine Present vs Late status
    const startTimeMs = sessionData.startTime?.toDate
      ? sessionData.startTime.toDate().getTime()
      : new Date(sessionData.startTime).getTime();

    const elapsedMinutes = (Date.now() - startTimeMs) / (60 * 1000);
    const lateGrace = sessionData.lateAfterMinutes || 0;
    const attendanceStatus = lateGrace > 0 && elapsedMinutes > lateGrace ? 'late' : 'present';

    // 10. Atomic transaction to commit record & device hash
    await adminDb.runTransaction(async (transaction) => {
      const checkRecordAgain = await transaction.get(recordRef);
      if (checkRecordAgain.exists) {
        return; // Idempotent check
      }

      const recordData = {
        id: studentId,
        sessionId,
        classId,
        studentId,
        studentName,
        studentRollNumber,
        studentEmail,
        status: attendanceStatus,
        timestamp: Timestamp.now(),
        deviceHash: cleanDeviceHash || null,
        lat: typeof lat === 'number' ? lat : null,
        lng: typeof lng === 'number' ? lng : null,
        distanceMeters: computedDistance,
        method: mode === 'DYNAMIC_QR' ? 'QR' : 'PIN',
        markedBy: 'student',
      };

      transaction.set(recordRef, recordData);

      const updatePayload: Record<string, any> = {
        [attendanceStatus === 'late' ? 'lateCount' : 'presentCount']: FieldValue.increment(1),
      };

      if (cleanDeviceHash) {
        updatePayload.usedDeviceHashes = FieldValue.arrayUnion(cleanDeviceHash);
      }

      transaction.update(sessionRef, updatePayload);
    });

    return NextResponse.json({
      success: true,
      status: attendanceStatus,
      message:
        attendanceStatus === 'late'
          ? 'Marked as LATE (checked in after grace window).'
          : 'Attendance marked successfully: PRESENT!',
      record: {
        status: attendanceStatus,
        className,
        studentName,
        studentRollNumber,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Error during check-in:', error);
    return NextResponse.json(
      { error: error?.message || 'Attendance verification failed' },
      { status: 500 }
    );
  }
}
