import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, Timestamp } from '@/lib/firebase/admin';
import { UserRole } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing or invalid Authorization header' },
        { status: 401 }
      );
    }

    const idToken = authHeader.split('Bearer ')[1].trim();
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;
    const email = decodedToken.email || '';

    const body = await request.json();
    const { role, displayName, rollNumber, inviteCode } = body as {
      role?: UserRole;
      displayName?: string;
      rollNumber?: string;
      inviteCode?: string;
    };

    if (!role || !['student', 'teacher', 'admin'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role specified' },
        { status: 400 }
      );
    }

    const trimmedName = (displayName || decodedToken.name || email.split('@')[0] || 'User').trim();
    const userRef = adminDb.collection('users').doc(uid);

    // Check if user already has an established role
    const existingUserDoc = await userRef.get();
    if (existingUserDoc.exists) {
      const existingData = existingUserDoc.data();
      if (existingData?.role && existingData.role !== role) {
        return NextResponse.json(
          { error: `User is already registered with role "${existingData.role}" and cannot re-register as "${role}"` },
          { status: 403 }
        );
      }
    }

    if (role === 'student') {
      if (!rollNumber || !rollNumber.trim()) {
        return NextResponse.json(
          { error: 'Roll number is required for student registration' },
          { status: 400 }
        );
      }

      const formattedRollNumber = rollNumber.trim().toUpperCase();

      const profileData = {
        uid,
        email,
        displayName: trimmedName,
        role: 'student' as const,
        rollNumber: formattedRollNumber,
        updatedAt: Timestamp.now(),
        ...(!existingUserDoc.exists ? { createdAt: Timestamp.now() } : {}),
      };

      await userRef.set(profileData, { merge: true });
      await adminAuth.setCustomUserClaims(uid, { role: 'student' });

      return NextResponse.json({
        success: true,
        profile: {
          ...profileData,
          createdAt: existingUserDoc.exists ? (existingUserDoc.data()?.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString()) : new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });
    }

    if (role === 'teacher') {
      if (!inviteCode || !inviteCode.trim()) {
        return NextResponse.json(
          { error: 'Teacher invite code is required' },
          { status: 400 }
        );
      }

      const normalizedCode = inviteCode.trim().toUpperCase();
      const inviteCodeRef = adminDb.collection('inviteCodes').doc(normalizedCode);

      // Execute atomic transaction to redeem invite code
      await adminDb.runTransaction(async (transaction) => {
        const codeDoc = await transaction.get(inviteCodeRef);
        if (!codeDoc.exists) {
          throw new Error('Invalid teacher invite code');
        }

        const codeData = codeDoc.data();
        if (codeData?.status !== 'active') {
          throw new Error(`Invite code has already been ${codeData?.status || 'invalidated'}`);
        }

        if (codeData?.expiresAt) {
          const expiresDate = codeData.expiresAt.toDate ? codeData.expiresAt.toDate() : new Date(codeData.expiresAt);
          if (expiresDate < new Date()) {
            throw new Error('Invite code has expired');
          }
        }

        // Mark code as used
        transaction.update(inviteCodeRef, {
          status: 'used',
          usedBy: uid,
          usedByName: trimmedName,
          usedAt: Timestamp.now(),
        });

        // Set teacher profile
        transaction.set(
          userRef,
          {
            uid,
            email,
            displayName: trimmedName,
            role: 'teacher' as const,
            updatedAt: Timestamp.now(),
            ...(!existingUserDoc.exists ? { createdAt: Timestamp.now() } : {}),
          },
          { merge: true }
        );
      });

      await adminAuth.setCustomUserClaims(uid, { role: 'teacher' });

      return NextResponse.json({
        success: true,
        profile: {
          uid,
          email,
          displayName: trimmedName,
          role: 'teacher',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });
    }

    if (role === 'admin') {
      // Allow bootstrapping if invite code matches an admin code or if no admins exist yet
      if (!inviteCode || !inviteCode.trim()) {
        return NextResponse.json(
          { error: 'Admin authorization code is required' },
          { status: 400 }
        );
      }

      const normalizedCode = inviteCode.trim().toUpperCase();
      const inviteCodeRef = adminDb.collection('inviteCodes').doc(normalizedCode);

      await adminDb.runTransaction(async (transaction) => {
        const codeDoc = await transaction.get(inviteCodeRef);
        if (!codeDoc.exists) {
          throw new Error('Invalid admin authorization code');
        }

        const codeData = codeDoc.data();
        if (codeData?.role !== 'admin' && codeData?.status !== 'active') {
          throw new Error('Invalid or already redeemed admin code');
        }

        transaction.update(inviteCodeRef, {
          status: 'used',
          usedBy: uid,
          usedByName: trimmedName,
          usedAt: Timestamp.now(),
        });

        transaction.set(
          userRef,
          {
            uid,
            email,
            displayName: trimmedName,
            role: 'admin' as const,
            updatedAt: Timestamp.now(),
            ...(!existingUserDoc.exists ? { createdAt: Timestamp.now() } : {}),
          },
          { merge: true }
        );
      });

      await adminAuth.setCustomUserClaims(uid, { role: 'admin' });

      return NextResponse.json({
        success: true,
        profile: {
          uid,
          email,
          displayName: trimmedName,
          role: 'admin',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });
    }

    return NextResponse.json({ error: 'Unsupported registration flow' }, { status: 400 });
  } catch (error: any) {
    console.error('Error in register-role API:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to complete registration' },
      { status: 400 }
    );
  }
}
