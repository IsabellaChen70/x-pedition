import type { ScaleItem, ScaleVisualConfig, ShapeKind } from '../types/lesson';

function cloneScaleConfig(config: ScaleVisualConfig): ScaleVisualConfig {
  return {
    left: config.left.map((item) => ({ ...item })),
    right: config.right.map((item) => ({ ...item })),
  };
}

/** Remove `value` pounds from each side (exact block on left; exact or subtract on right). */
export function removeWeightFromBothSides(
  config: ScaleVisualConfig,
  value: number,
): ScaleVisualConfig {
  const next = cloneScaleConfig(config);

  const leftIdx = next.left.findIndex((item) => item.kind === 'weight' && item.value === value);
  if (leftIdx >= 0) next.left.splice(leftIdx, 1);

  const rightExactIdx = next.right.findIndex((item) => item.kind === 'weight' && item.value === value);
  if (rightExactIdx >= 0) {
    next.right.splice(rightExactIdx, 1);
  } else {
    subtractWeightFromSide(next.right, value);
  }

  return next;
}

/** Remove weight from left side only (wrong-answer demo). */
export function removeWeightFromLeftOnly(
  config: ScaleVisualConfig,
  value: number,
): ScaleVisualConfig {
  const next = cloneScaleConfig(config);
  const leftIdx = next.left.findIndex((item) => item.kind === 'weight' && item.value === value);
  if (leftIdx >= 0) next.left.splice(leftIdx, 1);
  return next;
}

export function canApplyRemoveFromBoth(config: ScaleVisualConfig, value: number): boolean {
  const leftHas = config.left.some((i) => i.kind === 'weight' && i.value === value);
  if (!leftHas) return false;

  const rightWeights = config.right.filter((i): i is Extract<ScaleItem, { kind: 'weight' }> => i.kind === 'weight');
  if (rightWeights.some((i) => i.value === value)) return true;
  return rightWeights.reduce((sum, i) => sum + i.value, 0) >= value;
}

function subtractWeightFromSide(items: ScaleItem[], value: number): void {
  const idx = items.findIndex((i) => i.kind === 'weight' && i.value > value);
  if (idx < 0) {
    const exactIdx = items.findIndex((i) => i.kind === 'weight' && i.value === value);
    if (exactIdx >= 0) items.splice(exactIdx, 1);
    return;
  }
  const block = items[idx];
  if (block.kind !== 'weight') return;
  const remaining = block.value - value;
  if (remaining > 0) items[idx] = { kind: 'weight', value: remaining };
  else items.splice(idx, 1);
}

export function getUnknownValue(config: ScaleVisualConfig): number | null {
  const hasUnknownLeft = config.left.some((i) => i.kind === 'unknown');
  const hasUnknownRight = config.right.some((i) => i.kind === 'unknown');

  if (hasUnknownLeft && !hasUnknownRight) {
    const leftKnown = config.left
      .filter((i) => i.kind !== 'unknown')
      .reduce((sum, item) => sum + itemWeight(item), 0);
    return sumSide(config.right) - leftKnown;
  }

  if (hasUnknownRight && !hasUnknownLeft) {
    const rightKnown = config.right
      .filter((i) => i.kind !== 'unknown')
      .reduce((sum, item) => sum + itemWeight(item), 0);
    return sumSide(config.left) - rightKnown;
  }

  return null;
}

function sumSide(items: ScaleItem[]): number {
  return items.reduce((sum, item) => sum + itemWeight(item), 0);
}

function itemWeight(item: ScaleItem): number {
  if (item.kind === 'weight') return item.value;
  return 0;
}

export const SHAPE_COLORS: Record<ShapeKind, string> = {
  triangle: '#f59e0b',
  circle: '#8b5cf6',
  square: '#10b981',
  box: '#6366f1',
};

export function shapeLabel(shape: ShapeKind): string {
  return shape.charAt(0).toUpperCase() + shape.slice(1);
}
