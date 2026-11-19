import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, Timestamp, FieldValue } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
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

    // Check user profile and role
    const userDoc = await adminDb.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'Student profile not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    if (userData?.role !== 'student') {
      return NextResponse.json(
        { error: 'Only students can enroll in classes with a join code' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { joinCode } = body;

    if (!joinCode || typeof joinCode !== 'string' || !joinCode.trim()) {
      return NextResponse.json({ error: 'Valid 6-character class join code is required' }, { status: 400 });
    }

    const normalizedCode = joinCode.trim().toUpperCase();

    // Query for the class with this active join code
    const classSnapshot = await adminDb
      .collection('classes')
      .where('joinCode', '==', normalizedCode)
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (classSnapshot.empty) {
      return NextResponse.json(
        { error: `No active class found with code "${normalizedCode}". Please check with your instructor.` },
        { status: 404 }
      );
    }

    const classDoc = classSnapshot.docs[0];
    const classId = classDoc.id;
    const classData = classDoc.data();

    const enrollmentId = `${classId}_${uid}`;
    const enrollmentRef = adminDb.collection('enrollments').doc(enrollmentId);
    const classRef = adminDb.collection('classes').doc(classId);

    // Atomic enrollment transaction
    await adminDb.runTransaction(async (transaction) => {
      const existingEnrollment = await transaction.get(enrollmentRef);
      if (existingEnrollment.exists) {
        throw new Error(`You are already enrolled in "${classData.name}"`);
      }

      const enrollmentData = {
        id: enrollmentId,
        classId,
        className: classData.name,
        section: classData.section || '',
        teacherId: classData.teacherId,
        teacherName: classData.teacherName,
        studentId: uid,
        studentName: userData.displayName || decodedToken.name || 'Student',
        studentRollNumber: userData.rollNumber || '',
        studentEmail: userData.email || decodedToken.email || '',
        joinedAt: Timestamp.now(),
      };

      transaction.set(enrollmentRef, enrollmentData);
      transaction.update(classRef, {
        studentCount: FieldValue.increment(1),
      });
    });

    return NextResponse.json({
      success: true,
      message: `Successfully enrolled in ${classData.name}`,
      class: {
        id: classId,
        name: classData.name,
        code: classData.code,
        section: classData.section,
        teacherName: classData.teacherName,
      },
    });
  } catch (error: any) {
    console.error('Error joining class:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to enroll in class' },
      { status: 400 }
    );
  }
}
