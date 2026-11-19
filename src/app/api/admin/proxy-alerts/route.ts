import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1].trim();
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // Verify Admin Role
    const userDoc = await adminDb.collection('users').doc(uid).get();
    if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Query proxy alerts
    const alertsSnap = await adminDb.collection('proxyAlerts').get();

    // Map and sort in memory newest first
    const rawAlerts = alertsSnap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        sessionId: d.sessionId || '',
        classId: d.classId || '',
        studentId: d.studentId || '',
        studentName: d.studentName || 'Student',
        studentRollNumber: d.studentRollNumber || '',
        reason: d.reason || 'Suspicious Activity',
        details: d.details || {},
        timestamp: d.timestamp?.toDate ? d.timestamp.toDate().toISOString() : d.timestamp || '',
      };
    });

    rawAlerts.sort((a, b) => {
      const aTime = new Date(a.timestamp || 0).getTime();
      const bTime = new Date(b.timestamp || 0).getTime();
      return bTime - aTime;
    });

    // Enrich with class names if classId is present
    const uniqueClassIds = Array.from(
      new Set(rawAlerts.map((a) => a.classId).filter(Boolean))
    );
    const classMap: Record<string, string> = {};

    await Promise.all(
      uniqueClassIds.map(async (cId) => {
        try {
          const cDoc = await adminDb.collection('classes').doc(cId).get();
          if (cDoc.exists) {
            classMap[cId] = cDoc.data()?.name || cDoc.data()?.code || cId;
          }
        } catch (e) {
          // ignore lookup error
        }
      })
    );

    const enrichedAlerts = rawAlerts.map((alert) => ({
      ...alert,
      className: classMap[alert.classId] || (alert.classId ? 'Course Session' : 'Unknown Class'),
    }));

    return NextResponse.json({ alerts: enrichedAlerts });
  } catch (error: any) {
    console.error('Error fetching admin proxy alerts:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
