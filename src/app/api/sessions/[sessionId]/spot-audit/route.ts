import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, Timestamp, FieldValue } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function POST(
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
    const body = await request.json();
    const { studentId } = body as { studentId?: string };

    if (!studentId) {
      return NextResponse.json({ error: 'studentId is required' }, { status: 400 });
    }

    const sessionRef = adminDb.collection('sessions').doc(sessionId);
    const sessionDoc = await sessionRef.get();
    if (!sessionDoc.exists) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const sessionData = sessionDoc.data()!;
    const userDoc = await adminDb.collection('users').doc(uid).get();
    const userRole = userDoc.data()?.role;

    if (userRole !== 'admin' && sessionData.teacherId !== uid) {
      return NextResponse.json({ error: 'Forbidden: You do not own this session' }, { status: 403 });
    }

    // Fetch existing attendance record
    const recordRef = sessionRef.collection('records').doc(studentId);
    const recordDoc = await recordRef.get();
    if (!recordDoc.exists) {
      return NextResponse.json({ error: 'Attendance record not found for student' }, { status: 404 });
    }

    const recordData = recordDoc.data()!;
    const previousStatus = recordData.status;

    // Fetch student info
    const studentDoc = await adminDb.collection('users').doc(studentId).get();
    const studentData = studentDoc.data();
    const studentName = studentData?.displayName || recordData.studentName || 'Student';
    const studentRollNumber = studentData?.rollNumber || recordData.studentRollNumber || '';

    // 1. Update record to 'flagged'
    await recordRef.update({
      status: 'flagged',
      markedBy: 'teacher',
      flaggedReason: 'Spot-Audit Failed',
      updatedAt: Timestamp.now(),
    });

    // 2. Adjust counts on session (safely handling optional flaggedCount)
    const updatePayload: Record<string, any> = {
      flaggedCount: (sessionData.flaggedCount ?? 0) + 1,
    };
    if (previousStatus === 'present') {
      updatePayload.presentCount = Math.max(0, (sessionData.presentCount || 0) - 1);
    } else if (previousStatus === 'late') {
      updatePayload.lateCount = Math.max(0, (sessionData.lateCount || 0) - 1);
    } else if (previousStatus === 'absent') {
      updatePayload.absentCount = Math.max(0, (sessionData.absentCount || 0) - 1);
    }

    await sessionRef.update(updatePayload);

    // 3. Write 'Spot-Audit Failed' to proxyAlerts collection
    const alertRef = adminDb.collection('proxyAlerts').doc();
    await alertRef.set({
      id: alertRef.id,
      sessionId,
      classId: sessionData.classId,
      className: sessionData.className || 'Class',
      studentId,
      studentName,
      studentRollNumber,
      reason: 'Spot-Audit Failed',
      details: {
        auditType: 'random_spot_audit',
        flaggedBy: uid,
        previousStatus,
      },
      timestamp: Timestamp.now(),
    });

    return NextResponse.json({
      success: true,
      message: `${studentName} has been flagged for failing physical spot-audit.`,
      status: 'flagged',
    });
  } catch (error: any) {
    console.error('Error executing spot audit:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to execute spot audit' },
      { status: 500 }
    );
  }
}
