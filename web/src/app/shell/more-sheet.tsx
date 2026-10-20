import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  ActionSheet,
  ActionSheetContent,
  ActionSheetHeader,
  ActionSheetItem,
  ActionSheetList,
  ActionSheetMessage,
  ActionSheetSeparator,
  ActionSheetTitle,
  ActionSheetTrigger,
} from "@slotted/react/action-sheet";
import type { ActionSheetTriggerRootProps } from "@slotted/react/action-sheet";
import { Icon } from "@slotted/react/icon";
import { useState } from "react";
import type { ReactNode } from "react";

import { useApi } from "@/api/api-context";
import { destinations } from "@/app/shell/destinations";
import { ShellIcon } from "@/app/shell/shell-icon";
import type { ShellIconName } from "@/app/shell/shell-icon";
import { meQuery, useLogout } from "@/features/session";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import type { Locale } from "@/i18n/locale";
import { densities, useDensity } from "@/theme/density";
import { useScheme } from "@/theme/scheme";
import type { Scheme } from "@/theme/scheme";

type Level = "root" | "scheme" | "density" | "locale";

const schemes: readonly Scheme[] = ["dark", "light", "system"];
const locales: readonly Locale[] = ["en", "pt-BR"];
const listed = destinations.filter((d) => d.phone === "more");

function mark(name: ShellIconName) {
  return (
    <Icon>
      <ShellIcon name={name} />
    </Icon>
  );
}

// The phone's More: the destinations the navigation bar has no room for, then the account.
// Scheme, density and language open a second level in the same sheet.
export function MoreSheet({
  trigger,
  onOpenChange,
}: {
  trigger: (props: ActionSheetTriggerRootProps) => ReactNode;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const navigate = useNavigate();
  const { logout, failed } = useLogout();
  const [scheme, setScheme] = useScheme();
  const [density, setDensity] = useDensity();
  const [locale, setLocale] = useAppLocale();
  const [level, setLevel] = useState<Level>("root");
  const { data: me } = useQuery({ ...meQuery(useApi()), staleTime: Infinity });

  const title = {
    root: t("more.title"),
    scheme: t("more.scheme"),
    density: t("more.density"),
    locale: t("more.language"),
  }[level];

  return (
    <ActionSheet
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setLevel("root");
      }}
    >
      <ActionSheetTrigger render={trigger} />
      <ActionSheetContent>
        <ActionSheetHeader>
          <ActionSheetTitle>{title}</ActionSheetTitle>
          {level === "root" && me !== undefined && (
            <ActionSheetMessage>{me.email}</ActionSheetMessage>
          )}
        </ActionSheetHeader>
        <ActionSheetList>
          {level === "root" && (
            <>
              {listed.map((destination) => (
                <ActionSheetItem
                  key={destination.key}
                  value={destination.key}
                  icon={mark(destination.icon)}
                  onSelect={() => void navigate({ to: destination.to })}
                >
                  {t(destination.label)}
                </ActionSheetItem>
              ))}
              <ActionSheetSeparator />
              <ActionSheetItem
                value="scheme"
                icon={mark("scheme")}
                closeOnSelect={false}
                onSelect={() => {
                  setLevel("scheme");
                }}
              >
                {t("more.scheme")}
              </ActionSheetItem>
              <ActionSheetItem
                value="density"
                icon={mark("density")}
                closeOnSelect={false}
                onSelect={() => {
                  setLevel("density");
                }}
              >
                {t("more.density")}
              </ActionSheetItem>
              <ActionSheetItem
                value="language"
                icon={mark("language")}
                closeOnSelect={false}
                onSelect={() => {
                  setLevel("locale");
                }}
              >
                {t("more.language")}
              </ActionSheetItem>
              <ActionSheetItem
                value="logout"
                tone="danger"
                icon={mark("logout")}
                closeOnSelect={false}
                onSelect={logout}
              >
                {t("more.logout")}
              </ActionSheetItem>
              {failed && <p role="alert">{t("more.logoutFailed")}</p>}
            </>
          )}
          {level === "scheme" &&
            schemes.map((s) => (
              <ActionSheetItem
                key={s}
                value={s}
                aria-current={s === scheme || undefined}
                onSelect={() => {
                  setScheme(s);
                }}
              >
                {t(`scheme.${s}`)}
              </ActionSheetItem>
            ))}
          {level === "density" &&
            densities.map((d) => (
              <ActionSheetItem
                key={d}
                value={d}
                aria-current={d === density || undefined}
                onSelect={() => {
                  setDensity(d);
                }}
              >
                {t(`density.${d}`)}
              </ActionSheetItem>
            ))}
          {level === "locale" &&
            locales.map((l) => (
              <ActionSheetItem
                key={l}
                value={l}
                aria-current={l === locale || undefined}
                onSelect={() => {
                  setLocale(l);
                }}
              >
                {t(`locale.${l}`)}
              </ActionSheetItem>
            ))}
        </ActionSheetList>
      </ActionSheetContent>
    </ActionSheet>
  );
}
