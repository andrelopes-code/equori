import { useQuery } from "@tanstack/react-query";
import { Page, PageBody } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderHeading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import {
  Section,
  SectionBody,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";

import { useApi } from "@/api/api-context";
import {
  institutionsQuery,
  payeesQuery,
  useCreateInstitution,
  useCreatePayee,
} from "@/features/setup/api";
import { CurrencySection } from "@/features/setup/currency-section";
import { NameSection } from "@/features/setup/name-section";
import { OptionSelect } from "@/features/setup/option-select";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import type { Locale } from "@/i18n/locale";
import { useScheme } from "@/theme/scheme";
import type { Scheme } from "@/theme/scheme";

const schemes: readonly Scheme[] = ["dark", "light", "system"];
const locales: readonly Locale[] = ["en", "pt-BR"];

export function SettingsPage() {
  const t = useT();
  const api = useApi();
  const institutions = useQuery(institutionsQuery(api));
  const payees = useQuery(payeesQuery(api));
  const createInstitution = useCreateInstitution();
  const createPayee = useCreatePayee();
  const [scheme, setScheme] = useScheme();
  const [locale, setLocale] = useAppLocale();

  return (
    <Page width="measure">
      <PageHeader>
        <PageHeaderTitleArea>
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>{t("more.settings")}</PageHeaderHeading>
            </PageHeaderTitle>
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
      </PageHeader>
      <PageBody>
        <CurrencySection />
        <NameSection
          kind="institutions"
          items={institutions.data}
          error={institutions.error}
          onRetry={() => void institutions.refetch()}
          create={(name) => createInstitution.mutateAsync({ name })}
        />
        <NameSection
          kind="payees"
          items={payees.data}
          error={payees.error}
          onRetry={() => void payees.refetch()}
          create={(name) => createPayee.mutateAsync({ name })}
        />
        <Section>
          <SectionHeader>
            <SectionTitle>
              <SectionHeading>{t("settings.display.title")}</SectionHeading>
            </SectionTitle>
          </SectionHeader>
          <SectionBody>
            <OptionSelect
              label={t("more.language")}
              value={locale}
              options={locales.map((l) => ({
                value: l,
                label: t(`locale.${l}`),
              }))}
              onChange={(next) => {
                const chosen = locales.find((l) => l === next);
                if (chosen !== undefined) setLocale(chosen);
              }}
            />
            <OptionSelect
              label={t("more.scheme")}
              value={scheme}
              options={schemes.map((s) => ({
                value: s,
                label: t(`scheme.${s}`),
              }))}
              onChange={(next) => {
                const chosen = schemes.find((s) => s === next);
                if (chosen !== undefined) setScheme(chosen);
              }}
            />
          </SectionBody>
        </Section>
      </PageBody>
    </Page>
  );
}
