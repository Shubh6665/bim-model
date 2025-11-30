import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/app/lib/mongodb';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json({ error: 'Token and password are required' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();

    // Find token
    const resetDoc = await db.collection('passwordResetTokens').findOne({ token });
    
    if (!resetDoc) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 });
    }

    // Check expiration
    if (new Date() > new Date(resetDoc.expiresAt)) {
      return NextResponse.json({ error: 'Token has expired' }, { status: 400 });
    }

    // Hash new password
    const hash = await bcrypt.hash(password, 10);

    // Update user password
    await db.collection('users').updateOne(
      { email: resetDoc.email },
      { $set: { password: hash } }
    );

    // Delete token
    await db.collection('passwordResetTokens').deleteOne({ _id: resetDoc._id });

    return NextResponse.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
