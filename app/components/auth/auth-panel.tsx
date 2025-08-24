"use client";

import { useMemo, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { signIn, signOut } from 'next-auth/react';

export default function AuthPanel() {
  const sp = useSearchParams();
  const router = useRouter();

  const initialMode = (sp.get('mode') || 'login') as 'login' | 'signup';
  const invitedEmail = sp.get('email') || '';
  const inviteToken = sp.get('token') || '';
  const projectId = sp.get('projectId') || '';

  const [mode, setMode] = useState<'login'|'signup'>(initialMode);

  // Shared fields
  const [email, setEmail] = useState(invitedEmail);
  const [password, setPassword] = useState('');

  // Signup-only fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [confirm, setConfirm] = useState('');
  const [otp, setOtp] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [info, setInfo] = useState<string|null>(null);

  const isInviteFlow = useMemo(() => Boolean(inviteToken && invitedEmail), [inviteToken, invitedEmail]);

  useEffect(() => {
    if (invitedEmail) setEmail(invitedEmail);
  }, [invitedEmail]);

  const switchMode = (next: 'login'|'signup') => {
    setMode(next);
    const params = new URLSearchParams(window.location.search);
    params.set('mode', next);
    if (invitedEmail) params.set('email', invitedEmail);
    if (inviteToken) params.set('token', inviteToken);
    if (projectId) params.set('projectId', projectId);
    const qs = params.toString();
    router.replace(`/?${qs}`);
    setError(null);
    setInfo(null);
  };

  const onCredentialsSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await signIn('credentials', { email, password, redirect: false });
      if (res?.ok) {
        if (isInviteFlow) {
          try {
            await fetch('/api/invites/accept', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: inviteToken, projectId }),
            });
          } catch (e) {
            console.error('Failed to accept invite post-login', e);
          }
        }
        window.location.href = '/dashboard';
      } else {
        setError(res?.error || 'Invalid email or password.');
      }
    } catch (e: any) {
      setError(e?.message || 'Sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const sendOtp = async () => {
    setError(null);
    setInfo(null);
    if (!email) return setError('Email required');
    setSendingOtp(true);
    try {
      const r = await fetch('/api/auth/otp/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Failed to send OTP');
      setInfo('OTP sent. Check your email.');
    } catch (e: any) {
      setError(e?.message || 'Failed to send OTP');
    } finally {
      setSendingOtp(false);
    }
  };

  const onSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (password.length < 6) return setError('Password must be at least 6 characters');
    if (password !== confirm) return setError('Passwords do not match');
    setLoading(true);
    try {
      const payload: any = { email, password, firstName, lastName };
      if (isInviteFlow) {
        payload.inviteToken = inviteToken;
        payload.projectId = projectId;
      } else {
        payload.requireOtp = true;
        payload.otpCode = otp;
      }
      const res = await fetch('/api/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Signup failed');

      const login = await signIn('credentials', { email, password, redirect: false });
      if (!login?.ok) throw new Error(login?.error || 'Auto login failed');

      if (isInviteFlow) {
        try {
          await fetch('/api/invites/accept', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: inviteToken, projectId }),
          });
        } catch (e) {
          console.error('Failed to accept invite post-signup', e);
        }
      }

      window.location.href = '/dashboard';
    } catch (e: any) {
      setError(e?.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-2xl border-0 flex flex-col items-center justify-center py-12 px-8 min-h-[540px]">
      {/* Logo */}
      <div className="mb-6 flex flex-col items-center">
        <span className="text-3xl font-bold text-black mb-2">Logo</span>
      </div>
      {/* Tab switch (kept subtle to preserve layout) */}
      <div className="w-full grid grid-cols-2 gap-2 mb-4">
        <button onClick={() => switchMode('login')} className={`h-10 rounded-md text-sm font-semibold border ${mode==='login' ? 'bg-black text-white border-black' : 'bg-white text-black border-gray-300 hover:bg-gray-50'}`}>Sign in</button>
        <button onClick={() => switchMode('signup')} className={`h-10 rounded-md text-sm font-semibold border ${mode==='signup' ? 'bg-black text-white border-black' : 'bg-white text-black border-gray-300 hover:bg-gray-50'}`}>Sign up</button>
      </div>

      {mode === 'login' ? (
        <div className="w-full">
          {/* Heading */}
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Sign into your account</h2>
          {/* Google Button */}
          <button
            type="button"
            onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
            className={`w-full flex items-center justify-center gap-3 h-12 bg-black text-white rounded-md font-semibold text-lg shadow transition-colors mb-8 mt-6 hover:bg-gray-900`}
          >
            <svg className="h-5 w-5" viewBox="0 0 48 48">
              <g>
                <path fill="#4285F4" d="M24 9.5c3.54 0 6.7 1.22 9.19 3.23l6.85-6.85C35.64 2.09 30.13 0 24 0 14.82 0 6.73 5.48 2.69 13.44l7.98 6.2C12.13 13.09 17.62 9.5 24 9.5z" />
                <path fill="#34A853" d="M46.1 24.55c0-1.64-.15-3.22-.42-4.74H24v9.01h12.42c-.54 2.9-2.18 5.36-4.66 7.01l7.19 5.6C43.98 37.09 46.1 31.27 46.1 24.55z" />
                <path fill="#FBBC05" d="M10.67 28.65A14.5 14.5 0 019.5 24c0-1.62.28-3.19.77-4.65l-7.98-6.2A23.97 23.97 0 000 24c0 3.77.9 7.34 2.49 10.49l8.18-5.84z" />
                <path fill="#EA4335" d="M24 48c6.13 0 11.28-2.03 15.04-5.52l-7.19-5.6c-2.01 1.35-4.59 2.15-7.85 2.15-6.38 0-11.87-3.59-14.33-8.69l-8.18 5.84C6.73 42.52 14.82 48 24 48z" />
                <path fill="none" d="M0 0h48v48H0z" />
              </g>
            </svg>
            Sign in with Google
          </button>

          {/* Divider */}
          <div className="relative w-full my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">or</span>
            </div>
          </div>

          {/* Email/password form */}
          <form onSubmit={onCredentialsSignIn} className="w-full">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email address</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className="mt-1 mb-3 block w-full rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-black h-11 px-3 bg-white text-gray-900 placeholder:text-gray-400 caret-black" required />
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="mt-1 mb-4 block w-full rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-black h-11 px-3 bg-white text-gray-900 placeholder:text-gray-400 caret-black" required />
            <button type="submit" disabled={loading} className={`w-full flex items-center justify-center gap-2 h-11 ${loading ? 'bg-gray-300 cursor-not-allowed' : 'bg-black hover:bg-gray-900 cursor-pointer'} text-white rounded-md font-semibold shadow-sm`}>{loading ? 'Signing in…' : 'Sign in'}</button>
          </form>
          {error && (
            <div className="text-sm text-red-600 mt-3" role="alert">{error}</div>
          )}

          {/* Terms and Privacy (kept from original) */}
          <div className="mt-8 text-xs text-gray-600 text-center max-w-xs">
            <span>
              By signing in, you agree to our
              <a href="/terms" className="text-black underline hover:text-blue-700 mx-1">Terms of Service</a>
              and
              <a href="/privacy" className="text-black underline hover:text-blue-700 mx-1">Privacy Policy</a>.
            </span>
            <div className="mt-2 text-gray-500">
              We value your privacy and use your information only to provide a secure and personalized experience.
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full">
          {/* Heading */}
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Create your account</h2>

          {/* Info banners */}
          {isInviteFlow && (
            <div className="text-sm text-blue-800 bg-blue-50 border border-blue-200 rounded p-2 mb-3">You are accepting an invitation for <b>{invitedEmail}</b>. Email is locked.</div>
          )}

          <form onSubmit={onSignup} className="w-full">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email address</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" disabled={isInviteFlow} className={`mt-1 mb-3 block w-full rounded-md shadow-sm focus:border-black focus:ring-black h-11 px-3 ${isInviteFlow ? 'bg-gray-100 text-gray-600 border-gray-300' : 'bg-white text-gray-900 border-gray-300 placeholder:text-gray-400 caret-black'}`} required />

            {!isInviteFlow && (
              <div className="mb-3">
                <div className="flex gap-2 items-center">
                  <button type="button" onClick={sendOtp} disabled={sendingOtp || !email} className={`px-3 h-9 rounded-md text-sm font-medium border ${sendingOtp ? 'bg-gray-200 text-gray-500 border-gray-300' : 'bg-white text-black border-gray-300 hover:bg-gray-50'}`}>{sendingOtp ? 'Sending OTP…' : 'Send OTP'}</button>
                  <span className="text-xs text-gray-500">We'll email you a 6‑digit code.</span>
                </div>
                <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mt-3">OTP</label>
                <input id="otp" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="6-digit code" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-black h-11 px-3 bg-white text-gray-900 placeholder:text-gray-400 caret-black" />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">First name</label>
                <input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-black h-11 px-3 bg-white text-gray-900 placeholder:text-gray-400 caret-black" />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">Last name</label>
                <input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-black h-11 px-3 bg-white text-gray-900 placeholder:text-gray-400 caret-black" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
                <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-black h-11 px-3 bg-white text-gray-900 placeholder:text-gray-400 caret-black" required />
              </div>
              <div>
                <label htmlFor="confirm" className="block text-sm font-medium text-gray-700">Confirm password</label>
                <input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-black h-11 px-3 bg-white text-gray-900 placeholder:text-gray-400 caret-black" required />
              </div>
            </div>

            {error && (<div className="text-sm text-red-600 mt-1" role="alert">{error}</div>)}
            {info && (<div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-2 mt-2" role="status">{info}</div>)}

            <button type="submit" disabled={loading} className={`mt-4 w-full flex items-center justify-center gap-2 h-11 ${loading ? 'bg-gray-300 cursor-not-allowed' : 'bg-black hover:bg-gray-900 cursor-pointer'} text-white rounded-md font-semibold shadow-sm`}>{loading ? 'Creating account…' : 'Create account'}</button>
          </form>
        </div>
      )}
    </div>
  );
}
