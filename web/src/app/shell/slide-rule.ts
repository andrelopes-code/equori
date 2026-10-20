// The current destination's rule slides from the link that held it to the
// newly selected one. Both links are measured while the layout is clean, before and right
// after the selection commits, so the slide forces no layout of the page.
export function slideRule(
  list: HTMLElement | null,
  target: HTMLAnchorElement,
  select: () => void,
) {
  const from = list?.querySelector<HTMLElement>("[data-selected]") ?? null;
  const start =
    from === null || from === target
      ? null
      : { left: from.offsetLeft, width: from.offsetWidth };
  select();
  if (
    start === null ||
    !target.hasAttribute("data-selected") ||
    typeof target.animate !== "function" ||
    matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return;
  }
  const shift = start.left - target.offsetLeft;
  const scale = start.width / target.offsetWidth;
  target.animate(
    [
      { transform: `translateX(${String(shift)}px) scaleX(${String(scale)})` },
      { transform: "none" },
    ],
    // --slotted-duration-medium and --slotted-easing-standard; an animation takes no var().
    {
      duration: 200,
      easing: "cubic-bezier(0.2, 0, 0, 1)",
      pseudoElement: "::after",
    },
  );
}
