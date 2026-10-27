import {
  DescriptionList,
  DescriptionListDescription,
  DescriptionListItem,
  DescriptionListTerm,
} from "@slotted/react/description-list";
import { Page, PageBody } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderBack,
  PageHeaderHeading,
  PageHeaderNav,
  PageHeaderSubheading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import { SkeletonText } from "@slotted/react/skeleton";
import { Stack } from "@slotted/react/stack";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableColumnHeader,
  TableContent,
  TableEmpty,
  TableHead,
  TableRow,
  TableRowHeader,
} from "@slotted/react/table";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { useRef, useState } from "react";

import { useApi } from "@/api/api-context";
import type { TableHandle } from "@slotted/react/table";
import { accountsQuery } from "@/features/accounts";
import { agenda } from "@/features/planning/agenda";
import { AgendaTable } from "@/features/planning/agenda-table";
import { occurrencesQuery, scheduleQuery } from "@/features/planning/api";
import { calendarLabel } from "@/features/planning/calendar-label";
import { EndDialog } from "@/features/planning/end-dialog";
import { PauseDialog } from "@/features/planning/pause-dialog";
import {
  currentTerms,
  kindLabel,
  recurrenceWords,
} from "@/features/planning/schedule-words";
import { TermsDialog } from "@/features/planning/terms-dialog";
import { useScale } from "@/features/setup";
import { formatDate, shiftDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { HeaderAction } from "@/ui/header-action";
import { QueryError } from "@/ui/query-error";

type Dialog = "terms" | "pause" | "end";

// One schedule: its facts, its terms versions, its pauses and its occurrences half a year either
// side of today (listOccurrences reads at most 366 days).
export function SchedulePage() {
  const t = useT();
  const [locale] = useAppLocale();
  const api = useApi();
  const today = useToday();
  const fmt = useMoneyFormat();
  const scale = useScale();
  const { id } = useParams({ from: "/_authed/planning/schedules/$id" });
  const schedule = useQuery(scheduleQuery(api, id));
  const occurrences = useQuery(
    occurrencesQuery(api, shiftDate(today, -182), shiftDate(today, 183), {
      schedule_id: id,
    }),
  );
  const accounts = useQuery(accountsQuery(api));
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const table = useRef<TableHandle>(null);
  const close = () => {
    setDialog(null);
  };
  if (schedule.isError)
    return (
      <Page width="full">
        <PageBody>
          <QueryError
            error={schedule.error}
            onRetry={() => void schedule.refetch()}
          />
        </PageBody>
      </Page>
    );
  if (schedule.data === undefined || scale === null)
    return (
      <Page width="full" loading>
        <PageBody>
          <SkeletonText lines={6} />
        </PageBody>
      </Page>
    );
  const s = schedule.data;
  const name = s.description === "" ? t("ledger.untitled") : s.description;
  const terms = currentTerms(s.terms, today);
  const names = new Map((accounts.data ?? []).map((a) => [a.id, a.name]));
  const view = agenda(occurrences.data ?? [], [], [s], {});
  return (
    <Page width="full">
      <PageHeader size="lg">
        <PageHeaderTitleArea>
          <PageHeaderNav>
            <PageHeaderBack
              render={(props) => (
                <Link {...props} to="/planning" search={{ tab: "schedules" }} />
              )}
            >
              {t("planning.tab.schedules")}
            </PageHeaderBack>
          </PageHeaderNav>
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>{name}</PageHeaderHeading>
              <PageHeaderSubheading>
                {terms === undefined
                  ? t(kindLabel[s.kind])
                  : `${t(kindLabel[s.kind])} · ${recurrenceWords(terms.recurrence, t, locale)}`}
              </PageHeaderSubheading>
            </PageHeaderTitle>
            <PageHeaderActions>
              <HeaderAction
                label={t("schedule.pause")}
                glyph="pause"
                onClick={() => {
                  setDialog("pause");
                }}
              />
              <HeaderAction
                label={t("schedule.end")}
                glyph="stop"
                onClick={() => {
                  setDialog("end");
                }}
              />
              <HeaderAction
                primary
                label={t("schedule.changeTerms")}
                glyph="calendar"
                wordsOnly
                onClick={() => {
                  setDialog("terms");
                }}
              />
            </PageHeaderActions>
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
      </PageHeader>
      <PageBody>
        <Stack gap={6}>
          <DescriptionList layout="stack" aria-label={t("schedule.facts")}>
            <DescriptionListItem>
              <DescriptionListTerm>{t("schedule.account")}</DescriptionListTerm>
              <DescriptionListDescription>
                {names.get(s.account_id)}
              </DescriptionListDescription>
            </DescriptionListItem>
            <DescriptionListItem>
              <DescriptionListTerm>
                {t("schedules.counterpart")}
              </DescriptionListTerm>
              <DescriptionListDescription>
                {names.get(s.counterpart_id)}
              </DescriptionListDescription>
            </DescriptionListItem>
            <DescriptionListItem>
              <DescriptionListTerm>{t("schedules.ends")}</DescriptionListTerm>
              <DescriptionListDescription>
                {s.ends_on === undefined
                  ? t("schedule.noEnd")
                  : formatDate(s.ends_on, locale)}
              </DescriptionListDescription>
            </DescriptionListItem>
            <DescriptionListItem>
              <DescriptionListTerm>
                {t("schedule.calendar")}
              </DescriptionListTerm>
              <DescriptionListDescription>
                <Link
                  to="/settings"
                  search={{ section: "calendars", calendar: s.calendar }}
                >
                  {calendarLabel(t, s.calendar)}
                </Link>
              </DescriptionListDescription>
            </DescriptionListItem>
            <DescriptionListItem>
              <DescriptionListTerm>
                {t("schedule.tolerance")}
              </DescriptionListTerm>
              <DescriptionListDescription>
                {new Intl.NumberFormat(locale, {
                  maximumFractionDigits: 2,
                }).format(s.match_tolerance_bp / 100)}
              </DescriptionListDescription>
            </DescriptionListItem>
            <DescriptionListItem>
              <DescriptionListTerm>{t("schedule.grace")}</DescriptionListTerm>
              <DescriptionListDescription>
                {t("schedule.days", { count: s.grace_days })}
              </DescriptionListDescription>
            </DescriptionListItem>
          </DescriptionList>
          <Table columns={3} variant="framed">
            <TableContent>
              <TableCaption>{t("schedule.terms")}</TableCaption>
              <TableHead>
                <TableRow>
                  <TableColumnHeader>
                    {t("schedule.effectiveFrom")}
                  </TableColumnHeader>
                  <TableColumnHeader numeric>
                    {t("schedule.amount")}
                  </TableColumnHeader>
                  <TableColumnHeader>
                    {t("schedules.recurrence")}
                  </TableColumnHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {s.terms.map((v) => (
                  <TableRow key={v.effective_from} value={v.effective_from}>
                    <TableRowHeader>
                      {formatDate(v.effective_from, locale)}
                    </TableRowHeader>
                    <TableCell numeric>
                      {fmt.money(v.amount, scale(v.amount.currency))}
                    </TableCell>
                    <TableCell>
                      {recurrenceWords(v.recurrence, t, locale)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </TableContent>
          </Table>
          <Table columns={2} variant="framed">
            <TableContent>
              <TableCaption>{t("schedule.pauses")}</TableCaption>
              <TableHead>
                <TableRow>
                  <TableColumnHeader>
                    {t("schedule.pauseFrom")}
                  </TableColumnHeader>
                  <TableColumnHeader>{t("schedule.pauseTo")}</TableColumnHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {s.pauses.length === 0 && (
                  <TableEmpty>{t("schedule.noPauses")}</TableEmpty>
                )}
                {s.pauses.map((p) => (
                  <TableRow key={p.from} value={p.from}>
                    <TableRowHeader>
                      {formatDate(p.from, locale)}
                    </TableRowHeader>
                    <TableCell>{formatDate(p.to, locale)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </TableContent>
          </Table>
          <AgendaTable
            caption={t("schedule.occurrences")}
            view={view}
            accountNames={names}
            scale={scale}
            loading={occurrences.isPending}
            refreshing={occurrences.isFetching && !occurrences.isPending}
            handleRef={table}
          />
        </Stack>
      </PageBody>
      {dialog === "terms" && (
        <TermsDialog schedule={s} onDone={close} onCancel={close} />
      )}
      {dialog === "pause" && (
        <PauseDialog schedule={s} name={name} onDone={close} onCancel={close} />
      )}
      {dialog === "end" && (
        <EndDialog schedule={s} name={name} onDone={close} onCancel={close} />
      )}
    </Page>
  );
}
