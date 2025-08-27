import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const data = await req.json().catch(() => ({}));
    // Best-effort logging; avoid throwing on malformed input
    console.log('[telemetry]', {
      event: data?.event,
      payload: data?.payload,
      ts: data?.ts ?? Date.now(),
      ua: req.headers.get('user-agent') || 'unknown',
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.warn('[telemetry] handler error', e);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
