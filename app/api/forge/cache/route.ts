import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/services/mongodb';

// Mongo collection schema (loose):
// {
//   fileHash: string,
//   fileName: string,
//   size: number,
//   urn: string,
//   status: 'pending' | 'success' | 'failed',
//   manifest?: any,
//   createdAt: number,
//   updatedAt: number,
//   lastAccessAt: number,
//   cacheHits: number
// }

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action as 'check' | 'record' | 'touch';

    if (!action) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 });
    }

    const db = await getDb();
    const col = db.collection('forge_models');

    if (action === 'check') {
      const { fileHash } = body as { fileHash?: string };
      if (!fileHash) return NextResponse.json({ error: 'fileHash required' }, { status: 400 });

      const doc = await col.findOne({ fileHash });
      if (!doc) return NextResponse.json({ hit: false });

      // touch
      await col.updateOne({ _id: doc._id }, {
        $set: { lastAccessAt: Date.now() },
        $inc: { cacheHits: 1 }
      });

      return NextResponse.json({ hit: true, model: {
        fileHash: doc.fileHash,
        fileName: doc.fileName,
        size: doc.size,
        urn: doc.urn,
        status: doc.status,
        updatedAt: doc.updatedAt,
      }});
    }

    if (action === 'record') {
      const { fileHash, fileName, size, urn, status, manifest } = body as {
        fileHash?: string; fileName?: string; size?: number; urn?: string; status?: 'pending' | 'success' | 'failed'; manifest?: any;
      };
      if (!fileHash || !urn || !status) {
        return NextResponse.json({ error: 'fileHash, urn, status are required' }, { status: 400 });
      }

      const now = Date.now();
      await col.updateOne(
        { fileHash },
        { $set: { fileHash, fileName, size, urn, status, manifest, updatedAt: now }, $setOnInsert: { createdAt: now, cacheHits: 0, lastAccessAt: now } },
        { upsert: true }
      );
      return NextResponse.json({ ok: true });
    }

    if (action === 'touch') {
      const { fileHash } = body as { fileHash?: string };
      if (!fileHash) return NextResponse.json({ error: 'fileHash required' }, { status: 400 });
      await col.updateOne({ fileHash }, { $set: { lastAccessAt: Date.now() }, $inc: { cacheHits: 1 } });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    console.error('forge/cache route error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
