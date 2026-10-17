import { useNavigate } from "@tanstack/react-router";
import {
  ActionSheet,
  ActionSheetContent,
  ActionSheetHeader,
  ActionSheetItem,
  ActionSheetList,
  ActionSheetTitle,
} from "@slotted/react/action-sheet";
import { useState } from "react";

import { useAppLocale, useT } from "@/i18n/i18n-provider";
import type { Locale } from "@/i18n/locale";
import { useScheme } from "@/theme/scheme";
import type { Scheme } from "@/theme/scheme";

type Level = "root" | "scheme" | "locale";

const schemes: readonly Scheme[] = ["dark", "light", "system"];
const locales: readonly Locale[] = ["en", "pt-BR"];

export function MoreSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const navigate = useNavigate();
  const [, setScheme] = useScheme();
  const [, setLocale] = useAppLocale();
  const [level, setLevel] = useState<Level>("root");

  const title = {
    root: t("more.title"),
    scheme: t("more.scheme"),
    locale: t("more.language"),
  }[level];

  return (
    <ActionSheet
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setLevel("root");
      }}
    >
      <ActionSheetContent>
        <ActionSheetHeader>
          <ActionSheetTitle>{title}</ActionSheetTitle>
        </ActionSheetHeader>
        <ActionSheetList>
          {level === "root" && (
            <>
              <ActionSheetItem
                value="settings"
                onSelect={() => void navigate({ to: "/settings" })}
              >
                {t("more.settings")}
              </ActionSheetItem>
              <ActionSheetItem
                value="scheme"
                closeOnSelect={false}
                onSelect={() => {
                  setLevel("scheme");
                }}
              >
                {t("more.scheme")}
              </ActionSheetItem>
              <ActionSheetItem
                value="language"
                closeOnSelect={false}
                onSelect={() => {
                  setLevel("locale");
                }}
              >
                {t("more.language")}
              </ActionSheetItem>
              <ActionSheetItem value="logout" tone="danger">
                {t("more.logout")}
              </ActionSheetItem>
            </>
          )}
          {level === "scheme" &&
            schemes.map((scheme) => (
              <ActionSheetItem
                key={scheme}
                value={scheme}
                onSelect={() => {
                  setScheme(scheme);
                }}
              >
                {t(`scheme.${scheme}`)}
              </ActionSheetItem>
            ))}
          {level === "locale" &&
            locales.map((locale) => (
              <ActionSheetItem
                key={locale}
                value={locale}
                onSelect={() => {
                  setLocale(locale);
                }}
              >
                {t(`locale.${locale}`)}
              </ActionSheetItem>
            ))}
        </ActionSheetList>
      </ActionSheetContent>
    </ActionSheet>
  );
}
