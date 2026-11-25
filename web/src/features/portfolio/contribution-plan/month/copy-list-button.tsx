import { Button } from "@slotted/react/button";
import { Inline } from "@slotted/react/inline";
import { Text } from "@slotted/react/typography";
import { useRef, useState } from "react";

import { useT } from "@/i18n/i18n-provider";
import { copyText } from "@/ui/runtime/copy-text";

interface CopyListButtonProps {
  text: string;
  disabled: boolean;
}

const confirmationMs = 2000;

// "Copy list": the plain-text copy of the purchases and its confirmation or failure in words.
export function CopyListButton({ text, disabled }: CopyListButtonProps) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const host = useRef<HTMLDivElement>(null);

  function handleCopy() {
    if (host.current === null) return;

    setFailed(false);
    copyText(text, host.current)
      .then(() => {
        setCopied(true);
        setTimeout(() => {
          setCopied(false);
        }, confirmationMs);
      })
      .catch(() => {
        setFailed(true);
      });
  }

  return (
    <div ref={host}>
      <Inline gap={4} align="center" wrap="nowrap">
        {failed && (
          <Text size="xs" tone="muted">
            {t("contributionPlan.copyFailed")}
          </Text>
        )}

        <Button
          size="sm"
          variant="ghost"
          tone="secondary"
          disabled={disabled}
          onClick={handleCopy}
        >
          {copied ? t("contributionPlan.copied") : t("contributionPlan.copy")}
        </Button>
      </Inline>
    </div>
  );
}
