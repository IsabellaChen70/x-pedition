/**
 * User-facing app settings: dark mode and celebration sound. The pure resolution
 * lives here (testable in node), separate from the React provider that applies it
 * and the localStorage that persists it.
 *
 * Dark mode follows the system by default and is overridden the moment the learner
 * flips the toggle; that choice persists. It is implemented as a class on <html>
 * (see index.css), so it cascades app-wide over the CSS-variable palette while
 * leaving the unlockable map themes (which paint the map itself) untouched.
 */

/** 'system' follows prefers-color-scheme; 'light'/'dark' are explicit overrides. */
export type ThemePreference = 'system' | 'light' | 'dark';

export const THEME_STORAGE_KEY = 'xp_theme_pref';
export const SOUND_STORAGE_KEY = 'xp_sound_enabled';

/** Resolve the effective dark mode from the saved preference + the system state. */
export function resolveDarkMode(pref: ThemePreference, systemPrefersDark: boolean): boolean {
  if (pref === 'dark') return true;
  if (pref === 'light') return false;
  return systemPrefersDark;
}

/**
 * The explicit preference to store when the learner flips the toggle: it pins the
 * opposite of whatever is showing now, so one tap always overrides the system.
 */
export function toggledThemePreference(isDarkNow: boolean): ThemePreference {
  return isDarkNow ? 'light' : 'dark';
}

/** Parse a stored theme preference defensively; anything unexpected is 'system'. */
export function parseThemePreference(value: unknown): ThemePreference {
  return value === 'dark' || value === 'light' || value === 'system' ? value : 'system';
}

/** Parse a stored sound flag; sound is OFF unless explicitly enabled. */
export function parseSoundEnabled(value: unknown): boolean {
  return value === 'true' || value === true;
}

/** Whether the OS currently prefers a dark color scheme (false outside a browser). */
export function systemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

export function readThemePreference(): ThemePreference {
  if (typeof localStorage === 'undefined') return 'system';
  return parseThemePreference(localStorage.getItem(THEME_STORAGE_KEY));
}

export function writeThemePreference(pref: ThemePreference): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(THEME_STORAGE_KEY, pref);
}

/** Read the persisted sound preference. Used by the sound util at play time. */
export function isSoundEnabled(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return parseSoundEnabled(localStorage.getItem(SOUND_STORAGE_KEY));
}

export function writeSoundEnabled(enabled: boolean): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(SOUND_STORAGE_KEY, enabled ? 'true' : 'false');
}

/** Toggle the `dark` class on <html> so the palette override cascades app-wide. */
export function applyThemeClass(isDark: boolean): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', isDark);
}
