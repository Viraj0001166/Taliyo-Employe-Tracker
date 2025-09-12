import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Missing bearer token' }, { status: 401 });
    }
    const idToken = authHeader.slice('Bearer '.length);
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    // Collect user data: dailyLogs, tasks, visitorLogs
    const [logsSnap, tasksSnap, visitsSnap] = await Promise.all([
      adminDb.collection('dailyLogs').where('employeeId', '==', uid).get(),
      adminDb.collection('tasks').where('employeeId', '==', uid).get(),
      adminDb.collection('visitorLogs').where('employeeId', '==', uid).get(),
    ]);

    const data = {
      userId: uid,
      collectedAt: new Date().toISOString(),
      dailyLogs: logsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      tasks: tasksSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      visitorLogs: visitsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    };

    const body = JSON.stringify(data, null, 2);
    const filename = `export-${uid}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    console.error('export-data error', err);
    return NextResponse.json({ success: false, error: err?.message || 'Internal error' }, { status: 500 });
  }
}
