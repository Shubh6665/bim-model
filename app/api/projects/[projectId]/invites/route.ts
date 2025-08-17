import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/app/services/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth-config';
import { ObjectId } from 'mongodb';
import nodemailer from 'nodemailer';

async function getUserEmail(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.email || null;
}

// POST /api/projects/[projectId]/invites -> create and (optionally) send an invite
export async function POST(req: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  try {
    const email = await getUserEmail();
    if (!email) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const db = await getDb();
    const user = await db.collection('users').findOne({ email });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { projectId } = await context.params;
    const project = await db.collection('projects').findOne({ _id: new ObjectId(projectId), userId: user._id });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const body = await req.json();
    const { name, surname, email: inviteeEmail, role, society, packages } = body || {};

    if (!inviteeEmail || typeof inviteeEmail !== 'string') {
      return NextResponse.json({ error: 'Valid invitee email is required' }, { status: 400 });
    }

    const inviteDoc = {
      _id: new ObjectId(),
      projectId: project._id,
      inviterUserId: user._id,
      invitee: {
        name: name || '',
        surname: surname || '',
        email: inviteeEmail,
        role: role || 'General',
        society: society || '',
        packages: Array.isArray(packages) ? packages : [],
      },
      status: 'pending' as 'pending' | 'accepted' | 'declined' | 'expired',
      token: new ObjectId().toHexString(),
      createdAt: new Date(),
    };

    await db.collection('invites').insertOne(inviteDoc);

    // Build accept link for the invitee
    const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
    const acceptUrl = `${baseUrl}/invite/accept?token=${inviteDoc.token}&projectId=${projectId}`;

    // Attempt to send email via SMTP if env vars are present
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM } = process.env as Record<string, string | undefined>;

    if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS && MAIL_FROM) {
      try {
        const transporter = nodemailer.createTransport({
          host: SMTP_HOST,
          port: Number(SMTP_PORT),
          secure: Number(SMTP_PORT) === 465, // true for 465, false for 587/25
          auth: {
            user: SMTP_USER,
            pass: SMTP_PASS,
          },
        });

        const html = `
          <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; line-height:1.5; color:#111">
            <h2>You have been invited to a BIM project</h2>
            <p>Hello${name ? ` ${name}` : ''},</p>
            <p>You have been invited to collaborate on the project <strong>${project.name || 'Project'}</strong>.</p>
            <p>Role: <strong>${role || 'General'}</strong>${society ? ` · Society: <strong>${society}</strong>` : ''}</p>
            <p>Packages: ${(Array.isArray(packages) ? packages : []).join(', ') || 'None'}</p>
            <p>Please click the link below to accept the invitation:</p>
            <p><a href="${acceptUrl}" target="_blank" rel="noopener" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px">Accept Invitation</a></p>
            <p>If the button doesn’t work, copy and paste this URL into your browser:</p>
            <p><code>${acceptUrl}</code></p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0" />
            <p style="color:#6b7280">This link will be used to validate your access. If you didn’t expect this invitation, you can safely ignore this email.</p>
          </div>
        `;

        await transporter.sendMail({
          from: MAIL_FROM,
          to: inviteeEmail,
          subject: `Invitation to join project: ${project.name || 'BIM Project'}`,
          html,
        });
      } catch (mailErr) {
        console.error('SMTP send error:', mailErr);
        // Continue without failing the request
      }
    } else {
      console.warn('SMTP env vars missing; skipping email send');
    }

    return NextResponse.json({ success: true, inviteId: inviteDoc._id, token: inviteDoc.token });
  } catch (err: any) {
    console.error('Error creating invite:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
