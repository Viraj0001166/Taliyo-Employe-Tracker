import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { getStorage } from 'firebase-admin/storage';

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

async function deleteUserLogs(uid: string): Promise<number> {
  let total = 0;
  try {
    while (true) {
      const snap = await adminDb
        .collection('dailyLogs')
        .where('employeeId', '==', uid)
        .limit(500)
        .get();
      if (snap.empty) break;
      const batch = adminDb.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      total += snap.size;
    }
  } catch (e) {
    // best-effort; don't fail overall deletion on logs cleanup
    console.warn('deleteUserLogs error', e);
  }
  return total;
}

async function deleteUserStorage(uid: string): Promise<number> {
  try {
    const storage = getStorage();
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    const bucket = bucketName ? storage.bucket(bucketName) : storage.bucket();
    const prefix = `users/${uid}/`;
    const [files] = await bucket.getFiles({ prefix });
    const deletes = await Promise.allSettled(files.map((f) => f.delete()));
    const deletedCount = deletes.filter((r) => r.status === 'fulfilled').length;
    return deletedCount;
  } catch (e) {
    console.warn('deleteUserStorage error', e);
    return 0;
  }
}

async function handleDelete(req: NextRequest) {
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
    const deleteStorage = body?.deleteStorage !== false; // default true

    if (!uid || typeof uid !== 'string') {
      return NextResponse.json({ success: false, error: 'uid is required' }, { status: 400 });
    }

    if (uid === requesterUid) {
      return NextResponse.json({ success: false, error: 'You cannot delete your own account.' }, { status: 400 });
    }

    // Do not allow deleting the super admin account
    const superAdminEmail = (process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL || process.env.SUPER_ADMIN_EMAIL || '').toLowerCase();
    try {
      const targetRecord = await adminAuth.getUser(uid);
      const targetEmail = targetRecord.email?.toLowerCase();
      if (targetEmail && superAdminEmail && targetEmail === superAdminEmail) {
        return NextResponse.json({ success: false, error: 'Cannot delete the super admin account.' }, { status: 403 });
      }
    } catch {}

    // Firestore cleanup
    await adminDb.collection('users').doc(uid).delete().catch(() => {});
    const logsDeleted = await deleteUserLogs(uid);

    // Storage cleanup
    const filesDeleted = deleteStorage ? await deleteUserStorage(uid) : 0;

    // Auth account deletion
    await adminAuth.deleteUser(uid);

    return NextResponse.json({ success: true, logsDeleted, filesDeleted });
  } catch (err: any) {
    console.error('delete-user error', err);
    return NextResponse.json({ success: false, error: err?.message || 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  return handleDelete(req);
}

export async function POST(req: NextRequest) {
  return handleDelete(req);
}
