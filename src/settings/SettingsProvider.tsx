import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  applyThemeClass,
  isSoundEnabled,
  readThemePreference,
  resolveDarkMode,
  systemPrefersDark,
  toggledThemePreference,
  writeSoundEnabled,
  writeThemePreference,
} from '../lib/settings';
import { SettingsContext } from './settings-context';
import type { SettingsContextValue } from './settings-context';

/**
 * Holds the app settings, applies dark mode as a class on <html> (so the palette
 * override in index.css cascades app-wide), and persists every change. Dark mode
 * follows the system until the learner flips the toggle, which pins an explicit
 * choice. An inline script in index.html sets the initial class before paint, so
 * this only has to keep it in sync afterwards.
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [themePreference, setThemePreference] = useState(readThemePreference);
  const [soundEnabled, setSoundEnabledState] = useState(isSoundEnabled);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  // Track the OS scheme so a 'system' preference reacts to it live.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => setSystemDark(query.matches);
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);

  const isDark = resolveDarkMode(themePreference, systemDark);

  useEffect(() => {
    applyThemeClass(isDark);
  }, [isDark]);

  const value = useMemo<SettingsContextValue>(
    () => ({
      themePreference,
      isDark,
      soundEnabled,
      toggleDarkMode: () => {
        const next = toggledThemePreference(isDark);
        setThemePreference(next);
        writeThemePreference(next);
      },
      setSoundEnabled: (enabled: boolean) => {
        setSoundEnabledState(enabled);
        writeSoundEnabled(enabled);
      },
    }),
    [themePreference, isDark, soundEnabled],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
