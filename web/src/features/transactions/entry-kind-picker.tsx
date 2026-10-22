import { useId } from "react";

import type { EntryKind } from "@/features/transactions/entry-kind";
import { EntryKindGlyph } from "@/features/transactions/entry-kind-glyph";
import styles from "@/features/transactions/entry-kind-picker.module.css";
import type { MessageKey } from "@/i18n/catalog.en";
import { useT } from "@/i18n/i18n-provider";

const kinds: {
  value: EntryKind;
  label: MessageKey;
  hint: MessageKey;
}[] = [
  {
    value: "expense",
    label: "entry.kind.expense",
    hint: "entry.kindHint.expense",
  },
  {
    value: "income",
    label: "entry.kind.income",
    hint: "entry.kindHint.income",
  },
  {
    value: "transfer",
    label: "entry.kind.transfer",
    hint: "entry.kindHint.transfer",
  },
  {
    value: "advanced",
    label: "entry.kind.advanced",
    hint: "entry.kindHint.advanced",
  },
];

// Families read: segmented-control, radio-group, toggle-group. The kind decides what the whole
// entry means, so it is the form's first and strongest choice: each kind is a tile in its own
// tone (money out in danger, money in in success, a transfer in accent) with a glyph and a hint,
// which no family paints per option. Native radios that share a name give the group its arrow
// keys and its single tab stop.
export function EntryKindPicker({
  value,
  onChange,
}: {
  value: EntryKind;
  onChange: (kind: EntryKind) => void;
}) {
  const t = useT();
  const id = useId();
  return (
    <div className={styles.frame}>
      <div
        role="radiogroup"
        aria-label={t("entry.kind")}
        className={styles.kinds}
      >
        {kinds.map((kind) => (
          <label
            key={kind.value}
            className={styles.kind}
            data-kind={kind.value}
          >
            <input
              type="radio"
              name="entry-kind"
              value={kind.value}
              className={styles.radio}
              checked={kind.value === value}
              aria-labelledby={`${id}-${kind.value}`}
              aria-describedby={`${id}-${kind.value}-hint`}
              onChange={() => {
                onChange(kind.value);
              }}
            />
            <span className={styles.glyph}>
              <EntryKindGlyph kind={kind.value} />
            </span>
            <span className={styles.text}>
              <span id={`${id}-${kind.value}`} className={styles.label}>
                {t(kind.label)}
              </span>
              <span id={`${id}-${kind.value}-hint`} className={styles.hint}>
                {t(kind.hint)}
              </span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
