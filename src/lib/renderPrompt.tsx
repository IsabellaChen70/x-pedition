import type { ReactNode } from 'react';

/** Renders `**bold**` segments in lesson prompts. */
export function renderPrompt(text: string): ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/);
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <strong key={index} className="font-semibold text-slate-900">
        {part}
      </strong>
    ) : (
      <span key={index}>{part}</span>
    ),
  );
}
