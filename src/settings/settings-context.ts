import { createContext, useContext } from 'react';
import type { ThemePreference } from '../lib/settings';

export type SettingsContextValue = {
  /** The saved preference: 'system', or an explicit 'light' / 'dark' override. */
  themePreference: ThemePreference;
  /** The effective dark state (preference resolved against the system). */
  isDark: boolean;
  soundEnabled: boolean;
  /** Flip dark mode on/off, pinning an explicit preference that overrides system. */
  toggleDarkMode: () => void;
  setSoundEnabled: (enabled: boolean) => void;
};

export const SettingsContext = createContext<SettingsContextValue | null>(null);

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used inside SettingsProvider');
  }
  return context;
}
