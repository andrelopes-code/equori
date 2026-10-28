import { Button, IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import { Link } from "@slotted/react/link";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@slotted/react/menu";
import { Page, PageBody } from "@slotted/react/page";
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
import { Stack } from "@slotted/react/stack";
import { Tag } from "@slotted/react/tag";
import { toast } from "@slotted/react/toast";
import { useQuery } from "@tanstack/react-query";
import {
  Link as RouterLink,
  useNavigate,
  useParams,
  useSearch,
} from "@tanstack/react-router";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { errorText } from "@/api/problem";
import {
  statementQuery,
  statementsQuery,
  useRemoveStatementFacts,
} from "@/features/cards/api";
import { currentAndUnpaid } from "@/features/cards/card-totals";
import { ChargeActions } from "@/features/cards/charge-actions";
import type { ChargeAction } from "@/features/cards/charge-actions";
import { DisputeDialog } from "@/features/cards/dispute-dialog";
import { FactsDialog } from "@/features/cards/facts-dialog";
import { FinanceDialog } from "@/features/cards/finance-dialog";
import { PayDialog } from "@/features/cards/pay-dialog";
import { PlanDrawer } from "@/features/cards/plan-drawer";
import { ReconcileDialog } from "@/features/cards/reconcile-dialog";
import { RefundDialog } from "@/features/cards/refund-dialog";
import { addMonths, currentMonth } from "@/features/cards/reference-months";
import { StatementFigures } from "@/features/cards/statement-figures";
import { neighbours } from "@/features/cards/statement-groups";
import { StatementAnalysis } from "@/features/cards/statement-analysis";
import { StatementLines } from "@/features/cards/statement-lines";
import { unconfirmedQuery } from "@/features/accounts";
import {
  statementStatusTone,
  statementStatusWords,
} from "@/features/cards/statement-words";
import { useScale } from "@/features/setup";
import { formatDate, formatMonthTitle } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { QueryError } from "@/ui/query-error";
import { Presence } from "@/ui/presence";
import { useAppLink } from "@/ui/use-app-link";
import { PageBack } from "@/ui/page-back";

type Dialog = "pay" | "finance" | "reconcile" | "facts";

const owing = new Set(["closed", "partially_paid", "overdue"]);

// One statement: its terms, its lines by day, and the commands its state allows.
export function StatementPage() {
  const t = useT();
  const [locale] = useAppLocale();
  const api = useApi();
  const today = useToday();
  const navigate = useNavigate();
  const follow = useAppLink();
  const scale = useScale();
  const { accountId, statementId } = useParams({
    from: "/_authed/cards/$accountId/statements/$statementId",
  });
  const search = useSearch({
    from: "/_authed/cards/$accountId/statements/$statementId",
  });
  const statement = useQuery(statementQuery(api, accountId, statementId));
  const all = useQuery(
    statementsQuery(api, accountId, addMonths(currentMonth(today), -24)),
  );
  // A secondary mark: a failed read leaves the lines unmarked.
  const unconfirmed = useQuery(unconfirmedQuery(api, accountId));
  const remove = useRemoveStatementFacts();
  const [dialog, setDialog] = useState<Dialog | null>(
    search.pay === true ? "pay" : null,
  );
  const [action, setAction] = useState<ChargeAction | null>(null);
  const s = statement.data;
  const sc = scale ?? (() => 2);
  const openReference = currentAndUnpaid(all.data ?? []).current?.reference;
  const endAction = () => {
    setAction(null);
  };
  const around = neighbours(all.data ?? [], statementId);
  const close = () => {
    setDialog(null);
    if (search.pay === true) {
      void navigate({
        to: "/cards/$accountId/statements/$statementId",
        params: { accountId, statementId },
        search: {},
        replace: true,
      });
    }
  };
  const step = (
    id: string | undefined,
    key: "statement.previous" | "statement.next",
    glyph: "arrow-left" | "chevron-right",
  ) =>
    id === undefined ? null : (
      <Link
        variant="neutral"
        underline="none"
        aria-label={t(key)}
        href={`/cards/${accountId}/statements/${id}`}
        onClick={follow({
          to: "/cards/$accountId/statements/$statementId",
          params: { accountId, statementId: id },
        })}
      >
        <Icon>
          <Glyph name={glyph} />
        </Icon>
      </Link>
    );

  return (
    <Page width="full">
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
              {step(around.previous, "statement.previous", "arrow-left")}
              {step(around.next, "statement.next", "chevron-right")}
              {s !== undefined && owing.has(s.status) && (
                <Button
                  variant="outline"
                  tone="secondary"
                  onClick={() => {
                    setDialog("finance");
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
                    setDialog("reconcile");
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
                    setDialog("facts");
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
                      setDialog("pay");
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
                    <MenuItem
                      tone="danger"
                      onSelect={() => {
                        remove
                          .mutateAsync(statementId)
                          .catch((caught: unknown) => {
                            toast.show({
                              tone: "danger",
                              title: errorText(caught, t),
                            });
                          });
                      }}
                    >
                      {t("statement.removeFacts")}
                    </MenuItem>
                  </MenuContent>
                </Menu>
              )}
            </PageHeaderActions>
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
      </PageHeader>
      <PageBody>
        {statement.isError ? (
          <QueryError
            error={statement.error}
            onRetry={() => void statement.refetch()}
          />
        ) : s === undefined ? null : (
          <Stack gap={6}>
            <StatementFigures statement={s} scale={sc} />
            <StatementLines
              lines={s.postings}
              scale={sc}
              unconfirmed={
                new Set(
                  (unconfirmed.data ?? []).map((entry) => entry.transaction_id),
                )
              }
              lineActions={(line) =>
                line.card_role === "charge" ? (
                  <ChargeActions line={line} onAction={setAction} />
                ) : null
              }
            />
            {s.status !== "open" && (
              <StatementAnalysis
                accountId={accountId}
                statementId={statementId}
                scale={sc(s.amount_due.currency)}
              />
            )}
          </Stack>
        )}
      </PageBody>
      <Presence
        value={s !== undefined && dialog === "pay" ? dialog : undefined}
      >
        {() =>
          s === undefined ? null : (
            <PayDialog
              statement={s}
              scale={sc}
              onCancel={close}
              onDone={() => {
                close();
                toast.show({ tone: "success", title: t("pay.done") });
              }}
            />
          )
        }
      </Presence>
      <Presence
        value={s !== undefined && dialog === "finance" ? dialog : undefined}
      >
        {() =>
          s === undefined ? null : (
            <FinanceDialog
              statement={s}
              scale={sc}
              onCancel={close}
              onDone={() => {
                close();
                toast.show({ tone: "success", title: t("finance.done") });
              }}
            />
          )
        }
      </Presence>
      <Presence
        value={s !== undefined && dialog === "reconcile" ? dialog : undefined}
      >
        {() =>
          s === undefined ? null : (
            <ReconcileDialog
              statement={s}
              scale={sc}
              onCancel={close}
              onFacts={() => {
                setDialog("facts");
              }}
              onDone={() => {
                close();
                toast.show({
                  tone: "success",
                  title: t("reconcileStatement.done"),
                });
              }}
            />
          )
        }
      </Presence>
      <Presence
        value={s !== undefined && dialog === "facts" ? dialog : undefined}
      >
        {() =>
          s === undefined ? null : (
            <FactsDialog
              statement={s}
              scale={sc}
              onCancel={close}
              onDone={() => {
                close();
                toast.show({ tone: "success", title: t("facts.done") });
              }}
            />
          )
        }
      </Presence>
      <Presence value={action?.kind === "refund" ? action : undefined}>
        {(a) => (
          <RefundDialog
            line={a.line}
            scale={sc}
            onCancel={endAction}
            onDone={() => {
              endAction();
              toast.show({ tone: "success", title: t("refund.done") });
            }}
          />
        )}
      </Presence>
      <Presence value={action?.kind === "dispute" ? action : undefined}>
        {(a) => (
          <DisputeDialog
            line={a.line}
            open={a.open}
            onCancel={endAction}
            onDone={() => {
              endAction();
              toast.show({
                tone: "success",
                title: t(
                  a.open === undefined
                    ? "dispute.openDone"
                    : "dispute.resolveDone",
                ),
              });
            }}
          />
        )}
      </Presence>
      <Presence value={action?.kind === "plan" ? action : undefined}>
        {(a) => (
          <PlanDrawer
            planId={a.planId}
            name={a.line.description}
            openReference={openReference}
            scale={sc}
            onClose={endAction}
          />
        )}
      </Presence>
    </Page>
  );
}
