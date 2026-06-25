export const MASTERY_PASS_THRESHOLD = 2;
export const MASTERY_TOTAL = 3;

export function masteryPass(correctCount: number): boolean {
  return correctCount >= MASTERY_PASS_THRESHOLD;
}

export function countMasteryCorrect(
  stepIds: string[],
  results: Record<string, boolean>,
): number {
  return stepIds.filter((id) => results[id] === true).length;
}
