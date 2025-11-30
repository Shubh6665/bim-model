import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/app/lib/mongodb';
import { sendEmail } from '@/app/lib/email';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();
    const normalizedEmail = String(email).toLowerCase();

    // Check if user exists
    const user = await db.collection('users').findOne({ email: normalizedEmail });
    if (!user) {
      // For security, don't reveal that the user doesn't exist
      return NextResponse.json({ message: 'If an account exists with this email, a reset link has been sent.' });
    }

    // Generate reset token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    // Store token
    await db.collection('passwordResetTokens').updateOne(
      { email: normalizedEmail },
      { $set: { token, expiresAt, createdAt: new Date() } },
      { upsert: true }
    );

    // Send email
    const resetLink = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/?mode=reset-password&token=${token}`;
    
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Reset Your Password</h2>
        <p>You requested to reset your password. Click the link below to proceed:</p>
        <p>
          <a href="${resetLink}" style="display: inline-block; padding: 10px 20px; background-color: #000; color: #fff; text-decoration: none; border-radius: 5px;">Reset Password</a>
        </p>
        <p style="font-size: 12px; color: #666;">This link will expire in 1 hour.</p>
        <p style="font-size: 12px; color: #666;">If you didn't request this, please ignore this email.</p>
      </div>
    `;

    await sendEmail(normalizedEmail, 'Password Reset Request', html);

    return NextResponse.json({ message: 'If an account exists with this email, a reset link has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
