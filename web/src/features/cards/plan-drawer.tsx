import { Button } from "@slotted/react/button";
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerPanel,
  DrawerResizer,
  DrawerTitle,
} from "@slotted/react/drawer";
import { Field, FieldDescription, FieldLabel } from "@slotted/react/field";
import { Inline } from "@slotted/react/inline";
import { InlineMessage } from "@slotted/react/inline-message";
import { Stack } from "@slotted/react/stack";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableColumnHeader,
  TableContent,
  TableHead,
  TableLoader,
  TableRow,
  TableRowHeader,
} from "@slotted/react/table";
import { Tag } from "@slotted/react/tag";
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";
import { Fragment, useId, useState } from "react";

import { useApi } from "@/api/api-context";
import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { planQuery, useAnticipate, useCancelPlan } from "@/features/cards/api";
import { anticipation } from "@/features/cards/card-math";
import { planProgress } from "@/features/cards/card-plans";
import { planStatusTone, planStatusWords } from "@/features/cards/plan-words";
import { formatMonthTitle } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { DateInput } from "@/ui/date-input";
import { MoneyInput } from "@/ui/money-input";
import { QueryError } from "@/ui/query-error";
import { compactQuery, useMediaQuery } from "@/ui/use-media-query";
import { useOverlayOpen } from "@/ui/use-overlay-open";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Money = components["schemas"]["Money"];
type ScheduledInstallment = components["schemas"]["ScheduledInstallment"];

