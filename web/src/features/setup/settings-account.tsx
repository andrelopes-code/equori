import { Avatar } from "@slotted/react/avatar";
import { Button } from "@slotted/react/button";
import { InlineMessage } from "@slotted/react/inline-message";
import { Tag } from "@slotted/react/tag";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { SettingsGroup } from "@/features/setup/settings-group";
import styles from "@/features/setup/settings-page.module.css";
import { SettingsRow } from "@/features/setup/settings-row";
import { SettingsSection } from "@/features/setup/settings-section";
import { meQuery, useLogout } from "@/features/session";
import { useT } from "@/i18n/i18n-provider";

export function SettingsAccount() {
  const t = useT();
  const { logout, failed } = useLogout();
  // The session guard has loaded /me; the page reads that answer without asking again.
  const { data: me } = useQuery({ ...meQuery(useApi()), staleTime: Infinity });
  return (
    <SettingsSection
      topic="account"
      title={t("settings.account.title")}
      description={t("settings.summary.account")}
    >
      <div className={styles.identity}>
        <Avatar size="xl" name={me?.email ?? t("nav.user")} />
        <div className={styles.who}>
          <p className={styles.email} title={me?.email}>
            {me?.email}
          </p>
          {me !== undefined && (
            <Tag size="sm" tone={me.role === "admin" ? "accent" : "secondary"}>
              {t(`settings.account.role.${me.role}`)}
            </Tag>
          )}
        </div>
      </div>
      <SettingsGroup title={t("settings.account.session")}>
        <SettingsRow
          label={t("more.logout")}
          description={t("settings.account.logoutDescription")}
        >
          <Button tone="danger" variant="outline" fullWidth onClick={logout}>
            {t("more.logout")}
          </Button>
        </SettingsRow>
      </SettingsGroup>
      {failed && (
        <InlineMessage tone="danger" role="alert">
          {t("more.logoutFailed")}
        </InlineMessage>
      )}
    </SettingsSection>
  );
}
