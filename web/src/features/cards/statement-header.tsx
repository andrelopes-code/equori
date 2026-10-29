import { Button, IconButton } from "@slotted/react/button";
import { ButtonGroup } from "@slotted/react/button-group";
import { Glyph, Icon } from "@slotted/react/icon";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@slotted/react/menu";
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderHeading,
  PageHeaderMarks,
  PageHeaderSubheading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import { Tag } from "@slotted/react/tag";
import { toast } from "@slotted/react/toast";
import { Link as RouterLink } from "@tanstack/react-router";

import type { components } from "@/api/schema.gen";
import { errorText } from "@/api/problem";
import { useRemoveStatementFacts } from "@/features/cards/api";
import { StatementStep } from "@/features/cards/statement-step";
import {
  statementStatusTone,
  statementStatusWords,
} from "@/features/cards/statement-words";
import { formatDate, formatMonthTitle } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { PageBack } from "@/ui/page-back";

type Statement = components["schemas"]["StatementDetail"];

export type StatementDialog = "pay" | "finance" | "reconcile" | "facts";

const owing = new Set(["closed", "partially_paid", "overdue"]);

interface StatementHeaderProps {
  accountId: string;
  statementId: string;
  statement: Statement | undefined;
  around: { previous?: string; next?: string };
  onDialog: (dialog: StatementDialog) => void;
}

// The statement's title, state and terms, the steps to its neighbours, and the commands its
// state allows.
export function StatementHeader({
  accountId,
  statementId,
  statement: s,
  around,
  onDialog,
}: StatementHeaderProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const remove = useRemoveStatementFacts();

  function handleRemoveFacts() {
    remove.mutateAsync(statementId).catch((caught: unknown) => {
      toast.show({ tone: "danger", title: errorText(caught, t) });
    });
  }

  return (
    <PageHeader size="lg">
      <PageHeaderTitleArea>
        <PageBack
          render={(props) => (
            <RouterLink
              {...props}
              to="/cards/$accountId"
              params={{ accountId }}
            />
          )}
        >
          {t("nav.cards")}
        </PageBack>
        <PageHeaderTitleRow>
          <PageHeaderTitle>
            <PageHeaderHeading>
              {s === undefined
                ? t("statement.title")
                : t("statement.titleOf", {
                    month: formatMonthTitle(s.reference, locale),
                  })}
            </PageHeaderHeading>
            {s !== undefined && (
              <PageHeaderMarks>
                <Tag size="sm" tone={statementStatusTone[s.status]}>
                  {t(statementStatusWords[s.status])}
                </Tag>
                {s.reconciled && (
                  <Tag size="sm" tone="success">
                    {t("statement.reconciled")}
                  </Tag>
                )}
              </PageHeaderMarks>
            )}
            {s !== undefined && (
              <PageHeaderSubheading>
                {t("cards.closesDue", {
                  closing: formatDate(s.closing_date, locale),
                  due: formatDate(s.due_date, locale),
                })}
              </PageHeaderSubheading>
            )}
          </PageHeaderTitle>
          <PageHeaderActions>
            <ButtonGroup
              aria-label={t("statement.steps")}
              variant="outline"
              tone="secondary"
            >
              <StatementStep
                accountId={accountId}
                statementId={around.previous}
                label={t("statement.previous")}
                direction="previous"
              />
              <StatementStep
                accountId={accountId}
                statementId={around.next}
                label={t("statement.next")}
                direction="next"
              />
            </ButtonGroup>
            {s !== undefined && owing.has(s.status) && (
              <Button
                variant="outline"
                tone="secondary"
                onClick={() => {
                  onDialog("finance");
                }}
              >
                {t("statement.finance")}
              </Button>
            )}
            {s !== undefined && owing.has(s.status) && !s.reconciled && (
              <Button
                variant="outline"
                tone="secondary"
                onClick={() => {
                  onDialog("reconcile");
                }}
              >
                {t("statement.reconcile")}
              </Button>
            )}
            {s !== undefined && s.status !== "financed" && (
              <Button
                variant="outline"
                tone="secondary"
                onClick={() => {
                  onDialog("facts");
                }}
              >
                {t("statement.facts")}
              </Button>
            )}
            {s !== undefined &&
              s.status !== "financed" &&
              s.status !== "paid" && (
                <Button
                  onClick={() => {
                    onDialog("pay");
                  }}
                >
                  {t("statement.pay")}
                </Button>
              )}
            {s?.institution?.source === "owner" && (
              <Menu>
                <MenuTrigger
                  render={(props) => (
                    <IconButton
                      {...props}
                      variant="ghost"
                      tone="secondary"
                      aria-label={t("account.more")}
                    >
                      <Icon>
                        <Glyph name="ellipsis" />
                      </Icon>
                    </IconButton>
                  )}
                />
                <MenuContent>
                  <MenuItem tone="danger" onSelect={handleRemoveFacts}>
                    {t("statement.removeFacts")}
                  </MenuItem>
                </MenuContent>
              </Menu>
            )}
          </PageHeaderActions>
        </PageHeaderTitleRow>
      </PageHeaderTitleArea>
    </PageHeader>
  );
}
