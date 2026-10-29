import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
  AlertTitle,
} from "@slotted/react/alert";
import { Button } from "@slotted/react/button";
import { useNavigate } from "@tanstack/react-router";

import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface BlockedNoticeProps {
  // When the quota frees again; absent, the assistant is not set up.
  retryAt: string | undefined;
  onClose: () => void;
}

// Why the chat accepts no question: the quota ran out, or no provider is set up.
export function BlockedNotice({ retryAt, onClose }: BlockedNoticeProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const navigate = useNavigate();

  function openSettings(section: "assistant" | "external_access") {
    onClose();
    void navigate({ to: "/settings", search: { section } });
  }

  if (retryAt !== undefined) {
    const time = new Intl.DateTimeFormat(locale, {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(retryAt));

    return (
      <Alert tone="warning" live="polite">
        <AlertContent>
          <AlertTitle>{t("assistant.exhausted.title")}</AlertTitle>
          <AlertDescription>
            {t("assistant.exhausted", { time })}
          </AlertDescription>
        </AlertContent>
      </Alert>
    );
  }

  return (
    <Alert tone="info" live="polite">
      <AlertContent>
        <AlertTitle>{t("assistant.unavailable.title")}</AlertTitle>
        <AlertDescription>{t("assistant.unavailable.body")}</AlertDescription>
      </AlertContent>

      <AlertActions>
        <Button
          variant="ghost"
          onClick={() => {
            openSettings("assistant");
          }}
        >
          {t("assistant.setup")}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            openSettings("external_access");
          }}
        >
          {t("assistant.use_mcp")}
        </Button>
      </AlertActions>
    </Alert>
  );
}
