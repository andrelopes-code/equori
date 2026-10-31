import { ButtonLink } from "@slotted/react/button";
import { Link } from "@slotted/react/link";
import { SkeletonText } from "@slotted/react/skeleton";
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { errorText } from "@/api/problem";
import {
  diagnosticURL,
  useSetUpdateCheck,
  versionQuery,
  UpdateCheckChoice,
} from "@/features/instance";
import { meQuery } from "@/features/session";
import { SettingsGroup } from "@/features/setup/settings-group";
import { SettingsSection } from "@/features/setup/settings-section";
import { useT } from "@/i18n/i18n-provider";
import { QueryError } from "@/ui/query-error";

// A158, A159: the version, the daily check for a newer one and the diagnostic file. Admin only.
export function SettingsAbout() {
  const t = useT();
  const api = useApi();
  const admin = useQuery(meQuery(api)).data?.role === "admin";
  const version = useQuery({ ...versionQuery(api), enabled: admin });
  const save = useSetUpdateCheck();

  if (!admin) return null;

  const handleChange = (value: boolean) => {
    save.mutate(value);
  };

  return (
    <SettingsSection
      topic="about"
      title={t("settings.about.title")}
      description={t("settings.summary.about")}
    >
      {version.isError && (
        <QueryError
          error={version.error}
          onRetry={() => void version.refetch()}
        />
      )}
      {version.isPending && (
        <SettingsGroup>
          <SkeletonText lines={3} />
        </SettingsGroup>
      )}
      {version.data !== undefined && (
        <>
          <SettingsGroup
            title={t("about.version", { version: version.data.version })}
          >
            {version.data.newer && version.data.latest !== null ? (
              <Text size="sm">
                {t("about.latest.newer", {
                  version: version.data.latest.version,
                })}{" "}
                <Link
                  href={version.data.latest.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t("about.latest.notes")}
                </Link>
              </Text>
            ) : (
              <Text size="sm">{t("about.latest.current")}</Text>
            )}
            <UpdateCheckChoice
              value={version.data.update_check}
              onChange={handleChange}
              {...(save.isError ? { error: errorText(save.error, t) } : {})}
            />
          </SettingsGroup>

          <SettingsGroup title={t("about.diagnostic")}>
            <Text size="sm" tone="muted">
              {t("about.diagnostic.help")}
            </Text>
            <div>
              <ButtonLink
                size="sm"
                variant="outline"
                tone="secondary"
                href={diagnosticURL}
                download
              >
                {t("about.diagnostic")}
              </ButtonLink>
            </div>
          </SettingsGroup>
        </>
      )}
    </SettingsSection>
  );
}
