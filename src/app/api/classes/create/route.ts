import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, Timestamp } from '@/lib/firebase/admin';
import { generateJoinCode } from '@/lib/utils/generateCode';

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

    // Check user role
    const userDoc = await adminDb.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    if (userData?.role !== 'teacher' && userData?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only faculty and administrators can create classes' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, code, section, description } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Class name is required' }, { status: 400 });
    }

    // Generate unique 6-character uppercase join code
    let joinCode = '';
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 15) {
      attempts++;
      joinCode = generateJoinCode(6);
      const collisionCheck = await adminDb
        .collection('classes')
        .where('joinCode', '==', joinCode)
        .where('isActive', '==', true)
        .limit(1)
        .get();

      if (collisionCheck.empty) {
        isUnique = true;
      }
    }

    if (!isUnique) {
      return NextResponse.json(
        { error: 'Could not generate unique class code. Please try again.' },
        { status: 500 }
      );
    }

    const classRef = adminDb.collection('classes').doc();
    const classData = {
      id: classRef.id,
      name: name.trim(),
      code: (code || '').trim().toUpperCase(),
      section: (section || '').trim(),
      description: (description || '').trim(),
      teacherId: uid,
      teacherName: userData?.displayName || decodedToken.name || 'Faculty',
      teacherEmail: userData?.email || decodedToken.email || '',
      joinCode: joinCode.toUpperCase(),
      studentCount: 0,
      isActive: true,
      createdAt: Timestamp.now(),
    };

    await classRef.set(classData);

    return NextResponse.json({
      success: true,
      class: {
        ...classData,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Error creating class:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create class' },
      { status: 500 }
    );
  }
}
