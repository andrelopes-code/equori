import type { components } from "@/api/schema.gen";

type Preview = components["schemas"]["AssistantPreview"];
type Change = Preview["changes"][number];

// The change of one field, the first when a preview names it twice.
export function changeOf(preview: Preview, field: string): Change | undefined {
  return preview.changes.find((change) => change.field === field);
}

// The changes a body does not draw itself; they stay as field rows.
export function changesWithout(
  preview: Preview,
  fields: readonly string[],
): Change[] {
  return preview.changes.filter((change) => !fields.includes(change.field));
}
