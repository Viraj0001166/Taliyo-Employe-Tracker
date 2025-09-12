import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Missing bearer token' }, { status: 401 });
    }
    const idToken = authHeader.slice('Bearer '.length);
    const decoded = await adminAuth.verifyIdToken(idToken);

    // Revoke refresh tokens for the current user
    await adminAuth.revokeRefreshTokens(decoded.uid);

    return NextResponse.json({ success: true, uid: decoded.uid });
  } catch (err: any) {
    console.error('revoke-sessions error', err);
    return NextResponse.json({ success: false, error: err?.message || 'Internal error' }, { status: 500 });
  }
}
