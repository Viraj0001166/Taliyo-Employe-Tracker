import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';

// Helper to check if the requester is an admin
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

    let body: any = {};
    try {
      body = await req.json();
    } catch {}

    const uid = body?.uid as string | undefined;
    const updates = (body?.updates || {}) as Record<string, any>;

    if (!uid || typeof uid !== 'string') {
      return NextResponse.json({ success: false, error: 'uid is required' }, { status: 400 });
    }
    if (!updates || typeof updates !== 'object') {
      return NextResponse.json({ success: false, error: 'updates object is required' }, { status: 400 });
    }

    // Whitelist allowed fields to avoid accidental writes
    const allowedProfileFields = new Set([
      'name',
      'email',
      'role',
      'title',
      'department',
      'employeeCode',
      'joiningDate',
      'reportingManager',
      'avatar',
      'status',
    ]);

    const profilePatch: Record<string, any> = {};
    Object.keys(updates).forEach((k) => {
      if (allowedProfileFields.has(k)) profilePatch[k] = updates[k];
    });

    // Update Auth record if needed
    const authPatch: { email?: string; displayName?: string } = {};
    if (typeof profilePatch.name === 'string' && profilePatch.name.trim()) {
      authPatch.displayName = profilePatch.name.trim();
    }
    if (typeof profilePatch.email === 'string' && profilePatch.email.trim()) {
      authPatch.email = profilePatch.email.trim();
    }

    if (Object.keys(authPatch).length > 0) {
      await adminAuth.updateUser(uid, authPatch);
    }

    if (Object.keys(profilePatch).length > 0) {
      await adminDb.collection('users').doc(uid).set(profilePatch, { merge: true });
    }

    return NextResponse.json({ success: true, updated: profilePatch });
  } catch (err: any) {
    console.error('update-user error', err);
    return NextResponse.json({ success: false, error: err?.message || 'Internal error' }, { status: 500 });
  }
}
