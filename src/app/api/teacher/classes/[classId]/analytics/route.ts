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
    const uid = decodedToken.uid;

    const { classId } = await context.params;
    if (!classId) {
      return NextResponse.json({ error: 'Class ID is required' }, { status: 400 });
    }

    // 1. Fetch class doc & verify ownership
    const classDoc = await adminDb.collection('classes').doc(classId).get();
    if (!classDoc.exists) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }

    const classData = classDoc.data()!;
    const userDoc = await adminDb.collection('users').doc(uid).get();
    const userRole = userDoc.data()?.role;

    if (userRole !== 'admin' && classData.teacherId !== uid) {
      return NextResponse.json({ error: 'Forbidden: You do not own this class' }, { status: 403 });
    }

    // 2. Fetch full enrolled roster
    const enrollmentsSnap = await adminDb
      .collection('enrollments')
      .where('classId', '==', classId)
      .get();

    const enrolledStudents = enrollmentsSnap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        studentId: d.studentId,
        studentName: d.studentName || 'Student',
        studentRollNumber: d.studentRollNumber || '',
        studentEmail: d.studentEmail || '',
        joinedAt: d.joinedAt?.toDate ? d.joinedAt.toDate().toISOString() : d.joinedAt || '',
      };
    });

    // Sort roster in memory by roll number
    enrolledStudents.sort((a, b) => (a.studentRollNumber || '').localeCompare(b.studentRollNumber || ''));

    // 3. Fetch all sessions for this class (sorted newest first in memory)
    const sessionsSnap = await adminDb
      .collection('sessions')
      .where('classId', '==', classId)
      .get();

    const sessionsList: any[] = [];
    const sessionRecordsMap: Record<string, Record<string, any>> = {};

    for (const sDoc of sessionsSnap.docs) {
      const sData = sDoc.data();
      const sId = sDoc.id;

      sessionsList.push({
        id: sId,
        classId: sData.classId,
        className: sData.className,
        section: sData.section,
        mode: sData.mode,
        status: sData.status,
        durationMinutes: sData.durationMinutes,
        lateAfterMinutes: sData.lateAfterMinutes,
        geofence: sData.geofence,
        presentCount: sData.presentCount || 0,
        lateCount: sData.lateCount || 0,
        absentCount: sData.absentCount || 0,
        flaggedCount: sData.flaggedCount ?? 0,
        startTime: sData.startTime?.toDate ? sData.startTime.toDate().toISOString() : sData.startTime,
        createdAt: sData.createdAt?.toDate ? sData.createdAt.toDate().toISOString() : sData.createdAt || '',
        endedAt: sData.endedAt?.toDate ? sData.endedAt.toDate().toISOString() : sData.endedAt,
      });

      // Fetch records for this session
      const recordsSnap = await sDoc.ref.collection('records').get();
      const recordsByStudent: Record<string, any> = {};
      recordsSnap.forEach((rDoc) => {
        const rData = rDoc.data();
        recordsByStudent[rDoc.id] = {
          studentId: rDoc.id,
          status: rData.status,
          method: rData.method,
          timestamp: rData.timestamp?.toDate ? rData.timestamp.toDate().toISOString() : rData.timestamp,
        };
      });
      sessionRecordsMap[sId] = recordsByStudent;
    }

    // Sort sessions in memory by createdAt desc
    sessionsList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // 4. Fetch total proxy alerts for this class
    const alertsSnap = await adminDb
      .collection('proxyAlerts')
      .where('classId', '==', classId)
      .get();

    const totalProxyAlerts = alertsSnap.size;

    // 5. Compute per-student analytics
    const totalSessions = sessionsList.length;

    const studentStats = enrolledStudents.map((st) => {
      let attendedCount = 0;
      let presentCount = 0;
      let lateCount = 0;
      let absentCount = 0;
      let flaggedCount = 0;
      const sessionStatuses: Record<string, string> = {};

      for (const s of sessionsList) {
        const rec = sessionRecordsMap[s.id]?.[st.studentId];
        const status = rec?.status || 'absent';
        sessionStatuses[s.id] = status;

        if (status === 'present') {
          attendedCount++;
          presentCount++;
        } else if (status === 'late') {
          attendedCount++;
          lateCount++;
        } else if (status === 'flagged') {
          flaggedCount++;
        } else {
          absentCount++;
        }
      }

      const percentage = totalSessions > 0 ? Math.round((attendedCount / totalSessions) * 100) : 100;
      const belowThreshold = totalSessions > 0 && percentage < 75;

      return {
        ...st,
        attendedCount,
        presentCount,
        lateCount,
        absentCount,
        flaggedCount,
        totalSessions,
        percentage,
        belowThreshold,
        sessionStatuses,
      };
    });

    // 6. Aggregate class metrics
    const classAvgPercent =
      studentStats.length > 0
        ? Math.round(studentStats.reduce((acc, s) => acc + s.percentage, 0) / studentStats.length)
        : 100;

    const studentsBelow75Count = studentStats.filter((s) => s.belowThreshold).length;

    return NextResponse.json({
      success: true,
      class: {
        id: classId,
        name: classData.name,
        code: classData.code,
        section: classData.section,
        description: classData.description,
        joinCode: classData.joinCode,
        studentCount: enrolledStudents.length,
      },
      summary: {
        totalSessions,
        classAverage: classAvgPercent,
        studentsBelow75: studentsBelow75Count,
        totalProxyAlerts,
      },
      students: studentStats,
      sessions: sessionsList,
      sessionRecordsMap,
    });
  } catch (error: any) {
    console.error('Error fetching class analytics:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to load class analytics' },
      { status: 500 }
    );
  }
}
