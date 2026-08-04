import { createContext, useContext } from 'react';
import type { User } from 'firebase/auth';

export type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (displayName: string, email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  /** Anonymous sign-in for a throwaway demo session (no email/password). */
  signInAsGuest: () => Promise<void>;
  /**
   * Upgrade the current anonymous (guest) session to a permanent email/password
   * account. Uses linkWithCredential, so the uid is preserved and all saved
   * progress carries over. Throws if there is no anonymous user to upgrade.
   */
  linkEmailPassword: (displayName: string, email: string, password: string) => Promise<void>;
  /** Send a password-reset email so a returning account holder can get back in. */
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
