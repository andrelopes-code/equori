import { Button } from "@slotted/react/button";
import { VisuallyHidden } from "@slotted/react/visually-hidden";
import { useRef } from "react";

import { useT } from "@/i18n/i18n-provider";

interface ImportButtonProps {
  loading: boolean;
  onFile: (file: File) => void;
}

// Opens the choice of an XLSX or CSV file; the input stays hidden.
export function ImportButton({ loading, onFile }: ImportButtonProps) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // The same file chosen twice still raises a change.
    event.target.value = "";
    if (file !== undefined) onFile(file);
  }

  return (
    <>
      <VisuallyHidden>
        <input
          ref={input}
          type="file"
          accept=".xlsx,.csv,.tsv,.txt"
          aria-label={t("spreadsheets.import.choose")}
          tabIndex={-1}
          onChange={handleChange}
        />
      </VisuallyHidden>

      <Button
        variant="outline"
        tone="secondary"
        loading={loading}
        onClick={() => input.current?.click()}
      >
        {t("spreadsheets.import")}
      </Button>
    </>
  );
}
