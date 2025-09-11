import { NextRequest, NextResponse } from 'next/server';
import { adminAgentChat } from '@/ai/flows/admin-agent-flow';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const history = Array.isArray(body?.history) ? body.history : [];
    const prompt = typeof body?.prompt === 'string' ? body.prompt : '';
    const adminId = typeof body?.adminId === 'string' ? body.adminId : '';

    if (!prompt) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    }

    const result = await adminAgentChat({ history, prompt, adminId });
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('admin-agent POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
