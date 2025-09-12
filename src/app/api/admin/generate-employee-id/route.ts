import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';

async function isRequesterAdmin(uid: string, email?: string | null): Promise<boolean> {
  try {
    const superAdminEmail = process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL || process.env.SUPER_ADMIN_EMAIL;
    if (email && superAdminEmail && email.toLowerCase() === superAdminEmail.toLowerCase()) return true;
    const snap = await adminDb.collection('users').doc(uid).get();
    const role = snap.exists ? (snap.data() as any)?.role : undefined;
    return role === 'admin';
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Missing bearer token' }, { status: 401 });
    }
    const idToken = authHeader.slice('Bearer '.length);

    const decoded = await adminAuth.verifyIdToken(idToken);
    const requesterUid = decoded.uid;

    const requesterIsAdmin = await isRequesterAdmin(requesterUid, decoded.email);
    if (!requesterIsAdmin) {
      return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 403 });
    }

    const prefix = (process.env.EMPLOYEE_ID_PREFIX || 'TLY').toUpperCase();
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyymm = `${yyyy}${mm}`;

    const counterRef = adminDb.collection('config').doc('employeeId');

    const result = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(counterRef);
      let seq = 1;
      if (snap.exists) {
        const data = snap.data() as any;
        const last = data?.lastYYYYMM || '';
        const lastSeq = Number(data?.seq || 0) || 0;
        if (last === yyyymm) seq = lastSeq + 1; else seq = 1;
      }
      tx.set(counterRef, { lastYYYYMM: yyyymm, seq }, { merge: true });
      const id = `${prefix}-${yyyymm}-${String(seq).padStart(4, '0')}`;
      return { id, seq };
    });

    return NextResponse.json({ success: true, id: result.id });
  } catch (err: any) {
    console.error('generate-employee-id error', err);
    return NextResponse.json({ success: false, error: err?.message || 'Internal error' }, { status: 500 });
  }
}
