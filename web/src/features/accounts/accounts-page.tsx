import { useQuery } from "@tanstack/react-query";
import { Button } from "@slotted/react/button";
import { Page, PageBody } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderArea,
  PageHeaderContent,
  PageHeaderHeading,
  PageHeaderSubheading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import {
  ResultState,
  ResultStateContent,
  ResultStateTitle,
} from "@slotted/react/result-state";
import {
  Section,
  SectionBody,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { AccountDialog } from "@/features/accounts/account-dialog";
import type { DialogTarget } from "@/features/accounts/account-dialog";
import { buildAccountTree } from "@/features/accounts/account-tree";
import { accountsQuery, balancesQuery } from "@/features/accounts/api";
import { AccountsPlaceholder } from "@/features/accounts/accounts-placeholder";
import { BalanceSheetTable } from "@/features/accounts/balance-sheet-table";
import { CategoryIndex } from "@/features/accounts/category-index";
import styles from "@/features/accounts/accounts-page.module.css";
import { CloseAccountDialog } from "@/features/accounts/close-account-dialog";
import { instrumentsQuery, settingsQuery, useScale } from "@/features/setup";
import { formatMoney } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { FigureStrip } from "@/ui/figure-strip";
import { FigureStripItem } from "@/ui/figure-strip-item";
import { MoneyFigure } from "@/ui/money-figure";
import { QueryError } from "@/ui/query-error";

type Account = components["schemas"]["Account"];

type Dialog =
  | { type: "form"; target: DialogTarget }
  | { type: "close"; account: Account }
  | null;

export function AccountsPage() {
  const t = useT();
  const [locale] = useAppLocale();
  const api = useApi();
  const today = useToday();
  const scale = useScale();
  const accounts = useQuery(accountsQuery(api));
  const balances = useQuery(balancesQuery(api, today, "booked"));
  const settings = useQuery(settingsQuery(api));
  const instruments = useQuery(instrumentsQuery(api));
  const [dialog, setDialog] = useState<Dialog>(null);
  const closeDialog = () => {
    setDialog(null);
  };
  const queries = [accounts, balances, settings, instruments];

  const failed = queries.find((q) => q.isError);
  let body;
  let newTarget: DialogTarget | null = null;
  let sheet: {
    base: string;
    assets: number;
    owed: number;
    scale: number;
  } | null = null;
  if (failed?.error) {
    body = (
      <QueryError
        error={failed.error}
        onRetry={() => {
          for (const query of queries) {
            if (query.isError) void query.refetch();
          }
        }}
      />
    );
  } else if (
    accounts.data === undefined ||
    balances.data === undefined ||
    settings.data === undefined ||
    instruments.data === undefined ||
    scale === null
  ) {
    body = <AccountsPlaceholder />;
  } else {
    newTarget = {
      mode: "create",
      baseCurrency: settings.data.base_currency,
      currencies: instruments.data.items.map((i) => i.code),
    };
    const open = accounts.data.filter((a) => a.closed_on === undefined);
    const balanceOf = new Map(
      balances.data.map((b) => [b.account_id, b.balance]),
    );
    const tree = buildAccountTree(open);
    const base = settings.data.base_currency;
    const rootsOf = (cls: string) =>
      tree.find((group) => group.class === cls)?.roots ?? [];
    const balance = (account: Account) =>
      balanceOf.get(account.id) ?? { amount: 0, currency: account.currency };
    const totalOf = (cls: string) =>
      open
        .filter((a) => a.class === cls && a.kind !== undefined)
        .map(balance)
        .filter((b) => b.currency === base)
        .reduce((sum, b) => sum + b.amount, 0);
    const assets = totalOf("asset");
    const owed = -totalOf("liability");
    sheet = { base, assets, owed, scale: scale(base) };
    const edit = (account: Account) => {
      setDialog({ type: "form", target: { mode: "edit", account } });
    };
    const close = (account: Account) => {
      setDialog({ type: "close", account });
    };
    body =
      tree.length === 0 ? (
        <ResultState status="empty" reach="section">
          <ResultStateContent>
            <ResultStateTitle>{t("accounts.empty")}</ResultStateTitle>
          </ResultStateContent>
        </ResultState>
      ) : (
        <div className={styles.layout}>
          <Section>
            <SectionHeader>
              <SectionTitle>
                <SectionHeading>{t("accounts.sheet")}</SectionHeading>
              </SectionTitle>
            </SectionHeader>
            <SectionBody>
              <div className={styles.stack}>
                {(["asset", "liability"] as const).map(
                  (cls) =>
                    rootsOf(cls).length > 0 && (
                      <BalanceSheetTable
                        key={cls}
                        label={t(`accounts.class.${cls}`)}
                        roots={rootsOf(cls)}
                        owed={cls === "liability"}
                        base={base}
                        balanceOf={balance}
                        scale={scale}
                        onEdit={edit}
                        onClose={close}
                      />
                    ),
                )}
              </div>
            </SectionBody>
          </Section>
          <Section>
            <SectionHeader>
              <SectionTitle>
                <SectionHeading>{t("accounts.categories")}</SectionHeading>
              </SectionTitle>
            </SectionHeader>
            <SectionBody>
              <div className={styles.stack}>
                {(["income", "expense", "equity"] as const).map(
                  (cls) =>
                    rootsOf(cls).length > 0 && (
                      <div key={cls} className={styles.group}>
                        <h3 className={styles.groupTitle}>
                          {t(`accounts.class.${cls}`)}
                        </h3>
                        <CategoryIndex
                          label={t(`accounts.class.${cls}`)}
                          roots={rootsOf(cls)}
                          onEdit={edit}
                          onClose={close}
                        />
                      </div>
                    ),
                )}
              </div>
            </SectionBody>
          </Section>
        </div>
      );
  }

  return (
    <Page width="wide">
      <PageHeader size="lg">
        <PageHeaderTitleArea>
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>{t("accounts.title")}</PageHeaderHeading>
              {sheet !== null && (
                <PageHeaderSubheading>
                  {t("accounts.networth.sub", {
                    amount: formatMoney(
                      {
                        amount: sheet.assets - sheet.owed,
                        currency: sheet.base,
                      },
                      sheet.scale,
                      locale,
                    ),
                  })}
                </PageHeaderSubheading>
              )}
            </PageHeaderTitle>
            <PageHeaderActions>
              {newTarget !== null && (
                <Button
                  tone="secondary"
                  variant="outline"
                  onClick={() => {
                    setDialog({ type: "form", target: newTarget });
                  }}
                >
                  {t("accounts.new")}
                </Button>
              )}
            </PageHeaderActions>
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
        {sheet !== null && (
          <PageHeaderArea>
            <PageHeaderContent>
              <FigureStrip label={t("accounts.figures")} ruled={false}>
                {(
                  [
                    ["accounts.class.asset", sheet.assets],
                    ["accounts.class.liability", sheet.owed],
                    ["accounts.networth", sheet.assets - sheet.owed],
                  ] as const
                ).map(([key, amount]) => (
                  <FigureStripItem key={key} label={t(key)}>
                    <MoneyFigure
                      money={{ amount, currency: sheet.base }}
                      scale={sheet.scale}
                      size="lg"
                    />
                  </FigureStripItem>
                ))}
              </FigureStrip>
            </PageHeaderContent>
          </PageHeaderArea>
        )}
      </PageHeader>
      <PageBody>{body}</PageBody>
      {dialog?.type === "form" && accounts.data !== undefined && (
        <AccountDialog
          target={dialog.target}
          accounts={accounts.data}
          onClose={closeDialog}
        />
      )}
      {dialog?.type === "close" && (
        <CloseAccountDialog account={dialog.account} onClose={closeDialog} />
      )}
    </Page>
  );
}