// M07 and M21: an installment plan's schedule against the open statement, and the two ways out
// of it: cancelling what is not yet billed, or bringing the remaining installments into the open
// statement for an amount the bank quotes.
export function PlanDrawer({
  planId,
  name,
  openReference,
  scale,
  onClose,
}: {
  planId: string;
  name: string;
  // The statement purchases go on now; absent, nothing can be brought forward.
  openReference: string | undefined;
  scale: (code: string) => number;
  onClose: () => void;
}) {
  const t = useT();
  const overlayOpen = useOverlayOpen();
  const phone = useMediaQuery(compactQuery);
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const today = useToday();
  const formId = useId();
  const plan = useQuery(planQuery(useApi(), planId));
  const cancel = useCancelPlan();
  const anticipate = useAnticipate();
  const [mode, setMode] = useState<"cancel" | "anticipate" | null>(null);
  const [date, setDate] = useState(today);
  const [paid, setPaid] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const p = plan.data;
  const money = (m: Money) => fmt.money(m, scale(m.currency));
  const reference = openReference ?? today.slice(0, 7);
  const progress = p === undefined ? undefined : planProgress(p, reference);
  const ahead =
    p === undefined || openReference === undefined
      ? []
      : p.installments.filter(
          (i) => !i.reversed && i.statement > openReference,
        );
  const quote = anticipation(
    ahead.map((i) => i.amount.amount),
    paid ?? ahead.reduce((sum, i) => sum + i.amount.amount, 0),
  );
  const currency = progress?.each?.currency;
  const state = (i: ScheduledInstallment) =>
    i.reversed
      ? { tone: "secondary" as const, word: t("plan.reversed") }
      : i.statement <= reference
        ? { tone: "success" as const, word: t("plan.billed") }
        : { tone: "accent" as const, word: t("plan.coming") };
  const submit = () => {
    setError(null);
    const request =
      mode === "cancel"
        ? cancel.mutateAsync({ id: planId, body: { date } })
        : mode === "anticipate" &&
            currency !== undefined &&
            openReference !== undefined &&
            ahead.length > 0
          ? anticipate.mutateAsync({
              id: planId,
              body: {
                date,
                from_installment: ahead[0]?.number ?? 0,
                to_installment: ahead[ahead.length - 1]?.number ?? 0,
                target_statement: openReference,
                amount: { amount: quote.sum - quote.discount, currency },
              },
            })
          : null;
    request
      ?.then(() => {
        setMode(null);
      })
      .catch((caught: unknown) => {
        setError(errorText(caught, t));
      });
  };
  return (
    <Drawer
      open={overlayOpen}
      side={phone ? "bottom" : "end"}
      size={phone ? "content" : "lg"}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DrawerPanel>
        {phone && <DrawerResizer />}
        <DrawerHeader>
          <DrawerTitle>{t("plan.title", { name })}</DrawerTitle>
          <DrawerDescription>
            {p === undefined || progress?.each === undefined
              ? t("plan.loading")
              : t("plan.summary", {
                  count: p.count,
                  each: money(progress.each),
                })}
          </DrawerDescription>
          <DrawerClose />
        </DrawerHeader>
        <DrawerBody>
          {plan.isError ? (
            <QueryError
              error={plan.error}
              onRetry={() => void plan.refetch()}
            />
          ) : (
            <Stack gap={5}>
              {p !== undefined && progress?.remaining !== undefined && (
                <Stack gap={1}>
                  <Inline>
                    <Tag size="sm" tone={planStatusTone[p.status]}>
                      {t(planStatusWords[p.status])}
                    </Tag>
                  </Inline>
                  <Text size="sm">
                    {t("plan.standing", {
                      billed: progress.billed,
                      count: p.count,
                      remaining: money(progress.remaining),
                    })}
                  </Text>
                  {p.interest !== undefined && p.interest.amount !== 0 && (
                    <Text size="sm" tone="muted">
                      {t("plan.interest", { amount: money(p.interest) })}
                    </Text>
                  )}
                </Stack>
              )}
              <Table columns={4} variant="framed">
                <TableContent>
                  <TableCaption>{t("plan.schedule")}</TableCaption>
                  <TableHead>
                    <TableRow>
                      <TableColumnHeader>{t("plan.number")}</TableColumnHeader>
                      <TableColumnHeader>
                        {t("plan.statement")}
                      </TableColumnHeader>
                      <TableColumnHeader numeric>
                        {t("plan.amount")}
                      </TableColumnHeader>
                      <TableColumnHeader>{t("plan.state")}</TableColumnHeader>
                    </TableRow>
                  </TableHead>
                  {p === undefined ? (
                    <TableLoader skeletonRows={4} />
                  ) : (
                    <TableBody>
                      {p.installments.map((i) => {
                        const s = state(i);
                        return (
                          <TableRow key={i.number} value={String(i.number)}>
                            <TableRowHeader>
                              {t("plan.numberOf", {
                                number: i.number,
                                count: p.count,
                              })}
                            </TableRowHeader>
                            <TableCell>
                              {formatMonthTitle(i.statement, locale)}
                            </TableCell>
                            <TableCell numeric>{money(i.amount)}</TableCell>
                            <TableCell>
                              <Tag size="sm" tone={s.tone}>
                                {s.word}
                              </Tag>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  )}
                </TableContent>
              </Table>
              {mode !== null && (
                // Workaround for Slotted finding "dialog has no place for a form around its parts".
                <form
                  id={formId}
                  noValidate
                  onSubmit={(event) => {
                    event.preventDefault();
                    submit();
                  }}
                >
                  <Stack gap={4}>
                    {error !== null && (
                      <InlineMessage tone="danger">{error}</InlineMessage>
                    )}
                    <InlineMessage
                      tone={mode === "cancel" ? "warning" : "accent"}
                    >
                      {mode === "cancel"
                        ? t("plan.cancelHint", {
                            remaining:
                              progress?.remaining === undefined
                                ? ""
                                : money(progress.remaining),
                          })
                        : t("plan.anticipateHint", {
                            count: ahead.length,
                            month: formatMonthTitle(reference, locale),
                          })}
                    </InlineMessage>
                    {mode === "anticipate" && currency !== undefined && (
                      <Field>
                        <FieldLabel>{t("plan.paid")}</FieldLabel>
                        <MoneyInput
                          value={quote.sum - quote.discount}
                          onChange={setPaid}
                          currency={currency}
                          scale={scale(currency)}
                          sign="neutral"
                        />
                        <FieldDescription>
                          {t("plan.discount", {
                            sum: money({ amount: quote.sum, currency }),
                            discount: money({
                              amount: quote.discount,
                              currency,
                            }),
                          })}
                        </FieldDescription>
                      </Field>
                    )}
                    <Field>
                      <FieldLabel>{t("plan.date")}</FieldLabel>
                      <DateInput name="date" value={date} onChange={setDate} />
                    </Field>
                  </Stack>
                </form>
              )}
            </Stack>
          )}
        </DrawerBody>
        {p?.status === "active" && progress !== undefined && (
          <DrawerFooter>
            {/* Keyed apart so the confirm is a new button: a reused one would take the click
                that chose the mode as its own submit. */}
            {mode === null ? (
              <Fragment key="choose">
                <Button
                  variant="outline"
                  tone="danger"
                  onClick={() => {
                    setMode("cancel");
                  }}
                >
                  {t("plan.cancel")}
                </Button>
                <Button
                  variant="outline"
                  tone="secondary"
                  disabled={ahead.length === 0}
                  onClick={() => {
                    setMode("anticipate");
                  }}
                >
                  {t("plan.anticipate")}
                </Button>
              </Fragment>
            ) : (
              <Fragment key="confirm">
                <Button
                  variant="ghost"
                  tone="secondary"
                  onClick={() => {
                    setMode(null);
                    setError(null);
                  }}
                >
                  {t("detail.cancel")}
                </Button>
                <Button
                  type="submit"
                  form={formId}
                  tone={mode === "cancel" ? "danger" : "accent"}
                  disabled={mode === "anticipate" && quote.discount < 0}
                  loading={cancel.isPending || anticipate.isPending}
                >
                  {t(
                    mode === "cancel"
                      ? "plan.cancelSubmit"
                      : "plan.anticipateSubmit",
                  )}
                </Button>
              </Fragment>
            )}
          </DrawerFooter>
        )}
      </DrawerPanel>
    </Drawer>
  );
}
