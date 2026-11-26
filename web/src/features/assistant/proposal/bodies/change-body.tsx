import type { components } from "@/api/schema.gen";
import styles from "@/features/assistant/proposal/bodies/bodies.module.css";
import { DiffRows } from "@/features/assistant/proposal/bodies/diff-rows";
import { ItemRows } from "@/features/assistant/proposal/bodies/item-rows";

type Preview = components["schemas"]["AssistantPreview"];

interface ChangeBodyProps {
  preview: Preview;
}

// A change without a body of its own: the records it touches, then each value before → after.
export function ChangeBody({ preview }: ChangeBodyProps) {
  const items = preview.items ?? [];

  return (
    <div className={styles.body}>
      {items.length > 0 && <ItemRows role="existing" items={items} />}
      <DiffRows changes={preview.changes} />
    </div>
  );
}
