import { Button } from "@slotted/react/button";
import { Alert, AlertContent, AlertDescription } from "@slotted/react/alert";
import { SkeletonText } from "@slotted/react/skeleton";
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { errorText } from "@/api/problem";
import { backupQuery, useRunBackup } from "@/features/instance";
import type { BackupStatus } from "@/features/instance";
import { meQuery } from "@/features/session";
import { booksQuery } from "@/features/setup/api";
import { formatMoment } from "@/features/setup/format-moment";
import { SettingsCopyPassword } from "@/features/setup/settings-copy-password";
import { SettingsGroup } from "@/features/setup/settings-group";
import { SettingsSection } from "@/features/setup/settings-section";
import type { MessageKey } from "@/i18n/catalog.en";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { QueryError } from "@/ui/query-error";

// A154, A155, A157: the daily backups, the encrypted copy and its password. Only an admin sees it.
export function SettingsBackup() {
  const t = useT();
  const api = useApi();
  const [tag] = useAppLocale();
  const admin = useQuery(meQuery(api)).data?.role === "admin";
  const status = useQuery({ ...backupQuery(api), enabled: admin });
  const books = useQuery(booksQuery(api)).data;
  const run = useRunBackup();

  if (!admin) return null;

  const zone = books?.time_zone ?? books?.default_time_zone;
  const moment = (iso: string) => formatMoment(iso, tag, zone);
  const warnings = status.data === undefined ? [] : warningsOf(status.data);

  const handleRun = () => {
    run.mutate();
  };

  return (
    <SettingsSection
      topic="backup"
      title={t("settings.backup.title")}
      description={t("settings.summary.backup")}
    >
      {status.isError && (
        <QueryError
          error={status.error}
          onRetry={() => void status.refetch()}
        />
      )}
      {status.isPending && (
        <SettingsGroup>
          <SkeletonText lines={3} />
        </SettingsGroup>
      )}
      {status.data !== undefined && (
        <>
          {warnings.length > 0 && (
            <Alert tone="warning">
              <AlertContent>
                {warnings.map((key) => (
                  <AlertDescription key={key}>{t(key)}</AlertDescription>
                ))}
              </AlertContent>
            </Alert>
          )}
          {run.isError && (
            <Alert tone="danger" live="polite">
              <AlertContent>
                <AlertDescription>{errorText(run.error, t)}</AlertDescription>
              </AlertContent>
            </Alert>
          )}

          <SettingsGroup
            title={t("backup.backups.title")}
            actions={
              <Button
                size="sm"
                variant="outline"
                tone="secondary"
                disabled={status.data.backups.state === "off"}
                loading={run.isPending}
                onClick={handleRun}
              >
                {t("backup.run")}
              </Button>
            }
          >
            {status.data.backups.state === "off" ? (
              <Text size="sm">{t("backup.off")}</Text>
            ) : (
              <Text size="sm">{periodicText(status.data, t, moment)}</Text>
            )}
          </SettingsGroup>

          <SettingsGroup title={t("backup.copy.title")}>
            <Text size="sm">{copyText(status.data, t, moment)}</Text>
          </SettingsGroup>

          <SettingsCopyPassword />
        </>
      )}
    </SettingsSection>
  );
}

function warningsOf(status: BackupStatus): MessageKey[] {
  const keys: MessageKey[] = [];
  if (status.backups.late) keys.push("backup.late");
  if (status.copy.state === "folder_not_writable")
    keys.push("backup.copy.folder_not_writable");
  if (status.copy.state === "failed") keys.push("backup.copy.failed");
  if (status.copy.late) keys.push("backup.copy.late");

  return keys;
}

function periodicText(
  status: BackupStatus,
  t: ReturnType<typeof useT>,
  moment: (iso: string) => string,
): string {
  const { periodic_at: periodic, pre_migration_at: pre } = status.backups;
  const daily =
    periodic === null
      ? t("backup.periodic.none")
      : t("backup.periodic", { date: moment(periodic) });
  const before =
    pre === null
      ? t("backup.preMigration.none")
      : t("backup.preMigration", { date: moment(pre) });

  return `${daily} ${before}`;
}

function copyText(
  status: BackupStatus,
  t: ReturnType<typeof useT>,
  moment: (iso: string) => string,
): string {
  const { state, copied_at: at, file } = status.copy;
  if (state === "folder_unset") return t("backup.copy.folder_unset");
  if (state === "password_unset") return t("backup.copy.password_unset");
  if (at === null) return t("backup.copy.none");

  return t("backup.copy.ok", { date: moment(at), file: file ?? "" });
}
