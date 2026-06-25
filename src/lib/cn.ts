export type ClassValue = string | false | null | undefined;

/** Join conditional class names, dropping falsy values. */
export function cn(...parts: ClassValue[]): string {
  return parts.filter(Boolean).join(' ');
}
