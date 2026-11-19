import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

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

    const sessionData = sessionDoc.data()!;

    // Verify caller is the teacher who created the session or an admin
    const userDoc = await adminDb.collection('users').doc(uid).get();
    const userRole = userDoc.data()?.role;

    if (userRole !== 'admin' && sessionData.teacherId !== uid) {
      return NextResponse.json({ error: 'Forbidden: You do not own this session' }, { status: 403 });
    }

    const classId = sessionData.classId;
    if (!classId) {
      return NextResponse.json({ error: 'Session has no associated classId' }, { status: 400 });
    }

    // Fetch all enrollments for this class via Admin SDK
    const enrollmentsSnapshot = await adminDb
      .collection('enrollments')
      .where('classId', '==', classId)
      .get();

    const roster = enrollmentsSnapshot.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        classId: d.classId,
        className: d.className,
        section: d.section || '',
        teacherId: d.teacherId,
        teacherName: d.teacherName,
        studentId: d.studentId,
        studentName: d.studentName || 'Student',
        studentRollNumber: d.studentRollNumber || '',
        studentEmail: d.studentEmail || '',
        joinedAt: d.joinedAt?.toDate ? d.joinedAt.toDate().toISOString() : d.joinedAt || '',
      };
    });

    // Sort in memory by rollNumber (clean fallback to name if rollNumber empty)
    roster.sort((a, b) => {
      if (a.studentRollNumber && b.studentRollNumber) {
        return a.studentRollNumber.localeCompare(b.studentRollNumber);
      }
      return (a.studentName || '').localeCompare(b.studentName || '');
    });

    return NextResponse.json({
      success: true,
      roster,
      totalEnrolled: roster.length,
      classId,
    });
  } catch (error: any) {
    console.error('Error fetching session roster:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to load session roster' },
      { status: 500 }
    );
  }
}
