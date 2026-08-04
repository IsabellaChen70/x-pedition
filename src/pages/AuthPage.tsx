import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { getAuthErrorMessage } from '../lib/auth-errors';
import { Alert, Button, Input } from '../components/ui';

// A prefilled demo account so a reviewer can see a populated app in one tap. The
// account itself is created once in the Firebase project (see README "Try it").
const DEMO_EMAIL = 'demo@x-pedition.app';
const DEMO_PASSWORD = 'xpedition-demo';

export default function AuthPage() {
  const {
    user,
    loading,
    signInWithEmail,
    signInWithGoogle,
    signInAsGuest,
    signUpWithEmail,
    resetPassword,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/';

  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [guestError, setGuestError] = useState('');
  const [demoError, setDemoError] = useState('');
  const [info, setInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate(from, { replace: true });
    }
  }, [from, loading, navigate, user]);

  const handleEmailSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setInfo('');
    setGuestError('');
    setDemoError('');

    const trimmedName = displayName.trim();
    if (mode === 'sign-up' && (trimmedName.length === 0 || trimmedName.length > 30)) {
      setError('Enter a display name between 1 and 30 characters.');
      return;
    }

    try {
      setSubmitting(true);
      if (mode === 'sign-up') {
        await signUpWithEmail(trimmedName, email, password);
      } else {
        await signInWithEmail(email, password);
      }
      navigate(from, { replace: true });
    } catch (authError) {
      console.error('Auth error:', authError);
      setError(getAuthErrorMessage(authError));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setInfo('');
    setGuestError('');
    setDemoError('');
    try {
      setSubmitting(true);
      await signInWithGoogle();
      navigate(from, { replace: true });
    } catch (authError) {
      console.error('Auth error:', authError);
      setError(getAuthErrorMessage(authError));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGuestSignIn = async () => {
    setGuestError('');
    setDemoError('');
    setError('');
    setInfo('');
    try {
      setSubmitting(true);
      await signInAsGuest();
      navigate(from, { replace: true });
    } catch (authError) {
      console.error('Auth error:', authError);
      const code =
        typeof authError === 'object' && authError !== null && 'code' in authError
          ? String((authError as { code: unknown }).code)
          : '';
      // If guest sessions are off, keep the learner in-screen: the demo button and
      // the account form right below are both working fallbacks, so no dead end.
      if (code === 'auth/operation-not-allowed' || code === 'auth/admin-restricted-operation') {
        setGuestError(
          'Guest sign-in is not available right now. Try the demo account, or make your own below to jump in.',
        );
      } else {
        setGuestError(getAuthErrorMessage(authError));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoSignIn = async () => {
    setGuestError('');
    setDemoError('');
    setError('');
    setInfo('');
    try {
      setSubmitting(true);
      await signInWithEmail(DEMO_EMAIL, DEMO_PASSWORD);
      navigate(from, { replace: true });
    } catch (authError) {
      console.error('Demo sign-in error:', authError);
      setDemoError(
        'The demo account is not reachable right now. Continue as a guest, or create your own account below.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    setError('');
    setInfo('');
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Enter your email above, then tap "Forgot password?" to get a reset link.');
      return;
    }
    try {
      setSubmitting(true);
      await resetPassword(trimmedEmail);
      // Neutral wording so the form never discloses whether an email is registered.
      setInfo(`If an account exists for ${trimmedEmail}, a password reset link is on its way.`);
    } catch (authError) {
      console.error('Password reset error:', authError);
      setError(getAuthErrorMessage(authError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4 py-8">
      <p className="font-display text-2xl font-bold tracking-tight text-ink">
        <span className="text-gold-600">X</span>-pedition
      </p>
      <h1 className="mt-2 text-3xl font-semibold text-slate-900">
        {mode === 'sign-up' ? 'Create your account' : 'Welcome back'}
      </h1>
      <p className="mt-2 text-muted">
        Jump straight in as a guest, or sign in to keep your progress across devices.
      </p>

      <div className="mt-8 space-y-4">
        <div>
          <Button fullWidth disabled={submitting} onClick={handleGuestSignIn}>
            Continue as guest
          </Button>
          <p className="mt-2 text-center text-xs text-muted">
            Explore the whole app right away with a throwaway account. No email needed.
          </p>
          {guestError && (
            <Alert variant="error" className="mt-3">
              {guestError}
            </Alert>
          )}
        </div>
        <div>
          <Button variant="secondary" fullWidth disabled={submitting} onClick={handleDemoSignIn}>
            Try the demo
          </Button>
          <p className="mt-2 text-center text-xs text-muted">
            Sign in to a ready-made account with a streak, XP, and finished lessons.
          </p>
          {demoError && (
            <Alert variant="error" className="mt-3">
              {demoError}
            </Alert>
          )}
        </div>
      </div>

      <div className="my-6 flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-muted">
        <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
        or sign in
        <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
      </div>

      <form
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        onSubmit={handleEmailSubmit}
      >
        {mode === 'sign-up' && (
          <label className="block text-sm font-medium text-slate-700">
            Display name
            <Input
              className="mt-2"
              maxLength={30}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Your name"
              required
            />
          </label>
        )}

        <label className="mt-4 block text-sm font-medium text-slate-700">
          Email
          <Input
            className="mt-2"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        <label className="mt-4 block text-sm font-medium text-slate-700">
          Password
          <Input
            className="mt-2"
            type="password"
            autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={6}
            required
          />
        </label>

        {mode === 'sign-in' && (
          <div className="mt-2 text-right">
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleForgotPassword()}
              className="text-xs font-medium text-brand-600 underline-offset-2 hover:underline disabled:opacity-50"
            >
              Forgot password?
            </button>
          </div>
        )}

        {error && (
          <Alert variant="error" className="mt-4">
            {error}
          </Alert>
        )}

        {info && (
          <Alert variant="info" className="mt-4">
            {info}
          </Alert>
        )}

        <Button type="submit" fullWidth disabled={submitting} className="mt-5">
          {submitting ? 'Please wait...' : mode === 'sign-up' ? 'Create account' : 'Sign in'}
        </Button>

        <Button
          variant="secondary"
          fullWidth
          disabled={submitting}
          className="mt-3"
          onClick={handleGoogleSignIn}
        >
          Continue with Google
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        {mode === 'sign-up' ? 'Already have an account?' : 'New here?'}{' '}
        <button
          type="button"
          className="font-medium text-brand-600 underline-offset-2 hover:underline"
          onClick={() => {
            setError('');
            setInfo('');
            setGuestError('');
            setDemoError('');
            setMode((currentMode) => (currentMode === 'sign-up' ? 'sign-in' : 'sign-up'));
          }}
        >
          {mode === 'sign-up' ? 'Sign in' : 'Create account'}
        </button>
      </p>
    </div>
  );
}
