import { Button } from "@slotted/react/button";
import { useEffect, useRef, useState } from "react";

import { copyText } from "@/features/setup/copy-text";
import { useT } from "@/i18n/i18n-provider";

interface CopyButtonProps {
  text: string;
  label: string;
}

const CONFIRMATION_MS = 2000;

export function CopyButton({ text, label }: CopyButtonProps) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const wrapper = useRef<HTMLSpanElement>(null);

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
    if (wrapper.current === null) return;
    copyText(text, wrapper.current)
      .then(() => {
        setFailed(false);
        setCopied(true);
      })
      .catch(() => {
        setFailed(true);
      });
  };

  return (
    <span ref={wrapper}>
      <Button
        type="button"
        size="sm"
        variant="outline"
        tone={failed ? "danger" : "secondary"}
        onClick={handleCopy}
      >
        {failed && t("security.copyFailed")}
        {!failed && copied && t("security.copied")}
        {!failed && !copied && label}
      </Button>
    </span>
  );
}
