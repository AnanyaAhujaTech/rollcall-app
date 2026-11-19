import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, Timestamp } from '@/lib/firebase/admin';

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
    const email = decodedToken.email || '';

    // Check if any admin exists in users collection
    const adminSnapshot = await adminDb
      .collection('users')
      .where('role', '==', 'admin')
      .limit(1)
      .get();

    if (!adminSnapshot.empty) {
      return NextResponse.json(
        { error: 'System already has an initialized Administrator. Please request an invite code.' },
        { status: 403 }
      );
    }

    // Bootstrap first admin
    const userRef = adminDb.collection('users').doc(uid);
    const existingDoc = await userRef.get();

    const profileData = {
      uid,
      email,
      displayName: decodedToken.name || email.split('@')[0] || 'System Admin',
      role: 'admin' as const,
      updatedAt: Timestamp.now(),
      ...(!existingDoc.exists ? { createdAt: Timestamp.now() } : {}),
    };

    await userRef.set(profileData, { merge: true });
    await adminAuth.setCustomUserClaims(uid, { role: 'admin' });

    return NextResponse.json({
      success: true,
      message: 'Initial administrator successfully bootstrapped',
      profile: profileData,
    });
  } catch (error: any) {
    console.error('Error bootstrapping admin:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to bootstrap admin' },
      { status: 500 }
    );
  }
}
