import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { getStorage } from 'firebase-admin/storage';
import { v4 as uuidv4 } from 'uuid';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Missing bearer token' }, { status: 401 });
    }
    const idToken = authHeader.slice('Bearer '.length);
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    const form = await req.formData();
    const file = form.get('file');
    if (!file || !(file as any).arrayBuffer) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    const blob = file as unknown as File;
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = (blob as any).type || 'application/octet-stream';

    const storage = getStorage();
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    const bucket = bucketName ? storage.bucket(bucketName) : storage.bucket();
    const ext = contentType.includes('png') ? 'png' : contentType.includes('gif') ? 'gif' : contentType.includes('webp') ? 'webp' : 'jpg';
    const filePath = `users/${uid}/profile/avatar_${Date.now()}.${ext}`;
    const token = uuidv4();

    const fileRef = bucket.file(filePath);
    await fileRef.save(buffer, {
      contentType,
      metadata: {
        metadata: {
          firebaseStorageDownloadTokens: token,
        },
      },
      resumable: false,
      public: false,
    });

    const downloadURL = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filePath)}?alt=media&token=${token}`;

    return NextResponse.json({ success: true, url: downloadURL });
  } catch (err: any) {
    console.error('upload-avatar error', err);
    return NextResponse.json({ success: false, error: err?.message || 'Upload failed' }, { status: 500 });
  }
}
