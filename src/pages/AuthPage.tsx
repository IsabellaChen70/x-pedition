import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { getAuthErrorMessage } from '../lib/auth-errors';
import { Alert, Button, Input } from '../components/ui';

export default function AuthPage() {
  const { user, loading, signInWithEmail, signInWithGoogle, signUpWithEmail } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/';

  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate(from, { replace: true });
    }
  }, [from, loading, navigate, user]);

  const handleEmailSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

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

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4 py-8">
      <p className="font-display text-2xl font-bold tracking-tight text-ink">
        <span className="text-gold-600">X</span>-pedition
      </p>
      <h1 className="mt-2 text-3xl font-semibold text-slate-900">
        {mode === 'sign-up' ? 'Create your account' : 'Welcome back'}
      </h1>
      <p className="mt-2 text-muted">Sign in to save your progress and keep your lesson path.</p>

      <form
        className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
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

        {error && (
          <Alert variant="error" className="mt-4">
            {error}
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
            setMode((currentMode) => (currentMode === 'sign-up' ? 'sign-in' : 'sign-up'));
          }}
        >
          {mode === 'sign-up' ? 'Sign in' : 'Create account'}
        </button>
      </p>
    </div>
  );
}
