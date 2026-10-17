import { Button } from "@slotted/react/button";
import { TextField } from "@slotted/react/text-field";
import { useState } from "react";
import type { SubmitEvent } from "react";

import styles from "@/features/transactions/transactions-page.module.css";
import { useT } from "@/i18n/i18n-provider";

const maxQueryLength = 100;

export function SearchForm({
  q,
  onSubmit,
}: {
  q: string | undefined;
  onSubmit: (q: string) => void;
}) {
  const t = useT();
  const [value, setValue] = useState(q ?? "");
  // The URL owns the query: a change made elsewhere (a removed tag) replaces the typed text.
  const [seen, setSeen] = useState(q);
  if (seen !== q) {
    setSeen(q);
    setValue(q ?? "");
  }
  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(value);
  };
  return (
    <form role="search" className={styles.search} onSubmit={submit}>
      <TextField
        type="search"
        maxLength={maxQueryLength}
        value={value}
        onValueChange={setValue}
        aria-label={t("transactions.search")}
      />
      <Button type="submit" tone="secondary" variant="outline">
        {t("transactions.search.submit")}
      </Button>
    </form>
  );
}
