import { List } from "@slotted/react/list";
import { SkeletonText } from "@slotted/react/skeleton";
import { Stack } from "@slotted/react/stack";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import type { DataMessage } from "@/features/setup/data-message";
import { exportQuery, hasTransactionsQuery } from "@/features/setup/api";
import { ExportRow } from "@/features/setup/export-row";
import { ImportCredentialsFields } from "@/features/setup/import-credentials-fields";
import { ImportRow } from "@/features/setup/import-row";
import { SettingsGroup } from "@/features/setup/settings-group";
import { SettingsSection } from "@/features/setup/settings-section";
import { useImportCredentials } from "@/features/setup/use-import-credentials";
import { useT } from "@/i18n/i18n-provider";
import { FormNotice } from "@/ui/form-notice";
import { QueryError } from "@/ui/query-error";

// Export and import of the books (docs/specs/2026-10-26-export-design.md).
export function SettingsData() {
  const t = useT();
  const api = useApi();
  const current = useQuery(exportQuery(api));
  const hasTransactions = useQuery(hasTransactionsQuery(api));
  const [message, setMessage] = useState<DataMessage | null>(null);
  const credentials = useImportCredentials();

  const loading = current.isPending || hasTransactions.isPending;

  return (
    <SettingsSection
      topic="data"
      title={t("settings.data.title")}
      description={t("settings.data.description")}
    >
      <SettingsGroup>
        <Stack gap={5}>
          {current.isError && (
            <QueryError
              error={current.error}
              onRetry={() => void current.refetch()}
            />
          )}

          {!current.isError && loading && <SkeletonText lines={4} />}

          {!current.isError && !loading && (
            <List variant="ruled" inset aria-label={t("settings.data.title")}>
              <ExportRow onMessage={setMessage} />
              <ImportRow
                blocked={hasTransactions.data === true}
                credentials={credentials}
                onMessage={setMessage}
              />
            </List>
          )}

          {!current.isError && !loading && hasTransactions.data !== true && (
            <ImportCredentialsFields credentials={credentials} />
          )}

          {message !== null && (
            <FormNotice tone={message.tone}>{message.text}</FormNotice>
          )}
        </Stack>
      </SettingsGroup>
    </SettingsSection>
  );
}
