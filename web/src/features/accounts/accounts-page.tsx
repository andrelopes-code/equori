import { useQuery } from "@tanstack/react-query";
import { Button } from "@slotted/react/button";
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
  ResultState,
  ResultStateContent,
  ResultStateTitle,
} from "@slotted/react/result-state";
import { Tree } from "@slotted/react/tree";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { AccountDialog } from "@/features/accounts/account-dialog";
import type { DialogTarget } from "@/features/accounts/account-dialog";
import { AccountNodes } from "@/features/accounts/account-nodes";
import { buildAccountTree } from "@/features/accounts/account-tree";
import type { TreeNode } from "@/features/accounts/account-tree";
import { accountsQuery, balancesQuery } from "@/features/accounts/api";
import { AccountsPlaceholder } from "@/features/accounts/accounts-placeholder";
import styles from "@/features/accounts/accounts-page.module.css";
import { CloseAccountDialog } from "@/features/accounts/close-account-dialog";
import { instrumentsQuery, settingsQuery, useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { QueryError } from "@/ui/query-error";

type Account = components["schemas"]["Account"];

type Dialog =
  | { type: "form"; target: DialogTarget }
  | { type: "close"; account: Account }
  | null;

function branchIds(nodes: TreeNode[]): string[] {
  return nodes.flatMap((n) =>
    n.children.length === 0 ? [] : [n.account.id, ...branchIds(n.children)],
  );
}

export function AccountsPage() {
  const t = useT();
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
    body =
      tree.length === 0 ? (
        <ResultState status="empty" reach="section">
          <ResultStateContent>
            <ResultStateTitle>{t("accounts.empty")}</ResultStateTitle>
          </ResultStateContent>
        </ResultState>
      ) : (
        <div className={styles.classes}>
          {tree.map((group) => (
            <section key={group.class}>
              <h2 className={styles.heading}>
                {t(`accounts.class.${group.class}`)}
              </h2>
              <Tree
                aria-label={t(`accounts.class.${group.class}`)}
                selectionMode="none"
                expandOn="expander"
                defaultExpandedKeys={branchIds(group.roots)}
              >
                <AccountNodes
                  nodes={group.roots}
                  balanceOf={(account) =>
                    account.kind === undefined
                      ? null
                      : (balanceOf.get(account.id) ?? {
                          amount: 0,
                          currency: account.currency,
                        })
                  }
                  scale={scale}
                  onEdit={(account) => {
                    setDialog({
                      type: "form",
                      target: { mode: "edit", account },
                    });
                  }}
                  onClose={(account) => {
                    setDialog({ type: "close", account });
                  }}
                />
              </Tree>
            </section>
          ))}
        </div>
      );
  }

  return (
    <Page width="wide">
      <PageHeader>
        <PageHeaderTitleArea>
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>{t("accounts.title")}</PageHeaderHeading>
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
