export function getAuthErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code)
    : '';

  switch (code) {
    case 'auth/email-already-in-use':
      return 'That email already has an account. Try signing in instead.';
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'Email or password was not correct.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Google sign-in was closed before it finished. Try again.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in popup. Allow popups for this site, then try again.';
    case 'auth/unauthorized-domain':
      return 'This web address is not approved for sign-in yet. Add it in Firebase Authentication settings.';
    case 'auth/operation-not-allowed':
      return 'Google sign-in is not turned on for this app yet.';
    case 'auth/account-exists-with-different-credential':
      return 'That email already has an account with a different sign-in method.';
    case 'auth/network-request-failed':
      return 'Network problem. Check your connection, then try again.';
    case 'auth/weak-password':
      return 'Use a password with at least 6 characters.';
    case 'auth/too-many-requests':
      return 'Too many tries. Wait a moment, then try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
