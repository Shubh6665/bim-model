import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/app/lib/mongodb';
import nodemailer from 'nodemailer';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body || {};
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

    const client = await clientPromise;
    const db = client.db();
    const normalizedEmail = String(email).toLowerCase();

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await db.collection('emailOtps').updateOne(
      { email: normalizedEmail },
      { $set: { email: normalizedEmail, code, expiresAt } },
      { upsert: true }
    );

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT || 587) === 465,
      auth: { 
        user: process.env.SMTP_USER, 
        pass: process.env.SMTP_PASS 
      },
      connectionTimeout: 60000,
      greetingTimeout: 30000,
      socketTimeout: 60000,
    });

    // Verify connection before sending
    await transporter.verify();

    await transporter.sendMail({
      from: process.env.MAIL_FROM || 'noreply@example.com',
      to: normalizedEmail,
      subject: 'Your verification code',
      text: `Your OTP is ${code}. It expires in 10 minutes.`,
      html: `<p>Your OTP is <b>${code}</b>. It expires in 10 minutes.</p>`,
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Send OTP error:', e);
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}
