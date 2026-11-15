// Each tool of a turn once, in the order of its last call, so the running step stays last (P5).
export function distinctSteps(steps: readonly string[]): string[] {
  return steps.filter((step, i) => !steps.includes(step, i + 1));
}
