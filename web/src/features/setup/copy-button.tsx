import { Button } from "@slotted/react/button";
import { useEffect, useState } from "react";

import { useT } from "@/i18n/i18n-provider";

interface CopyButtonProps {
  text: string;
  label: string;
}

const CONFIRMATION_MS = 2000;

export function CopyButton({ text, label }: CopyButtonProps) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => {
      setCopied(false);
    }, CONFIRMATION_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [copied]);

  const handleCopy = () => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
      })
      .catch(() => {
        setCopied(false);
      });
  };

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      tone="secondary"
      onClick={handleCopy}
    >
      {copied ? t("security.copied") : label}
    </Button>
  );
}
