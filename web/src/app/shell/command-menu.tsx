import { useNavigate } from "@tanstack/react-router";
import { CommandPalette } from "@slotted/react/command-palette";
import type {
  CommandPaletteHandle,
  CommandPaletteItem,
} from "@slotted/react/command-palette";
import { Icon } from "@slotted/react/icon";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { Ref } from "react";

import { useApi } from "@/api/api-context";

import { destinations } from "@/app/shell/destinations";
import { ShellIcon } from "@/app/shell/shell-icon";
import { useEntry } from "@/app/shell/use-entry";
import { accountsQuery } from "@/features/accounts";
import { useChooseLanguage, useLogout } from "@/features/session";
import { useAppLocaleState, useT } from "@/i18n/i18n-provider";
import { languages } from "@/i18n/languages";
import { usePrivacy } from "@/privacy/privacy-provider";
import { densities, useDensity } from "@/theme/density";
import { useScheme } from "@/theme/scheme";
import type { Scheme } from "@/theme/scheme";

const schemes: readonly Scheme[] = ["dark", "light", "system"];

// The one palette of the application: every destination and every account action, opened by
// Ctrl+K anywhere, by the column's search control and by the phone's search, through its
// handle.
export function CommandMenu({
  ref,
  onAssistant,
}: {
  ref: Ref<CommandPaletteHandle>;
  onAssistant?: () => void;
}) {
  const t = useT();
  const navigate = useNavigate();
  const openEntry = useEntry();
  const { logout } = useLogout();
  const [, setScheme] = useScheme();
  const [, setDensity] = useDensity();
  const { hidden, toggle: togglePrivacy } = usePrivacy();
  const { language } = useAppLocaleState();
  const chooseLanguage = useChooseLanguage();
  // The accounts are read the first time the palette opens, not on every page load.
  const [opened, setOpened] = useState(false);
  const accounts = useQuery({
    ...accountsQuery(useApi()),
    enabled: opened,
  });

  const groups = useMemo(
    () => [
      { id: "go", label: t("palette.go") },
      { id: "accounts", label: t("palette.accounts") },
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
    const open = (accounts.data ?? []).filter(
      (a) => a.kind !== undefined && a.closed_on === undefined,
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
        id: "go.uncategorized",
        label: t("palette.uncategorized"),
        group: "go",
        icon: icon("transactions"),
        onSelect: () =>
          void navigate({
            to: "/transactions",
            search: { uncategorized: true },
          }),
      },
      {
        id: "go.institutions",
        label: t("palette.institutions"),
        group: "go",
        icon: icon("accounts"),
        onSelect: () => void navigate({ to: "/accounts/institutions" }),
      },
      {
        id: "go.links",
        label: t("palette.links"),
        group: "go",
        icon: icon("accounts"),
        onSelect: () => void navigate({ to: "/accounts/links" }),
      },
      ...open.map((account) => ({
        id: `account.${account.id}`,
        label: account.name,
        group: "accounts",
        icon: icon(account.kind === "credit_card" ? "cards" : "accounts"),
        onSelect: () =>
          void (account.kind === "credit_card"
            ? navigate({
                to: "/cards/$accountId",
                params: { accountId: account.id },
              })
            : navigate({ to: "/accounts/$id", params: { id: account.id } })),
      })),
      {
        id: "entry",
        label: t("nav.entry.long"),
        group: "actions",
        icon: icon("plus"),
        shortcut: "n",
        onSelect: openEntry,
      },
      ...(onAssistant === undefined
        ? []
        : [
            {
              id: "assistant",
              label: t("assistant.title"),
              group: "actions",
              icon: icon("assistant"),
              onSelect: onAssistant,
            },
          ]),
      {
        id: "account.new",
        label: t("palette.newAccount"),
        group: "actions",
        icon: icon("plus"),
        onSelect: () => void navigate({ to: "/accounts/new" }),
      },
      {
        id: "import",
        label: t("palette.importStatement"),
        group: "actions",
        icon: icon("accounts"),
        children: open
          .filter((a) => a.class === "asset" || a.class === "liability")
          .map((account) => ({
            id: `import.${account.id}`,
            label: account.name,
            icon: icon(account.kind === "credit_card" ? "cards" : "accounts"),
            onSelect: () =>
              void navigate({
                to: "/accounts/$id/import",
                params: { id: account.id },
              }),
          })),
      },
      {
        id: "privacy",
        label: t(hidden ? "privacy.show" : "privacy.hide"),
        group: "actions",
        icon: icon(hidden ? "eye" : "eye-off"),
        onSelect: togglePrivacy,
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
      ...languages.map((l) => ({
        id: `language.${l.language}`,
        label: t("palette.language", { name: l.nativeName }),
        group: "actions",
        icon: icon("language"),
        disabled: l.language === language,
        onSelect: () => {
          chooseLanguage(l.language);
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
    accounts.data,
    t,
    navigate,
    openEntry,
    setScheme,
    setDensity,
    hidden,
    togglePrivacy,
    language,
    chooseLanguage,
    logout,
    onAssistant,
  ]);

  return (
    <CommandPalette
      ref={ref}
      items={items}
      groups={groups}
      loading={opened && accounts.isPending}
      onOpenChange={(next) => {
        if (next) setOpened(true);
      }}
    />
  );
}
