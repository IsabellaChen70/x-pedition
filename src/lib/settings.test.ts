import { describe, expect, it } from 'vitest';
import {
  parseSoundEnabled,
  parseThemePreference,
  resolveDarkMode,
  toggledThemePreference,
} from './settings';

describe('resolveDarkMode', () => {
  it('follows the system when the preference is "system"', () => {
    expect(resolveDarkMode('system', true)).toBe(true);
    expect(resolveDarkMode('system', false)).toBe(false);
  });

  it('lets an explicit preference override the system', () => {
    expect(resolveDarkMode('dark', false)).toBe(true);
    expect(resolveDarkMode('light', true)).toBe(false);
  });
});

describe('toggledThemePreference', () => {
  it('pins the opposite explicit mode so one tap overrides the system', () => {
    expect(toggledThemePreference(true)).toBe('light');
    expect(toggledThemePreference(false)).toBe('dark');
  });
});

describe('parseThemePreference', () => {
  it('accepts the known values', () => {
    expect(parseThemePreference('dark')).toBe('dark');
    expect(parseThemePreference('light')).toBe('light');
    expect(parseThemePreference('system')).toBe('system');
  });

  it('falls back to "system" for anything else', () => {
    expect(parseThemePreference(null)).toBe('system');
    expect(parseThemePreference('bogus')).toBe('system');
    expect(parseThemePreference(undefined)).toBe('system');
  });
});

describe('parseSoundEnabled', () => {
  it('is off unless explicitly enabled', () => {
    expect(parseSoundEnabled(null)).toBe(false);
    expect(parseSoundEnabled('false')).toBe(false);
    expect(parseSoundEnabled(undefined)).toBe(false);
  });

  it('reads an enabled flag from string or boolean', () => {
    expect(parseSoundEnabled('true')).toBe(true);
    expect(parseSoundEnabled(true)).toBe(true);
  });
});
