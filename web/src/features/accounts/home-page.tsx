import { useQuery } from "@tanstack/react-query";
import { ButtonLink } from "@slotted/react/button";
import { Page, PageBody } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderActions,
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
import { accountsQuery, balancesQuery } from "@/features/accounts/api";
import { Balances } from "@/features/accounts/balances";
import styles from "@/features/accounts/home-page.module.css";
import { UncategorizedShortcut } from "@/features/accounts/uncategorized-shortcut";
import { instrumentsQuery, settingsQuery } from "@/features/setup";
import { TransactionList } from "@/features/transactions";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { useSpaLink } from "@/ui/use-spa-link";
import { useViewport } from "@/ui/use-viewport";

const recentLimit = 5;

export function HomePage() {
  const t = useT();
  const viewport = useViewport();
  const spaLink = useSpaLink();
  const api = useApi();
  const today = useToday();
  const pending = [
    useQuery(accountsQuery(api)),
    useQuery(balancesQuery(api, today, "booked")),
    useQuery(settingsQuery(api)),
    useQuery(instrumentsQuery(api)),
  ].some((q) => q.data === undefined && !q.isError);
  return (
    <Page width="wide">
      <PageHeader>
        <PageHeaderTitleArea>
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>{t("nav.home")}</PageHeaderHeading>
            </PageHeaderTitle>
            {viewport !== "phone" && (
              <PageHeaderActions>
                <ButtonLink {...spaLink("/transactions/new")}>
                  {t("nav.new")}
                </ButtonLink>
              </PageHeaderActions>
            )}
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
      </PageHeader>
      <PageBody>
        <div className={styles.stack}>
          <UncategorizedShortcut />
          <Section aria-busy={pending}>
            <SectionHeader>
              <SectionTitle>
                <SectionHeading>{t("home.balances")}</SectionHeading>
              </SectionTitle>
            </SectionHeader>
            <SectionBody>
              <Balances />
            </SectionBody>
          </Section>
          <Section>
            <SectionHeader>
              <SectionTitle>
                <SectionHeading>{t("home.recent")}</SectionHeading>
              </SectionTitle>
            </SectionHeader>
            <SectionBody>
              <TransactionList
                search={{}}
                limit={recentLimit}
                infinite={false}
              />
            </SectionBody>
          </Section>
        </div>
      </PageBody>
    </Page>
  );
}
