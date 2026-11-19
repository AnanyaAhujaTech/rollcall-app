import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing token' },
        { status: 401 }
      );
    }

    const idToken = authHeader.split('Bearer ')[1].trim();
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    const userDoc = await adminDb.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    const role = userData?.role;

    if (role === 'teacher') {
      const snapshot = await adminDb
        .collection('classes')
        .where('teacherId', '==', uid)
        .orderBy('createdAt', 'desc')
        .get();

      const classes = snapshot.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          name: d.name,
          code: d.code,
          section: d.section,
          description: d.description,
          teacherId: d.teacherId,
          teacherName: d.teacherName,
          joinCode: d.joinCode,
          studentCount: d.studentCount || 0,
          isActive: d.isActive ?? true,
          createdAt: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : d.createdAt,
        };
      });

      return NextResponse.json({ classes });
    }

    if (role === 'student') {
      const snapshot = await adminDb
        .collection('enrollments')
        .where('studentId', '==', uid)
        .orderBy('joinedAt', 'desc')
        .get();

      const enrollments = snapshot.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          classId: d.classId,
          className: d.className,
          section: d.section,
          teacherName: d.teacherName,
          joinedAt: d.joinedAt?.toDate ? d.joinedAt.toDate().toISOString() : d.joinedAt,
        };
      });

      return NextResponse.json({ enrollments });
    }

    if (role === 'admin') {
      const snapshot = await adminDb
        .collection('classes')
        .orderBy('createdAt', 'desc')
        .get();

      const classes = snapshot.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          name: d.name,
          code: d.code,
          section: d.section,
          teacherName: d.teacherName,
          joinCode: d.joinCode,
          studentCount: d.studentCount || 0,
          isActive: d.isActive ?? true,
          createdAt: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : d.createdAt,
        };
      });

      return NextResponse.json({ classes });
    }

    return NextResponse.json({ error: 'Unsupported role' }, { status: 400 });
  } catch (error: any) {
    console.error('Error fetching classes:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch classes' },
      { status: 500 }
    );
  }
}
