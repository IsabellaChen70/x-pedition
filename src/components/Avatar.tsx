import type { AvatarId } from '../lib/cosmetics';

type AvatarProps = {
  id: AvatarId;
  className?: string;
};

/**
 * Renders the equipped companion. Kept as flat vector shapes in the app's
 * palette so it sits on the parchment map without clashing. `none` renders
 * nothing (the caller shows the default trail flag instead).
 */
export default function Avatar({ id, className }: AvatarProps) {
  if (id === 'explorer') {
    return <ExplorerAvatar className={className} />;
  }
  if (id === 'parrot') {
    return <ParrotAvatar className={className} />;
  }
  return null;
}

function ExplorerAvatar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <ellipse cx="24" cy="44.5" rx="10" ry="2.2" fill="rgba(50,38,25,0.18)" />
      {/* Jacket shoulders */}
      <path
        d="M13 45v-5a11 11 0 0 1 22 0v5z"
        fill="#3f7d3a"
        stroke="#2f5a2a"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* Neckerchief */}
      <path d="M19 38h10l-5 5z" fill="#c45f2c" stroke="#8a3e1f" strokeWidth="1.2" strokeLinejoin="round" />
      {/* Face */}
      <circle cx="24" cy="23" r="9" fill="#f2c79a" stroke="#b0784a" strokeWidth="1.6" />
      {/* Hat brim + dome */}
      <ellipse cx="24" cy="15.5" rx="15" ry="4.1" fill="#e3cd96" stroke="#a06713" strokeWidth="1.6" />
      <path
        d="M15.5 15.5a8.5 6 0 0 1 17 0z"
        fill="#e3cd96"
        stroke="#a06713"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <rect x="15.5" y="13.6" width="17" height="2.4" rx="1.2" fill="#a94c22" />
      {/* Eyes + smile */}
      <circle cx="20.6" cy="23.2" r="1.2" fill="#322619" />
      <circle cx="27.4" cy="23.2" r="1.2" fill="#322619" />
      <path
        d="M20.8 27q3.2 2.2 6.4 0"
        fill="none"
        stroke="#8a3e1f"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ParrotAvatar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <ellipse cx="25" cy="44.5" rx="9" ry="2.2" fill="rgba(50,38,25,0.18)" />
      {/* Tail */}
      <path
        d="M26 30l-3 14 8-2z"
        fill="#f6c34c"
        stroke="#a06713"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      {/* Body */}
      <ellipse cx="26" cy="27" rx="9.5" ry="11" fill="#c45f2c" stroke="#8a3e1f" strokeWidth="1.6" />
      {/* Belly */}
      <ellipse cx="28" cy="29" rx="5" ry="7.5" fill="#f2b34a" />
      {/* Wing */}
      <path
        d="M20 20q-6 6 0 16q5-2 5-9z"
        fill="#3f7d3a"
        stroke="#2f5a2a"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Head */}
      <circle cx="23" cy="15" r="8" fill="#c45f2c" stroke="#8a3e1f" strokeWidth="1.6" />
      {/* Crest */}
      <path d="M23 6q3 1 2 5-2-1-4 0 1-4 2-5z" fill="#f6c34c" stroke="#a06713" strokeWidth="1.1" />
      {/* Face patch + eye */}
      <circle cx="22" cy="14.5" r="4.4" fill="#fdf8ec" />
      <circle cx="21.5" cy="14.5" r="1.6" fill="#322619" />
      {/* Hooked beak */}
      <path
        d="M15 14q-5 0-4 4 0 3 4 2c-1-1-1-2 0-3-2 0-2-2 0-3z"
        fill="#f6c34c"
        stroke="#a06713"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}
