import { Button } from "@slotted/react/button";
import { VisuallyHidden } from "@slotted/react/visually-hidden";
import { useRef } from "react";

import { useT } from "@/i18n/i18n-provider";

interface ArchiveFileButtonProps {
  onFile: (file: File) => void;
  loading: boolean;
  disabled?: boolean;
  tone: "secondary" | "danger";
}

// A button that opens the file choice of an export archive; the input stays hidden.
export function ArchiveFileButton({
  onFile,
  loading,
  disabled = false,
  tone,
}: ArchiveFileButtonProps) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file !== undefined) onFile(file);
  };

  return (
    <div>
      <VisuallyHidden>
        <input
          ref={input}
          type="file"
          accept="application/zip,.zip"
          aria-label={t("import.choose")}
          disabled={disabled}
          onChange={handleChange}
        />
      </VisuallyHidden>

      <Button
        size="sm"
        variant={tone === "danger" ? "solid" : "outline"}
        tone={tone}
        loading={loading}
        disabled={disabled}
        onClick={() => input.current?.click()}
      >
        {t("import.choose")}
      </Button>
    </div>
  );
}
