import type { VisualConfig } from '../types/lesson';
import BalanceScale from './BalanceScale';

type ScaleVisualProps = {
  visual?: VisualConfig;
  balanced?: boolean;
};

export default function ScaleVisual({ visual, balanced = true }: ScaleVisualProps) {
  if (!visual || visual.type !== 'scale') return null;

  return (
    <div className="my-6 rounded-2xl border border-slate-200 bg-white p-4">
      <BalanceScale config={visual.config} balanced={balanced} />
    </div>
  );
}
