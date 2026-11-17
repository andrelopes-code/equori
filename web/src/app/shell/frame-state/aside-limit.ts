// The compact size class starts below it; no desktop-only route has a layout for less.
const PAGE_MIN_EXTENT = 600;

// The largest share of the shell the pane beside the page may take while the page keeps 600 px,
// held between the pane's smallest share and the family's largest. `room` is the width the page
// and the pane share. Rounded down to a hundredth, so a drag does not change it.
export function asideLimit(
  shell: number,
  room: number,
  min: number,
  max: number,
): number {
  if (shell <= 0) return min;

  const share = Math.floor(((room - PAGE_MIN_EXTENT) / shell) * 100) / 100;

  return Math.min(max, Math.max(min, share));
}
