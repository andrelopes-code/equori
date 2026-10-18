import {
  Section,
  SectionBody,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";

import { DisplayRow } from "@/features/setup/display-row";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import type { Locale } from "@/i18n/locale";
import { useScheme } from "@/theme/scheme";
import type { Scheme } from "@/theme/scheme";
import { TextSwitch } from "@/ui/text-switch";

const schemes: readonly Scheme[] = ["dark", "light", "system"];
const locales: readonly Locale[] = ["en", "pt-BR"];

export function DisplaySection() {
  const t = useT();
  const [scheme, setScheme] = useScheme();
  const [locale, setLocale] = useAppLocale();

  return (
    <Section>
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("settings.display.title")}</SectionHeading>
        </SectionTitle>
      </SectionHeader>
      <SectionBody>
        <DisplayRow label={t("more.language")}>
          <TextSwitch
            label={t("more.language")}
            value={locale}
            options={locales.map((l) => ({
              value: l,
              label: t(`locale.${l}`),
            }))}
            onChange={setLocale}
          />
        </DisplayRow>
        <DisplayRow label={t("more.scheme")}>
          <TextSwitch
            label={t("more.scheme")}
            value={scheme}
            options={schemes.map((s) => ({
              value: s,
              label: t(`scheme.${s}`),
            }))}
            onChange={setScheme}
          />
        </DisplayRow>
      </SectionBody>
    </Section>
  );
}
