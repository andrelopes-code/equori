import { Button, ButtonLink } from "@slotted/react/button";
import { Inline } from "@slotted/react/inline";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { errorText } from "@/api/problem";
import type { DataMessage } from "@/features/setup/data-message";
import { ExportCredentialsDialog } from "@/features/setup/export-credentials-dialog";
import { exportStatus } from "@/features/setup/export-status";
import { SettingsRow } from "@/features/setup/settings-row";
import {
  exportContentURL,
  exportQuery,
  useRequestExport,
} from "@/features/setup/api";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface ExportRowProps {
  onMessage: (message: DataMessage | null) => void;
}

export function ExportRow({ onMessage }: ExportRowProps) {
  const t = useT();
  const api = useApi();
  const [tag] = useAppLocale();
  const current = useQuery(exportQuery(api));
  const request = useRequestExport();
  const [withCredentials, setWithCredentials] = useState(false);

  const busy = request.isPending || current.data?.status === "pending";

  const handleRequest = () => {
    onMessage(null);
    request.mutateAsync(undefined).catch((caught: unknown) => {
      onMessage({ tone: "danger", text: errorText(caught, t) });
    });
  };

  return (
    <>
      <SettingsRow
        stacked
        label={t("export.label")}
        description={exportStatus(current.data, t, tag)}
      >
        <Inline gap={3} wrap="wrap">
          {current.data?.status === "ready" && (
            <ButtonLink
              size="sm"
              variant="outline"
              tone="secondary"
              href={exportContentURL}
              download
            >
              {t("export.download")}
            </ButtonLink>
          )}
          <Button
            size="sm"
            variant="outline"
            tone="secondary"
            disabled={busy}
            onClick={() => {
              onMessage(null);
              setWithCredentials(true);
            }}
          >
            {t("export.withCredentials")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            tone="secondary"
            loading={busy}
            onClick={handleRequest}
          >
            {t("export.request")}
          </Button>
        </Inline>
      </SettingsRow>

      {withCredentials && (
        <ExportCredentialsDialog
          onConfirm={request.mutateAsync}
          onClose={() => {
            setWithCredentials(false);
          }}
        />
      )}
    </>
  );
}
