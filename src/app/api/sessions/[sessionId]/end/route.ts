import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, Timestamp } from '@/lib/firebase/admin';

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

    // 1. Fetch all enrollments for this class
    const enrollmentsSnapshot = await adminDb
      .collection('enrollments')
      .where('classId', '==', sessionData.classId)
      .get();

    // 2. Fetch existing records for this session
    const recordsSnapshot = await sessionRef.collection('records').get();
    const recordedStudentIds = new Set<string>();
    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;

    recordsSnapshot.forEach((doc) => {
      recordedStudentIds.add(doc.id);
      const data = doc.data();
      if (data.status === 'present') presentCount++;
      else if (data.status === 'late') lateCount++;
      else if (data.status === 'absent') absentCount++;
    });

    // 3. Auto-mark any enrolled student without a record as 'absent'
    const batch = adminDb.batch();
    let newlyMarkedAbsent = 0;

    enrollmentsSnapshot.forEach((enrollmentDoc) => {
      const enr = enrollmentDoc.data();
      const studentId = enr.studentId;

      if (!recordedStudentIds.has(studentId)) {
        const missingRecordRef = sessionRef.collection('records').doc(studentId);
        batch.set(missingRecordRef, {
          id: studentId,
          sessionId,
          classId: sessionData.classId,
          studentId,
          studentName: enr.studentName || 'Student',
          studentRollNumber: enr.studentRollNumber || '',
          studentEmail: enr.studentEmail || '',
          status: 'absent',
          timestamp: Timestamp.now(),
          method: 'MANUAL',
          markedBy: 'teacher',
        });
        newlyMarkedAbsent++;
        absentCount++;
      }
    });

    // 4. Update session status
    batch.update(sessionRef, {
      status: 'ended',
      endedAt: Timestamp.now(),
      presentCount,
      lateCount,
      absentCount,
    });

    await batch.commit();

    return NextResponse.json({
      success: true,
      message: `Session concluded. Auto-marked ${newlyMarkedAbsent} missing students as absent.`,
      summary: {
        presentCount,
        lateCount,
        absentCount,
        totalEnrolled: enrollmentsSnapshot.size,
      },
    });
  } catch (error: any) {
    console.error('Error ending session:', error);
    return NextResponse.json({ error: error?.message || 'Failed to close session' }, { status: 500 });
  }
}
