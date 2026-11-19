import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ classId: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1].trim();
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const studentId = decodedToken.uid;

    const { classId } = await context.params;
    if (!classId) {
      return NextResponse.json({ error: 'Class ID is required' }, { status: 400 });
    }

    // 1. Verify class exists
    const classDoc = await adminDb.collection('classes').doc(classId).get();
    if (!classDoc.exists) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }
    const classData = classDoc.data()!;

    // 2. Verify student is enrolled in this class
    const enrollmentId = `${classId}_${studentId}`;
    const enrollmentDoc = await adminDb.collection('enrollments').doc(enrollmentId).get();
    if (!enrollmentDoc.exists) {
      // Allow teacher or admin to view for testing/support if needed, otherwise forbid
      const userDoc = await adminDb.collection('users').doc(studentId).get();
      const role = userDoc.data()?.role;
      if (role !== 'admin' && classData.teacherId !== studentId) {
        return NextResponse.json(
          { error: 'Forbidden: You are not enrolled in this class' },
          { status: 403 }
        );
      }
    }

    // 3. Fetch all sessions for this class
    const sessionsSnap = await adminDb
      .collection('sessions')
      .where('classId', '==', classId)
      .get();

    // Sort in memory by createdAt descending (newest first)
    const sortedSessionDocs = sessionsSnap.docs.sort((a, b) => {
      const aTime = a.data().createdAt?.toDate ? a.data().createdAt.toDate().getTime() : new Date(a.data().createdAt || 0).getTime();
      const bTime = b.data().createdAt?.toDate ? b.data().createdAt.toDate().getTime() : new Date(b.data().createdAt || 0).getTime();
      return bTime - aTime;
    });

    let attendedCount = 0;
    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;
    let flaggedCount = 0;

    const history: any[] = [];

    for (const sDoc of sortedSessionDocs) {
      const sData = sDoc.data();
      const recordDoc = await sDoc.ref.collection('records').doc(studentId).get();

      let recordStatus = 'absent';
      let method: string | undefined = undefined;
      let verifiedAt: string | undefined = undefined;
      let distanceMeters: number | undefined = undefined;

      if (recordDoc.exists) {
        const rData = recordDoc.data()!;
        recordStatus = rData.status || 'absent';
        method = rData.method;
        verifiedAt = rData.verifiedAt?.toDate ? rData.verifiedAt.toDate().toISOString() : rData.verifiedAt;
        distanceMeters = rData.distanceMeters;
      } else {
        if (sData.status === 'active') {
          recordStatus = 'unrecorded';
        } else {
          recordStatus = 'absent';
        }
      }

      if (recordStatus === 'present') {
        presentCount++;
        attendedCount++;
      } else if (recordStatus === 'late') {
        lateCount++;
        attendedCount++;
      } else if (recordStatus === 'flagged') {
        flaggedCount++;
      } else if (recordStatus === 'absent') {
        absentCount++;
      }

      history.push({
        sessionId: sDoc.id,
        sessionName: sData.name || `Session ${sData.createdAt ? new Date(sData.createdAt?.toDate ? sData.createdAt.toDate() : sData.createdAt).toLocaleDateString() : ''}`,
        createdAt: sData.createdAt?.toDate ? sData.createdAt.toDate().toISOString() : sData.createdAt,
        mode: sData.mode,
        sessionStatus: sData.status,
        status: recordStatus,
        method,
        verifiedAt,
        distanceMeters,
      });
    }

    const totalSessions = sortedSessionDocs.length;
    let percentage = 100;
    let belowThreshold = false;
    let canMiss = 0;
    let mustAttend = 0;

    if (totalSessions > 0) {
      percentage = Math.round((attendedCount / totalSessions) * 1000) / 10;
      belowThreshold = (attendedCount / totalSessions) < 0.75;

      if (!belowThreshold) {
        canMiss = Math.max(0, Math.floor((4 * attendedCount - 3 * totalSessions) / 3));
        mustAttend = 0;
      } else {
        mustAttend = Math.max(1, Math.ceil(3 * totalSessions - 4 * attendedCount));
        canMiss = 0;
      }
    }

    return NextResponse.json({
      class: {
        id: classDoc.id,
        name: classData.name,
        code: classData.code,
        section: classData.section,
        teacherName: classData.teacherName,
        teacherEmail: classData.teacherEmail,
      },
      summary: {
        totalSessions,
        attendedCount,
        presentCount,
        lateCount,
        absentCount,
        flaggedCount,
        percentage,
        belowThreshold,
        canMiss,
        mustAttend,
      },
      history,
    });
  } catch (error: any) {
    console.error('Error fetching student history:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
