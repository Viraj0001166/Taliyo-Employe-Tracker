import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

// Helper to check if the requester is an admin
async function isRequesterAdmin(uid: string, email?: string | null): Promise<boolean> {
  try {
    // Super admin override via env (optional)
    const superAdminEmail = process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL || process.env.SUPER_ADMIN_EMAIL;
    if (email && superAdminEmail && email.toLowerCase() === superAdminEmail.toLowerCase()) return true;

    // Check Firestore user role
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

    // Basic admin check
    const requesterIsAdmin = await isRequesterAdmin(requesterUid, decoded.email);
    if (!requesterIsAdmin) {
      return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 403 });
    }

    const { uid, password } = await req.json();
    if (!uid || typeof uid !== 'string') {
      return NextResponse.json({ success: false, error: 'uid is required' }, { status: 400 });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ success: false, error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    await adminAuth.updateUser(uid, { password });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('set-password error', err);
    return NextResponse.json({ success: false, error: err?.message || 'Internal error' }, { status: 500 });
  }
}
