import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableColumnHeader,
  TableContent,
  TableEmpty,
  TableHead,
  TableLoader,
  TableRow,
  TableRowHeader,
} from "@slotted/react/table";
import { Tag } from "@slotted/react/tag";
import { VisuallyHidden } from "@slotted/react/visually-hidden";
import { useQueries } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { planQuery, statementQuery } from "@/features/cards/api";
import { planIDs, planProgress } from "@/features/cards/card-plans";
import { PlanDrawer } from "@/features/cards/plan-drawer";
import { addMonths } from "@/features/cards/reference-months";
import { planStatusTone, planStatusWords } from "@/features/cards/plan-words";
import { formatMonthTitle } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { PhoneList } from "@/ui/phone-list";
import { compactQuery, useMediaQuery } from "@/ui/use-media-query";
import { Presence } from "@/ui/presence";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Statement = components["schemas"]["StatementSummary"];

// Every plan still running bills an installment on each statement, so the two statements before
// the open one, the open one and the next name the plans running now, those that just ended or
// were cancelled, and those whose first installment falls on the next statement. The statements
// further ahead exist only to hold installments and name no other plan.
const before = 2;
const after = 1;

// M07: the card's installment plans, where each stands against the open statement, and the
// drawer that cancels or brings one forward.
export function PlansTab({
  accountId,
  statements,
  openReference,
  scale,
}: {
  accountId: string;
  statements: readonly Statement[];
  openReference: string | undefined;
  scale: (code: string) => number;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const api = useApi();
  const [opened, setOpened] = useState<string | null>(null);
  const anchor =
    openReference ??
    [...statements].sort((a, b) => b.reference.localeCompare(a.reference))[0]
      ?.reference ??
    "";
  const latest = statements.filter(
    (s) =>
      s.reference >= addMonths(anchor, -before) &&
      s.reference <= addMonths(anchor, after),
  );
  const details = useQueries({
    queries: latest.map((s) => statementQuery(api, accountId, s.id)),
  });
  const read = details.flatMap((d) => (d.data === undefined ? [] : [d.data]));
  const ids = planIDs(read);
  const names = new Map<string, string>();
  for (const s of read) {
    for (const line of s.postings) {
      if (line.installment !== undefined)
        names.set(line.installment.plan_id, line.description);
    }
  }
  const plans = useQueries({
    queries: ids.map((id) => planQuery(api, id)),
  });
  const reference = anchor;
  const pending =
    details.some((d) => d.isPending) || plans.some((p) => p.isPending);
  const name = (id: string) => {
    const text = names.get(id) ?? "";
    return text === "" ? t("ledger.untitled") : text;
  };
  const compact = useMediaQuery(compactQuery);
  const money = (m: components["schemas"]["Money"]) =>
    fmt.money(m, scale(m.currency));
  return (
    <>
      {compact ? (
        <PhoneList
          label={t("plans.list")}
          loading={pending && ids.length === 0}
          empty={t("plans.none")}
          rows={ids.map((id, i) => {
            const plan = plans[i]?.data;
            const progress =
              plan === undefined ? undefined : planProgress(plan, reference);
            return {
              key: id,
              title: name(id),
              lines: [
                plan === undefined || progress === undefined
                  ? null
                  : [
                      t("plans.progress", {
                        billed: progress.billed,
                        count: plan.count,
                      }),
                      progress.last === undefined
                        ? undefined
                        : [
                            t("plans.last"),
                            formatMonthTitle(progress.last, locale),
                          ].join(": "),
                    ]
                      .filter((part) => part !== undefined)
                      .join(" · "),
                progress?.remaining === undefined
                  ? null
                  : [t("plans.remaining"), money(progress.remaining)].join(
                      ": ",
                    ),
                plan === undefined ? null : (
                  <Tag
                    key="status"
                    size="sm"
                    tone={planStatusTone[plan.status]}
                  >
                    {t(planStatusWords[plan.status])}
                  </Tag>
                ),
              ].filter((line) => line !== null),
              end:
                progress?.each === undefined ? undefined : money(progress.each),
              actions: (
                <IconButton
                  size="sm"
                  variant="ghost"
                  tone="secondary"
                  aria-label={t("plans.openPlan", { name: name(id) })}
                  onClick={() => {
                    setOpened(id);
                  }}
                >
                  <Icon>
                    <Glyph name="chevron-right" />
                  </Icon>
                </IconButton>
              ),
            };
          })}
        />
      ) : (
        <Table columns={7} variant="framed">
          <TableContent>
            <TableCaption>{t("plans.list")}</TableCaption>
            <TableHead>
              <TableRow>
                <TableColumnHeader>{t("plans.purchase")}</TableColumnHeader>
                <TableColumnHeader>{t("plans.billed")}</TableColumnHeader>
                <TableColumnHeader numeric>{t("plans.each")}</TableColumnHeader>
                <TableColumnHeader numeric>
                  {t("plans.remaining")}
                </TableColumnHeader>
                <TableColumnHeader>{t("plans.last")}</TableColumnHeader>
                <TableColumnHeader>{t("plans.status")}</TableColumnHeader>
                <TableColumnHeader align="end">
                  <VisuallyHidden>{t("links.actions")}</VisuallyHidden>
                </TableColumnHeader>
              </TableRow>
            </TableHead>
            {pending && ids.length === 0 ? (
              <TableLoader skeletonRows={3} />
            ) : (
              <TableBody>
                {ids.length === 0 && <TableEmpty>{t("plans.none")}</TableEmpty>}
                {ids.map((id, i) => {
                  const plan = plans[i]?.data;
                  const progress =
                    plan === undefined
                      ? undefined
                      : planProgress(plan, reference);
                  return (
                    <TableRow key={id} value={id}>
                      <TableRowHeader>{name(id)}</TableRowHeader>
                      <TableCell>
                        {plan === undefined || progress === undefined
                          ? null
                          : t("plans.progress", {
                              billed: progress.billed,
                              count: plan.count,
                            })}
                      </TableCell>
                      <TableCell numeric>
                        {progress?.each === undefined
                          ? null
                          : money(progress.each)}
                      </TableCell>
                      <TableCell numeric>
                        {progress?.remaining === undefined
                          ? null
                          : money(progress.remaining)}
                      </TableCell>
                      <TableCell>
                        {progress?.last === undefined
                          ? null
                          : formatMonthTitle(progress.last, locale)}
                      </TableCell>
                      <TableCell>
                        {plan !== undefined && (
                          <Tag size="sm" tone={planStatusTone[plan.status]}>
                            {t(planStatusWords[plan.status])}
                          </Tag>
                        )}
                      </TableCell>
                      <TableCell align="end">
                        <IconButton
                          size="sm"
                          variant="ghost"
                          tone="secondary"
                          aria-label={t("plans.openPlan", { name: name(id) })}
                          onClick={() => {
                            setOpened(id);
                          }}
                        >
                          <Icon>
                            <Glyph name="chevron-right" />
                          </Icon>
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            )}
          </TableContent>
        </Table>
      )}
      <Presence value={opened ?? undefined}>
        {(planId) => (
          <PlanDrawer
            planId={planId}
            name={name(planId)}
            openReference={openReference}
            scale={scale}
            onClose={() => {
              setOpened(null);
            }}
          />
        )}
      </Presence>
    </>
  );
}
