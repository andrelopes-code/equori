import { useQuery } from "@tanstack/react-query";
import { Page, PageBody } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderHeading,
  PageHeaderSubheading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";

import { useApi } from "@/api/api-context";
import {
  institutionsQuery,
  payeesQuery,
  settingsQuery,
  useCreateInstitution,
  useCreatePayee,
} from "@/features/setup/api";
import { CurrencySection } from "@/features/setup/currency-section";
import { DisplaySection } from "@/features/setup/display-section";
import { NameSection } from "@/features/setup/name-section";
import styles from "@/features/setup/settings-page.module.css";
import { useT } from "@/i18n/i18n-provider";

export function SettingsPage() {
  const t = useT();
  const api = useApi();
  const settings = useQuery(settingsQuery(api));
  const institutions = useQuery(institutionsQuery(api));
  const payees = useQuery(payeesQuery(api));
  const createInstitution = useCreateInstitution();
  const createPayee = useCreatePayee();

  const summary =
    settings.data !== undefined &&
    institutions.data !== undefined &&
    payees.data !== undefined
      ? t("settings.summary", {
          currency: settings.data.base_currency,
          institutions:
            institutions.data.length === 1
              ? t("settings.institutions.count.one", { count: 1 })
              : t("settings.institutions.count", {
                  count: institutions.data.length,
                }),
          payees:
            payees.data.length === 1
              ? t("settings.payees.count.one", { count: 1 })
              : t("settings.payees.count", { count: payees.data.length }),
        })
      : undefined;

  return (
    <Page width="content">
      <PageHeader size="lg">
        <PageHeaderTitleArea>
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>{t("more.settings")}</PageHeaderHeading>
              {summary !== undefined && (
                <PageHeaderSubheading>{summary}</PageHeaderSubheading>
              )}
            </PageHeaderTitle>
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
      </PageHeader>
      <PageBody>
        <div className={styles.sections}>
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
          <DisplaySection />
        </div>
      </PageBody>
    </Page>
  );
}
