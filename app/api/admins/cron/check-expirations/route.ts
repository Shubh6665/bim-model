import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/services/mongodb';
import nodemailer from 'nodemailer';
import { isPlatformOwnerEmail } from '@/app/lib/rbac';

function getOwnerEmails(): string[] {
  const csv = process.env.PLATFORM_OWNER_EMAILS || '';
  return csv.split(',').map(s => s.trim()).filter(Boolean);
}

async function getMailer() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    throw new Error('SMTP env not configured');
  }
  const secure = port === 465; // true for 465, false for others
  return nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
}

export async function GET(_req: NextRequest) {
  try {
    const ownerEmails = getOwnerEmails();
    if (ownerEmails.length === 0) {
      return NextResponse.json({ ok: false, error: 'PLATFORM_OWNER_EMAILS not configured' }, { status: 500 });
    }

    const db = await getDb();
    const users = await db.collection('users')
      .find({ 'adminCompanies': { $elemMatch: { status: 'approved', expiresAt: { $exists: true } } } })
      .project({ email: 1, name: 1, adminCompanies: 1 })
      .toArray();

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const expiredEntries: Array<{ email: string; name?: string; company: string; expiresAt: Date } > = [];
    const tomorrowEntries: Array<{ email: string; name?: string; company: string; expiresAt: Date } > = [];

    for (const u of users) {
      const arr = Array.isArray(u.adminCompanies) ? u.adminCompanies : [];
      for (const entry of arr) {
        if (entry?.status === 'approved' && entry?.expiresAt) {
          const exp = new Date(entry.expiresAt);
          const expStart = new Date(exp.getFullYear(), exp.getMonth(), exp.getDate());
          const alreadyNotified = !!entry?.expiryNotifiedAt && new Date(entry.expiryNotifiedAt) >= expStart;
          const alreadyPre = !!entry?.expiryPreNotifiedAt && new Date(entry.expiryPreNotifiedAt) >= expStart;
          if (!isNaN(exp.getTime())) {
            if (expStart.getTime() <= startOfToday.getTime() && !alreadyNotified) {
              expiredEntries.push({ email: u.email, name: u.name, company: entry.company, expiresAt: expStart });
            } else if (expStart.getTime() === startOfTomorrow.getTime() && !alreadyPre) {
              tomorrowEntries.push({ email: u.email, name: u.name, company: entry.company, expiresAt: expStart });
            }
          }
        }
      }
    }

    let sent = 0;

    const transporter = await getMailer();
    const from = process.env.MAIL_FROM || ownerEmails[0];

    if (tomorrowEntries.length > 0) {
      const lines = tomorrowEntries.map(e => `• ${e.name || e.email} – ${e.company} (expires on ${e.expiresAt.toDateString()})`).join('\n');
      const subject = `Administrators expiring tomorrow: ${tomorrowEntries.length}`;
      const text = `These Administrator entries will expire tomorrow. Please review.\n\n${lines}\n\nThis is an automated reminder.`;
      await transporter.sendMail({ from, to: ownerEmails.join(','), subject, text });
      sent += 1;
      for (const e of tomorrowEntries) {
        await db.collection('users').updateOne(
          { email: e.email },
          { $set: { 'adminCompanies.$[elem].expiryPreNotifiedAt': new Date() } },
          { arrayFilters: [ { 'elem.company': e.company, 'elem.status': 'approved' } ] }
        );
      }
    }

    if (expiredEntries.length > 0) {
      const lines2 = expiredEntries.map(e => `• ${e.name || e.email} – ${e.company} (expired on ${e.expiresAt.toDateString()})`).join('\n');
      const subject2 = `Administrators expired: ${expiredEntries.length}`;
      const text2 = `These Administrator entries have reached their expiration date. Please review and remove them if appropriate.\n\n${lines2}\n\nThis is an automated reminder.`;
      await transporter.sendMail({ from, to: ownerEmails.join(','), subject: subject2, text: text2 });
      sent += 1;
      for (const e of expiredEntries) {
        await db.collection('users').updateOne(
          { email: e.email },
          { $set: { 'adminCompanies.$[elem].expiryNotifiedAt': new Date() } },
          { arrayFilters: [ { 'elem.company': e.company, 'elem.status': 'approved' } ] }
        );
      }
    }

    return NextResponse.json({ ok: true, sent, expiredCount: expiredEntries.length, tomorrowCount: tomorrowEntries.length });
  } catch (err: any) {
    console.error('[cron check-expirations] Error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
