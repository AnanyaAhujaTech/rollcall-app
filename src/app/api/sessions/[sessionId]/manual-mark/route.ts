import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, Timestamp } from '@/lib/firebase/admin';
import { AttendanceStatus } from '@/lib/types';

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
    const { studentId, status } = body as {
      studentId?: string;
      status?: AttendanceStatus;
    };

    const validStatuses: AttendanceStatus[] = ['present', 'late', 'absent', 'flagged'];
    if (!studentId || !status || !validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Valid studentId and status (present/late/absent/flagged) required' }, { status: 400 });
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

    // Fetch student info
    const studentDoc = await adminDb.collection('users').doc(studentId).get();
    const studentData = studentDoc.data();

    const recordRef = sessionRef.collection('records').doc(studentId);
    const oldRecord = await recordRef.get();
    const oldStatus: AttendanceStatus | null = oldRecord.exists ? oldRecord.data()?.status : null;

    const recordPayload = {
      id: studentId,
      sessionId,
      classId: sessionData.classId,
      studentId,
      studentName: studentData?.displayName || 'Student',
      studentRollNumber: studentData?.rollNumber || '',
      studentEmail: studentData?.email || '',
      status,
      timestamp: Timestamp.now(),
      method: 'MANUAL' as const,
      markedBy: 'teacher' as const,
      ...(status === 'flagged' ? { flaggedReason: 'Teacher Manual Flag' } : {}),
    };

    await recordRef.set(recordPayload, { merge: true });

    // Update counts safely if status changed
    if (oldStatus !== status) {
      const updates: Record<string, any> = {};

      const currentPresent = sessionData.presentCount || 0;
      const currentLate = sessionData.lateCount || 0;
      const currentAbsent = sessionData.absentCount || 0;
      const currentFlagged = sessionData.flaggedCount ?? 0;

      if (oldStatus === 'present') updates.presentCount = Math.max(0, currentPresent - 1);
      else if (oldStatus === 'late') updates.lateCount = Math.max(0, currentLate - 1);
      else if (oldStatus === 'absent') updates.absentCount = Math.max(0, currentAbsent - 1);
      else if (oldStatus === 'flagged') updates.flaggedCount = Math.max(0, currentFlagged - 1);

      if (status === 'present') updates.presentCount = (updates.presentCount ?? currentPresent) + 1;
      else if (status === 'late') updates.lateCount = (updates.lateCount ?? currentLate) + 1;
      else if (status === 'absent') updates.absentCount = (updates.absentCount ?? currentAbsent) + 1;
      else if (status === 'flagged') updates.flaggedCount = (updates.flaggedCount ?? currentFlagged) + 1;

      await sessionRef.update(updates);
    }

    // If teacher flags a student, log to proxyAlerts
    if (status === 'flagged' && oldStatus !== 'flagged') {
      const alertRef = adminDb.collection('proxyAlerts').doc();
      await alertRef.set({
        id: alertRef.id,
        sessionId,
        classId: sessionData.classId,
        className: sessionData.className || 'Class',
        studentId,
        studentName: studentData?.displayName || 'Student',
        studentRollNumber: studentData?.rollNumber || '',
        reason: 'Spot-Audit Failed',
        details: { overrideBy: uid, previousStatus: oldStatus },
        timestamp: Timestamp.now(),
      });
    }

    return NextResponse.json({
      success: true,
      message: `Student marked as ${status.toUpperCase()}`,
      record: recordPayload,
    });
  } catch (error: any) {
    console.error('Error manual marking:', error);
    return NextResponse.json({ error: error?.message || 'Failed to update record' }, { status: 500 });
  }
}
