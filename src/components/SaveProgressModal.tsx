import { useState } from 'react';
import type { FormEvent } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useAuth } from '../auth/auth-context';
import { getAuthErrorMessage } from '../lib/auth-errors';
import { Alert, Button, Input } from './ui';

/**
 * Upgrade a guest (anonymous) session into a permanent email/password account.
 * The link keeps the same uid, so the streak, XP, badges, and lesson history the
 * guest already built carry straight over instead of being stranded on one device.
 */
export default function SaveProgressModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  /** Called after a successful link so the caller can drop the guest banner. */
  onSaved: (displayName: string) => void;
}) {
  const { linkEmailPassword } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    const trimmedName = displayName.trim();
    if (trimmedName.length === 0 || trimmedName.length > 30) {
      setError('Enter a display name between 1 and 30 characters.');
      return;
    }
    try {
      setSubmitting(true);
      await linkEmailPassword(trimmedName, email, password);
      onSaved(trimmedName);
      onClose();
    } catch (linkError) {
      console.error('Save progress (link) error:', linkError);
      setError(getAuthErrorMessage(linkError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog.Root
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/60 motion-safe:animate-overlay-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 focus:outline-none">
          <div className="overflow-hidden rounded-2xl border-2 border-parchment-300 bg-parchment-50 shadow-2xl motion-safe:animate-dialog-in">
            <div className="bg-ink px-6 py-5 text-center">
              <Dialog.Title className="font-display text-2xl font-bold text-parchment-50">
                Save your progress
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-parchment-200">
                Add an email and password to keep this streak, XP, and progress and
                pick up on any device.
              </Dialog.Description>
            </div>

            <form className="space-y-4 px-6 py-5" onSubmit={handleSubmit}>
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
              <label className="block text-sm font-medium text-slate-700">
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
              <label className="block text-sm font-medium text-slate-700">
                Password
                <Input
                  className="mt-2"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={6}
                  required
                />
              </label>

              {error && <Alert variant="error">{error}</Alert>}

              <div className="flex flex-col gap-2">
                <Button type="submit" fullWidth disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save my progress'}
                </Button>
                <Dialog.Close asChild>
                  <Button type="button" variant="ghost" fullWidth disabled={submitting}>
                    Not now
                  </Button>
                </Dialog.Close>
              </div>
            </form>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
