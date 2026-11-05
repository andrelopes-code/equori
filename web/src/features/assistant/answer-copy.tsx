import { MessageActions, MessageFooter } from "@slotted/react/message";
import { Glyph, Icon } from "@slotted/react/icon";
import { IconButton } from "@slotted/react/button";
import { useState, type MouseEvent } from "react";

import { copyText } from "@/ui/copy-text";
import { maskAmountText } from "@/features/assistant/mask-amounts";
import { useT } from "@/i18n/i18n-provider";
import { usePrivacy } from "@/privacy/privacy-provider";

interface AnswerCopyProps {
  // The answer's Markdown.
  content: string;
}

export function AnswerCopy({ content }: AnswerCopyProps) {
  const t = useT();
  const { hidden } = usePrivacy();
  const [copied, setCopied] = useState(false);

  function handleCopy(event: MouseEvent<HTMLButtonElement>) {
    // P21: the answer's Markdown, masked like the screen while privacy is on.
    const text = hidden ? maskAmountText(content) : content;

    const button = event.currentTarget;

    copyText(text, button.parentElement ?? button).then(
      () => {
        setCopied(true);
        setTimeout(() => {
          setCopied(false);
        }, 2000);
      },
      () => {
        // A refused write leaves the label as it was.
      },
    );
  }

  return (
    <MessageFooter>
      <MessageActions>
        <IconButton
          aria-label={t(copied ? "assistant.copied" : "assistant.copy")}
          variant="ghost"
          size="sm"
          onClick={handleCopy}
        >
          <Icon>
            <Glyph name={copied ? "check" : "copy"} />
          </Icon>
        </IconButton>
      </MessageActions>
    </MessageFooter>
  );
}
