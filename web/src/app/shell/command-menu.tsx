import { useNavigate } from "@tanstack/react-router";
import { CommandPalette } from "@slotted/react/command-palette";
import type {
  CommandPaletteHandle,
  CommandPaletteItem,
} from "@slotted/react/command-palette";
import { Icon } from "@slotted/react/icon";
import { useMemo } from "react";
import type { Ref } from "react";

import { destinations } from "@/app/shell/destinations";
import { ShellIcon } from "@/app/shell/shell-icon";
import { useEntry } from "@/app/shell/use-entry";
import { useLogout } from "@/features/session";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import type { Locale } from "@/i18n/locale";
import { densities, useDensity } from "@/theme/density";
import { useScheme } from "@/theme/scheme";
import type { Scheme } from "@/theme/scheme";

const schemes: readonly Scheme[] = ["dark", "light", "system"];
const locales: readonly Locale[] = ["en", "pt-BR"];

// The one palette of the application: every destination and every account action, opened by
// Ctrl+K anywhere, by the column's search control and by the phone's search, through its
// handle.
export function CommandMenu({ ref }: { ref: Ref<CommandPaletteHandle> }) {
  const t = useT();
  const navigate = useNavigate();
  const openEntry = useEntry();
  const { logout } = useLogout();
  const [, setScheme] = useScheme();
  const [, setDensity] = useDensity();
  const [locale, setLocale] = useAppLocale();

  const groups = useMemo(
    () => [
      { id: "go", label: t("palette.go") },
      { id: "actions", label: t("palette.actions") },
      { id: "account", label: t("palette.account") },
    ],
    [t],
  );

  const items = useMemo((): CommandPaletteItem[] => {
    const icon = (name: Parameters<typeof ShellIcon>[0]["name"]) => (
      <Icon size="sm">
        <ShellIcon name={name} />
      </Icon>
    );
    return [
      ...destinations.map((destination) => ({
        id: `go.${destination.key}`,
        label: t(destination.label),
        group: "go",
        icon: icon(destination.icon),
        onSelect: () => void navigate({ to: destination.to }),
      })),
      {
        id: "entry",
        label: t("nav.entry.long"),
        group: "actions",
        icon: icon("plus"),
        shortcut: "n",
        onSelect: openEntry,
      },
      ...schemes.map((scheme) => ({
        id: `scheme.${scheme}`,
        label: t("palette.scheme", { name: t(`scheme.${scheme}`) }),
        group: "actions",
        icon: icon("scheme"),
        onSelect: () => {
          setScheme(scheme);
        },
      })),
      ...densities.map((d) => ({
        id: `density.${d}`,
        label: t("palette.density", { name: t(`density.${d}`) }),
        group: "actions",
        icon: icon("density"),
        onSelect: () => {
          setDensity(d);
        },
      })),
      ...locales
        .filter((l) => l !== locale)
        .map((l) => ({
          id: `locale.${l}`,
          label: t("palette.language", { name: t(`locale.${l}`) }),
          group: "actions",
          icon: icon("language"),
          onSelect: () => {
            setLocale(l);
          },
        })),
      {
        id: "logout",
        label: t("more.logout"),
        group: "account",
        icon: icon("logout"),
        onSelect: logout,
      },
    ];
  }, [
    t,
    navigate,
    openEntry,
    setScheme,
    setDensity,
    locale,
    setLocale,
    logout,
  ]);

  return <CommandPalette ref={ref} items={items} groups={groups} />;
}
