import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Avatar } from "@slotted/react/avatar";
import { Icon } from "@slotted/react/icon";
import {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuGroup,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "@slotted/react/menu";

import { useApi } from "@/api/api-context";
import styles from "@/app/shell/account-menu.module.css";
import { ShellIcon } from "@/app/shell/shell-icon";
import { meQuery, useChooseLanguage, useLogout } from "@/features/session";
import { useAppLocaleState, useT } from "@/i18n/i18n-provider";
import { isLanguage, languages } from "@/i18n/languages";
import { usePrivacy } from "@/privacy/privacy-provider";
import { densities, useDensity } from "@/theme/density";
import type { Density } from "@/theme/density";
import { schemes, useScheme } from "@/theme/scheme";
import type { Scheme } from "@/theme/scheme";

function isScheme(value: string): value is Scheme {
  return (schemes as readonly string[]).includes(value);
}

function isDensity(value: string): value is Density {
  return (densities as readonly string[]).includes(value);
}

// The column's foot: the signed-in account, and the menu of what belongs to it. In the rail
// only the avatar remains.
export function AccountMenu({ compact }: { compact: boolean }) {
  const t = useT();
  const navigate = useNavigate();
  const { logout, failed } = useLogout();
  const [scheme, setScheme] = useScheme();
  const [density, setDensity] = useDensity();
  const { hidden, setHidden } = usePrivacy();
  const { language } = useAppLocaleState();
  const chooseLanguage = useChooseLanguage();
  // The session guard has loaded /me; the menu reads that answer without asking again.
  const { data: me } = useQuery({ ...meQuery(useApi()), staleTime: Infinity });
  // The part before the @ names the account; the domain adds width and no recognition.
  const name = me?.email.split("@")[0] ?? t("nav.user");
  return (
    <>
      <Menu width={compact ? "content" : "anchor"}>
        <MenuTrigger
          render={(props) => (
            <button
              {...props}
              type="button"
              aria-label={t("nav.user")}
              data-own="account-trigger"
              data-compact={compact || undefined}
              className={styles.trigger}
            >
              <Avatar size="sm" name={me?.email ?? name} />
              {!compact && (
                <>
                  <span className={styles.name}>{name}</span>
                  <span className={styles.chevrons}>
                    <ShellIcon name="chevrons" size={16} weight={2} />
                  </span>
                </>
              )}
            </button>
          )}
        />
        <MenuContent>
          <MenuItem
            icon={
              <Icon size="sm">
                <ShellIcon name="settings" />
              </Icon>
            }
            onSelect={() => void navigate({ to: "/settings" })}
          >
            {t("more.settings")}
          </MenuItem>
          <MenuItem
            icon={
              <Icon size="sm">
                <ShellIcon name="help" />
              </Icon>
            }
            onSelect={() => void navigate({ to: "/help" })}
          >
            {t("more.help")}
          </MenuItem>
          <MenuCheckboxItem
            icon={
              <Icon size="sm">
                <ShellIcon name={hidden ? "eye-off" : "eye"} />
              </Icon>
            }
            checked={hidden}
            onCheckedChange={setHidden}
          >
            {t("privacy.hide")}
          </MenuCheckboxItem>
          <MenuSeparator />
          <MenuGroup label={t("more.scheme")}>
            <MenuRadioGroup
              aria-label={t("more.scheme")}
              value={scheme}
              onValueChange={(next) => {
                if (isScheme(next)) setScheme(next);
              }}
            >
              {schemes.map((s) => (
                <MenuRadioItem key={s} value={s}>
                  {t(`scheme.${s}`)}
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          </MenuGroup>
          <MenuGroup label={t("more.density")}>
            <MenuRadioGroup
              aria-label={t("more.density")}
              value={density}
              onValueChange={(next) => {
                if (isDensity(next)) setDensity(next);
              }}
            >
              {densities.map((d) => (
                <MenuRadioItem key={d} value={d}>
                  {t(`density.${d}`)}
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          </MenuGroup>
          <MenuGroup label={t("more.language")}>
            <MenuRadioGroup
              aria-label={t("more.language")}
              value={language}
              onValueChange={(next) => {
                if (isLanguage(next)) chooseLanguage(next);
              }}
            >
              {languages.map((l) => (
                <MenuRadioItem key={l.language} value={l.language}>
                  {l.nativeName}
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          </MenuGroup>
          <MenuSeparator />
          <MenuItem
            tone="danger"
            icon={
              <Icon size="sm">
                <ShellIcon name="logout" />
              </Icon>
            }
            onSelect={logout}
          >
            {t("more.logout")}
          </MenuItem>
        </MenuContent>
      </Menu>
      {failed && <p role="alert">{t("more.logoutFailed")}</p>}
    </>
  );
}
