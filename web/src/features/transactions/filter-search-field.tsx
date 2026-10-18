import { useRef, useState } from "react";

import styles from "@/features/transactions/transaction-filter-bar.module.css";
import { useT } from "@/i18n/i18n-provider";

// Slotted families read: text-field and filter-bar. text-field draws a leading icon and a
// native clear glyph, and filter-bar draws the search with the "Filters" button; the ledger
// row wants a bare field and a "Clear" word, so the field is the application's own input.
export function FilterSearchField({
  query,
  onSubmit,
}: {
  query: string;
  onSubmit: (query: string) => void;
}) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(query);
  const [seen, setSeen] = useState(query);
  // The URL query wins when it changes from outside the field.
  if (seen !== query) {
    setSeen(query);
    setDraft(query);
  }
  return (
    <div className={styles.field} data-filled={draft === "" ? undefined : ""}>
      <input
        ref={input}
        type="search"
        className={styles.input}
        aria-label={t("transactions.search")}
        placeholder={t("transactions.search")}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          onSubmit(draft);
        }}
      />
      {draft !== "" && (
        <button
          type="button"
          className={styles.clear}
          onClick={() => {
            setDraft("");
            onSubmit("");
            input.current?.focus();
          }}
        >
          {t("transactions.filter.clear")}
        </button>
      )}
    </div>
  );
}
