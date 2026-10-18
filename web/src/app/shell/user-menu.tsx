import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Avatar } from "@slotted/react/avatar";
import {
  Menu,
  MenuContent,
  MenuGroup,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "@slotted/react/menu";
import { TopNavigationAccount } from "@slotted/react/top-navigation";

import { useApi } from "@/api/api-context";
import { meQuery, useLogout } from "@/features/session";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import type { Locale } from "@/i18n/locale";
import { useScheme } from "@/theme/scheme";
import type { Scheme } from "@/theme/scheme";

const schemes: readonly Scheme[] = ["dark", "light", "system"];
const locales: readonly Locale[] = ["en", "pt-BR"];

function isScheme(value: string): value is Scheme {
  return (schemes as readonly string[]).includes(value);
}

function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

// Ledger sheet L4: the entries of the phone's More sheet, as the banner's account menu.
export function UserMenu() {
  const t = useT();
  const navigate = useNavigate();
  const { logout, failed } = useLogout();
  const [scheme, setScheme] = useScheme();
  const [locale, setLocale] = useAppLocale();
  // The session guard has loaded /me; the avatar reads that answer without asking again.
  const { data: me } = useQuery({ ...meQuery(useApi()), staleTime: Infinity });
  return (
    <>
      <Menu>
        <MenuTrigger
          render={(props) => (
            <TopNavigationAccount {...props} aria-label={t("nav.user")}>
              <Avatar size="xs" name={me?.email ?? t("nav.user")} />
            </TopNavigationAccount>
          )}
        />
        <MenuContent>
          <MenuItem onSelect={() => void navigate({ to: "/settings" })}>
            {t("more.settings")}
          </MenuItem>
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
          <MenuGroup label={t("more.language")}>
            <MenuRadioGroup
              aria-label={t("more.language")}
              value={locale}
              onValueChange={(next) => {
                if (isLocale(next)) setLocale(next);
              }}
            >
              {locales.map((l) => (
                <MenuRadioItem key={l} value={l}>
                  {t(`locale.${l}`)}
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          </MenuGroup>
          <MenuSeparator />
          <MenuItem tone="danger" onSelect={logout}>
            {t("more.logout")}
          </MenuItem>
        </MenuContent>
      </Menu>
      {failed && <p role="alert">{t("more.logoutFailed")}</p>}
    </>
  );
}
