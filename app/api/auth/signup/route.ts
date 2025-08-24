import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/app/lib/mongodb';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, firstName, lastName, inviteToken, projectId, requireOtp, otpCode } = body || {};

    if (!email || !password) {
      return NextResponse.json({ error: 'Missing email or password' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();
    const normalizedEmail = String(email).toLowerCase();

    // If OTP required (self-signup), validate it
    if (requireOtp) {
      if (!otpCode) {
        return NextResponse.json({ error: 'OTP required' }, { status: 400 });
      }
      const otpDoc = await db.collection('emailOtps').findOne({ email: normalizedEmail });
      const now = new Date();
      if (!otpDoc || otpDoc.code !== String(otpCode) || (otpDoc.expiresAt && now > new Date(otpDoc.expiresAt))) {
        return NextResponse.json({ error: 'Invalid or expired OTP' }, { status: 400 });
      }
      // consume otp
      await db.collection('emailOtps').deleteOne({ _id: otpDoc._id });
    }

    const existing = await db.collection('users').findOne({ email: normalizedEmail });
    if (existing && existing.password) {
      return NextResponse.json({ error: 'Account already exists. Please sign in.' }, { status: 409 });
    }

    const hash = await bcrypt.hash(password, 10);

    // Upsert user in adapter's users collection (we use same custom collection name 'users')
    const userDoc = {
      email: normalizedEmail,
      name: `${firstName || ''} ${lastName || ''}`.trim() || undefined,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      password: hash,
      role: 'user',
      createdAt: new Date(),
      emailVerified: null,
      provider: 'credentials',
    } as any;

    if (existing) {
      await db.collection('users').updateOne({ _id: existing._id }, { $set: userDoc });
    } else {
      await db.collection('users').insertOne(userDoc);
    }

    // If invite token provided, mark as accepted idempotently after auth on client
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Signup error:', e);
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}
