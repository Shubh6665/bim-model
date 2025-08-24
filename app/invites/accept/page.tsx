"use client";

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn, signOut } from 'next-auth/react';

export default function AcceptInvitePage() {
  const sp = useSearchParams();
  const router = useRouter();
  const token = sp.get('token') || '';
  const projectId = sp.get('projectId') || '';

  const [state, setState] = useState<'loading'|'error'|'action'>('loading');
  const [message, setMessage] = useState<string>('');
  const [invitedEmail, setInvitedEmail] = useState<string>('');
  const [signedInAs, setSignedInAs] = useState<string>('');

  const isGmail = (email: string) => /@gmail\.com$/i.test(email);

  useEffect(() => {
    const run = async () => {
      if (!token) {
        setState('error');
        setMessage('Missing invite token');
        return;
      }
      try {
        const url = `/api/invites/accept?token=${encodeURIComponent(token)}${projectId ? `&projectId=${encodeURIComponent(projectId)}` : ''}`;
        const res = await fetch(url, { method: 'GET' });
        const data = await res.json();
        if (res.ok && data?.success) {
          router.replace('/dashboard');
          return;
        }
        if (res.status === 401 && data?.requiresAuth) {
          const email = data?.invitedEmail as string;
          setInvitedEmail(email);
          if (email && isGmail(email)) {
            // Force Google with login_hint for smoother pick
            await signIn('google', { callbackUrl: `/invites/accept?token=${encodeURIComponent(token)}${projectId ? `&projectId=${encodeURIComponent(projectId)}` : ''}`, login_hint: email });
            return;
          } else if (email) {
            // Non-gmail: check if user exists to decide between login and signup
            const userExistsRes = await fetch(`/api/users/exists?email=${encodeURIComponent(email)}`);
            const userExistsData = await userExistsRes.json();
            const mode = userExistsData.exists ? 'login' : 'signup';
            router.replace(`/?mode=${mode}&email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}${projectId ? `&projectId=${encodeURIComponent(projectId)}` : ''}`);
            return;
          }
        }
        if (res.status === 403 && data?.error === 'wrong_account') {
          setInvitedEmail(data?.invitedEmail);
          setSignedInAs(data?.signedInAs);
          setState('action');
          setMessage('You are signed in with a different account. Please continue with the invited email.');
          return;
        }
        // Any other error
        setState('error');
        setMessage(data?.error || 'Unable to accept invite');
      } catch (e: any) {
        setState('error');
        setMessage(e?.message || 'Network error');
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, projectId]);

  const continueWithInvited = async () => {
    if (!invitedEmail) return;
    await signOut({ redirect: false }); // Sign out current user first

    if (isGmail(invitedEmail)) {
      await signIn('google', { callbackUrl: `/invites/accept?token=${encodeURIComponent(token)}${projectId ? `&projectId=${encodeURIComponent(projectId)}` : ''}`, login_hint: invitedEmail });
    } else {
      // Check if user exists to decide between login and signup
      const userExistsRes = await fetch(`/api/users/exists?email=${encodeURIComponent(invitedEmail)}`);
      const userExistsData = await userExistsRes.json();
      const mode = userExistsData.exists ? 'login' : 'signup';
      router.replace(`/?mode=${mode}&email=${encodeURIComponent(invitedEmail)}&token=${encodeURIComponent(token)}${projectId ? `&projectId=${encodeURIComponent(projectId)}` : ''}`);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b0b0b', color: '#eee' }}>
      <div style={{ width: 520, maxWidth: '95%', background: '#111827', border: '1px solid #1f2937', borderRadius: 12, padding: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>Accepting invitation…</h1>
        {state === 'loading' && (
          <div>Checking your invite…</div>
        )}
        {state === 'error' && (
          <div style={{ background: '#7f1d1d', border: '1px solid #991b1b', color: '#fee2e2', padding: 12, borderRadius: 8 }}>{message}</div>
        )}
        {state === 'action' && (
          <div>
            <div style={{ background: '#0c4a6e', border: '1px solid #075985', color: '#e0f2fe', padding: 12, borderRadius: 8 }}>
              Invited email: <b>{invitedEmail}</b>
              <br />
              Currently signed in as: <b>{signedInAs}</b>
              <br />
              {message}
            </div>
            <div style={{ height: 12 }} />
            <button onClick={continueWithInvited} style={{ background: '#2563eb', color: '#fff', border: 0, padding: '10px 16px', borderRadius: 8, fontWeight: 600 }}>
              Continue with invited account
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
