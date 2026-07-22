import * as Dialog from '@radix-ui/react-dialog';
import { useSettings } from '../settings/settings-context';
import { Button } from './ui';

/** The settings panel: dark mode and celebration sound, both persisted. */
export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const { isDark, toggleDarkMode, soundEnabled, setSoundEnabled } = useSettings();

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
                Settings
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-parchment-200">
                Tune how X-pedition looks and sounds.
              </Dialog.Description>
            </div>

            <div className="space-y-3 px-6 py-5">
              <SettingRow
                title="Dark mode"
                description="Softer, low-light colors across the app."
                checked={isDark}
                onToggle={toggleDarkMode}
              />
              <SettingRow
                title="Celebration sounds"
                description="A quiet chime when you finish something."
                checked={soundEnabled}
                onToggle={() => setSoundEnabled(!soundEnabled)}
              />
              <Dialog.Close asChild>
                <Button fullWidth>Done</Button>
              </Dialog.Close>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SettingRow({
  title,
  description,
  checked,
  onToggle,
}: {
  title: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-parchment-300 bg-parchment-100 px-4 py-3">
      <div className="min-w-0">
        <p className="font-display text-base font-bold text-ink">{title}</p>
        <p className="text-sm text-muted">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        onClick={onToggle}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment-100 ${
          checked ? 'bg-brand-600' : 'bg-parchment-300'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-[#fbf7ee] shadow transition ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}
