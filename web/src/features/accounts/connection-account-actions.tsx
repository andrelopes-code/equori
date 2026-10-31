import { Button } from "@slotted/react/button";
import { Inline } from "@slotted/react/inline";

import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { useMapExternalAccount } from "@/features/accounts/api";
import { useT } from "@/i18n/i18n-provider";

type ExternalAccount = components["schemas"]["ExternalAccount"];

export interface ConnectionMessage {
  tone: "success" | "danger";
  text: string;
}

interface ConnectionAccountActionsProps {
  connectionId: string;
  external: ExternalAccount;
  onLink: (external: ExternalAccount) => void;
  onMessage: (message: ConnectionMessage | null) => void;
}

export function ConnectionAccountActions({
  connectionId,
  external,
  onLink,
  onMessage,
}: ConnectionAccountActionsProps) {
  const t = useT();
  const ignore = useMapExternalAccount();

  function handleLink() {
    onLink(external);
  }

  function handleIgnore() {
    onMessage(null);
    ignore
      .mutateAsync({
        connectionId,
        externalId: external.id,
        mapping: { ignored: true },
      })
      .catch((caught: unknown) => {
        onMessage({
          tone: "danger",
          text: errorText(caught, t),
        });
      });
  }

  return (
    <Inline gap={2} justify="end">
      <Button
        size="sm"
        variant={external.state === "pending" ? "solid" : "outline"}
        onClick={handleLink}
      >
        {external.state === "mapped" ? t("links.change") : t("links.link")}
      </Button>
      {external.state === "pending" && (
        <Button
          size="sm"
          variant="ghost"
          tone="secondary"
          loading={
            ignore.isPending && ignore.variables.externalId === external.id
          }
          onClick={handleIgnore}
        >
          {t("links.ignore")}
        </Button>
      )}
    </Inline>
  );
}
