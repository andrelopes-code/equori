import { Button, ButtonLink } from "@slotted/react/button";
import { InlineMessage } from "@slotted/react/inline-message";
import { List } from "@slotted/react/list";
import {
  ListItem,
  ListItemBody,
  ListItemContent,
  ListItemActions,
  ListItemDescription,
  ListItemLabel,
} from "@slotted/react/list-item";
import { SkeletonText } from "@slotted/react/skeleton";
import { Stack } from "@slotted/react/stack";
import { VisuallyHidden } from "@slotted/react/visually-hidden";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { useApi } from "@/api/api-context";
import { errorText, ProblemError } from "@/api/problem";
import {
  exportContentURL,
  exportQuery,
  hasTransactionsQuery,
  useImportArchive,
  useRequestExport,
} from "@/features/setup/api";
import { SettingsGroup } from "@/features/setup/settings-group";
import { SettingsSection } from "@/features/setup/settings-section";
import { formatFileSize } from "@/features/transactions";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { QueryError } from "@/ui/query-error";

// Export and import of the books (docs/superpowers/specs/2026-10-26-export-design.md).
export function SettingsData() {
  const t = useT();
  const api = useApi();
  const [tag] = useAppLocale();
  const current = useQuery(exportQuery(api));
  const hasTransactions = useQuery(hasTransactionsQuery(api));
  const request = useRequestExport();
  const importing = useImportArchive();
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{
    tone: "success" | "danger";
    text: string;
  } | null>(null);

  // ADR 021, V4: an archive of a later version names both versions and the way out.
  const importError = (caught: unknown) => {
    const p = caught instanceof ProblemError ? caught.problem : undefined;
    return p?.code === "archive_too_new" &&
      p.archive_version !== undefined &&
      p.instance_version !== undefined
      ? t("import.tooNew", {
          archive: p.archive_version,
          instance: p.instance_version,
        })
      : errorText(caught, t);
  };

  const status = () => {
    const e = current.data;
    if (e === null || e === undefined) return t("export.none");
    switch (e.status) {
      case "pending":
        return t("export.pending");
      case "failed":
        return t("export.failed");
      case "ready":
        return t("export.ready", {
          size: formatFileSize(e.size ?? 0, tag),
          date: new Intl.DateTimeFormat(tag, { dateStyle: "medium" }).format(
            new Date(e.requested_at),
          ),
          version: e.archive_version ?? 1,
        });
    }
  };

  return (
    <SettingsSection
      topic="data"
      title={t("settings.data.title")}
      description={t("settings.data.description")}
    >
      <SettingsGroup>
        <Stack gap={5}>
          {current.isError ? (
            <QueryError
              error={current.error}
              onRetry={() => void current.refetch()}
            />
          ) : current.isPending || hasTransactions.isPending ? (
            <SkeletonText lines={4} />
          ) : (
            <List variant="ruled" aria-label={t("settings.data.title")}>
              <ListItem>
                <ListItemContent>
                  <ListItemBody>
                    <ListItemLabel>{t("export.label")}</ListItemLabel>
                    <ListItemDescription>{status()}</ListItemDescription>
                  </ListItemBody>
                </ListItemContent>
                <ListItemActions>
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
                    loading={
                      request.isPending || current.data?.status === "pending"
                    }
                    onClick={() => {
                      setMessage(null);
                      request.mutateAsync().catch((caught: unknown) => {
                        setMessage({
                          tone: "danger",
                          text: errorText(caught, t),
                        });
                      });
                    }}
                  >
                    {t("export.request")}
                  </Button>
                </ListItemActions>
              </ListItem>
              <ListItem>
                <ListItemContent>
                  <ListItemBody>
                    <ListItemLabel>{t("import.label")}</ListItemLabel>
                    <ListItemDescription>
                      {hasTransactions.data === true
                        ? t("import.blocked")
                        : t("import.description")}
                    </ListItemDescription>
                  </ListItemBody>
                </ListItemContent>
                {hasTransactions.data === false && (
                  <ListItemActions>
                    <VisuallyHidden>
                      <input
                        ref={input}
                        type="file"
                        accept="application/zip,.zip"
                        aria-label={t("import.choose")}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          if (file === undefined) return;
                          setMessage(null);
                          importing
                            .mutateAsync(file)
                            .then((result) => {
                              setMessage({
                                tone: "success",
                                text: t("import.done", {
                                  rows: result.tables.reduce(
                                    (sum, table) => sum + table.rows,
                                    0,
                                  ),
                                  version: result.archive_version,
                                }),
                              });
                            })
                            .catch((caught: unknown) => {
                              setMessage({
                                tone: "danger",
                                text: importError(caught),
                              });
                            });
                        }}
                      />
                    </VisuallyHidden>
                    <Button
                      size="sm"
                      variant="outline"
                      tone="secondary"
                      loading={importing.isPending}
                      onClick={() => input.current?.click()}
                    >
                      {t("import.choose")}
                    </Button>
                  </ListItemActions>
                )}
              </ListItem>
            </List>
          )}
          {message !== null && (
            <InlineMessage tone={message.tone}>{message.text}</InlineMessage>
          )}
        </Stack>
      </SettingsGroup>
    </SettingsSection>
  );
}
