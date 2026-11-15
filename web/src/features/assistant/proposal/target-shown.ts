import type { components } from "@/api/schema.gen";

type Preview = components["schemas"]["AssistantPreview"];

// The target is a name a typed body already draws (an item's description or a change's value), so
// the row does not write it twice (spec 2026-11-15, section 7).
export function targetShownElsewhere(preview: Preview): boolean {
  const { target } = preview;
  if (target === undefined) return false;

  const items = preview.items ?? [];
  const inItems = items.some((item) => item.description === target);
  const inChanges = preview.changes.some(
    (change) => change.after?.text === target || change.before?.text === target,
  );

  return inItems || inChanges;
}
