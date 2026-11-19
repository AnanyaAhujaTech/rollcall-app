import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, Timestamp } from '@/lib/firebase/admin';
import { generateInviteCode } from '@/lib/utils/generateCode';

export const dynamic = 'force-dynamic';

async function verifyAdminCaller(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Unauthorized: Missing token', status: 401 };
  }

  const idToken = authHeader.split('Bearer ')[1].trim();
  const decodedToken = await adminAuth.verifyIdToken(idToken);
  const uid = decodedToken.uid;

  // Verify role in Firestore
  const userDoc = await adminDb.collection('users').doc(uid).get();
  if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
    return { error: 'Forbidden: Admin privileges required', status: 403 };
  }

  return { uid, user: userDoc.data() };
}

// GET: List all invite codes
export async function GET(request: NextRequest) {
  try {
    const authCheck = await verifyAdminCaller(request);
    if ('error' in authCheck) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const snapshot = await adminDb.collection('inviteCodes').orderBy('createdAt', 'desc').get();
    const codes = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        code: doc.id,
        role: data.role || 'teacher',
        status: data.status || 'active',
        createdBy: data.createdBy,
        createdByName: data.createdByName,
        usedBy: data.usedBy,
        usedByName: data.usedByName,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
        usedAt: data.usedAt?.toDate ? data.usedAt.toDate().toISOString() : data.usedAt,
        expiresAt: data.expiresAt?.toDate ? data.expiresAt.toDate().toISOString() : data.expiresAt,
      };
    });

    return NextResponse.json({ codes });
  } catch (error: any) {
    console.error('Error fetching invite codes:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch invite codes' },
      { status: 500 }
    );
  }
}

// POST: Generate a new invite code
export async function POST(request: NextRequest) {
  try {
    const authCheck = await verifyAdminCaller(request);
    if ('error' in authCheck) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const body = await request.json().catch(() => ({}));
    const targetRole = body.role === 'admin' ? 'admin' : 'teacher';
    const prefix = targetRole === 'admin' ? 'ADM' : 'TCH';

    // Generate unique code
    let uniqueCode = '';
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      attempts++;
      uniqueCode = generateInviteCode(prefix);
      const existing = await adminDb.collection('inviteCodes').doc(uniqueCode).get();
      if (!existing.exists) {
        isUnique = true;
      }
    }

    if (!isUnique) {
      return NextResponse.json(
        { error: 'Failed to generate unique code, please try again' },
        { status: 500 }
      );
    }

    const codeDocData = {
      code: uniqueCode,
      role: targetRole,
      status: 'active',
      createdBy: authCheck.uid,
      createdByName: authCheck.user?.displayName || 'Administrator',
      createdAt: Timestamp.now(),
    };

    await adminDb.collection('inviteCodes').doc(uniqueCode).set(codeDocData);

    return NextResponse.json({
      success: true,
      code: {
        ...codeDocData,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Error generating invite code:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to generate invite code' },
      { status: 500 }
    );
  }
}

// PATCH: Revoke an invite code
export async function PATCH(request: NextRequest) {
  try {
    const authCheck = await verifyAdminCaller(request);
    if ('error' in authCheck) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const body = await request.json();
    const { code, action } = body;

    if (!code || action !== 'revoke') {
      return NextResponse.json(
        { error: 'Invalid request: code and action="revoke" required' },
        { status: 400 }
      );
    }

    const codeRef = adminDb.collection('inviteCodes').doc(code.toUpperCase());
    const docSnap = await codeRef.get();

    if (!docSnap.exists) {
      return NextResponse.json({ error: 'Invite code not found' }, { status: 404 });
    }

    const data = docSnap.data();
    if (data?.status === 'used') {
      return NextResponse.json(
        { error: 'Cannot revoke a code that has already been redeemed' },
        { status: 400 }
      );
    }

    await codeRef.update({
      status: 'revoked',
      revokedAt: Timestamp.now(),
      revokedBy: authCheck.uid,
    });

    return NextResponse.json({
      success: true,
      message: `Invite code ${code} revoked successfully`,
    });
  } catch (error: any) {
    console.error('Error revoking invite code:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to revoke invite code' },
      { status: 500 }
    );
  }
}
