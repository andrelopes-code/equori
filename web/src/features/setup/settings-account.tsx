import { Avatar } from "@slotted/react/avatar";
import { Button } from "@slotted/react/button";
import { Tag } from "@slotted/react/tag";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { SettingsSection } from "@/features/setup/settings-section";
import styles from "@/features/setup/settings-page.module.css";
import { meQuery, useLogout } from "@/features/session";
import { useT } from "@/i18n/i18n-provider";

export function SettingsAccount() {
  const t = useT();
  const { logout, failed } = useLogout();
  // The session guard has loaded /me; the page reads that answer without asking again.
  const { data: me } = useQuery({ ...meQuery(useApi()), staleTime: Infinity });
  return (
    <SettingsSection topic="account" title={t("settings.account.title")}>
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
        <div className={styles.signOut}>
          <Button tone="danger" variant="outline" fullWidth onClick={logout}>
            {t("more.logout")}
          </Button>
        </div>
      </div>
      {failed && <p role="alert">{t("more.logoutFailed")}</p>}
    </SettingsSection>
  );
}
