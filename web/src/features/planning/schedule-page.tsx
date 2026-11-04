import {
  DescriptionList,
  DescriptionListDescription,
  DescriptionListItem,
  DescriptionListTerm,
} from "@slotted/react/description-list";
import { Grid } from "@slotted/react/grid";
import { Page, PageBody } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderHeading,
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
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useRef, useState } from "react";

import { useApi } from "@/api/api-context";
import type { TableHandle } from "@slotted/react/table";
import { accountsQuery } from "@/features/accounts";
import { agenda } from "@/features/planning/agenda";
import { AgendaTable } from "@/features/planning/agenda-table";
import { occurrencesQuery, scheduleQuery } from "@/features/planning/api";
import { calendarLabel } from "@/features/planning/calendar-label";
import { EndDialog } from "@/features/planning/end-dialog";
import { MatchingDialog } from "@/features/planning/matching-dialog";
import { PauseDialog } from "@/features/planning/pause-dialog";
import { RenameDialog } from "@/features/planning/rename-dialog";
import {
  currentTerms,
  hasEnded,
  kindLabel,
  recurrenceWords,
} from "@/features/planning/schedule-words";
import { TermsDialog } from "@/features/planning/terms-dialog";
import { TermsSuggestionBanner } from "@/features/planning/terms-suggestion-banner";
import { useScale } from "@/features/setup";
import { formatDate, numberFormatter, shiftDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { AppLink } from "@/ui/app-link";
import { HeaderAction } from "@/ui/header-action";
import { QueryError } from "@/ui/query-error";
import { PageBack } from "@/ui/page-back";

type Dialog = "terms" | "rename" | "matching" | "pause" | "end";

interface Suggested {
  amount: number;
  effectiveFrom: string | undefined;
}

// One schedule: its facts, its terms versions, its pauses and its occurrences half a year either
// side of today (listOccurrences reads at most 366 days).
export function SchedulePage() {
  const t = useT();
  const [locale] = useAppLocale();
  const api = useApi();
  const today = useToday();
  const fmt = useMoneyFormat();
  const scale = useScale();
  const navigate = useNavigate();
  const { id } = useParams({ from: "/_authed/planning/schedules/$id" });
  const schedule = useQuery(scheduleQuery(api, id));
  const occurrences = useQuery(
    occurrencesQuery(api, shiftDate(today, -182), shiftDate(today, 183), {
      schedule_id: id,
    }),
  );
  const accounts = useQuery(accountsQuery(api));
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [suggested, setSuggested] = useState<Suggested | null>(null);
  const table = useRef<TableHandle>(null);
  const close = () => {
    setDialog(null);
    setSuggested(null);
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
  const ended = hasEnded(s.ends_on, today);
  const names = new Map((accounts.data ?? []).map((a) => [a.id, a.name]));
  const view = agenda(occurrences.data ?? [], [], [s], {});
  return (
    <Page width="full">
      <PageHeader size="lg">
        <PageHeaderTitleArea>
          <PageBack
            render={(props) => (
              <Link {...props} to="/planning" search={{ tab: "schedules" }} />
            )}
          >
            {t("planning.tab.schedules")}
          </PageBack>
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
                label={t("schedule.rename")}
                glyph="pencil"
                wordsOnly
                onClick={() => {
                  setDialog("rename");
                }}
              />
              <HeaderAction
                label={t("schedule.matching.edit")}
                glyph="pencil"
                wordsOnly
                onClick={() => {
                  setDialog("matching");
                }}
              />
              {!ended && (
                <HeaderAction
                  label={t("schedule.pause")}
                  glyph="pause"
                  wordsOnly
                  onClick={() => {
                    setDialog("pause");
                  }}
                />
              )}
              {!ended && (
                <HeaderAction
                  label={t("schedule.moveToAccount")}
                  glyph="arrow-right"
                  wordsOnly
                  onClick={() => {
                    void navigate({
                      to: "/planning/schedules/new",
                      search: { from: s.id },
                    });
                  }}
                />
              )}
              {!ended && (
                <HeaderAction
                  label={t("schedule.end")}
                  glyph="stop"
                  wordsOnly
                  onClick={() => {
                    setDialog("end");
                  }}
                />
              )}
              {!ended && (
                <HeaderAction
                  primary
                  label={t("schedule.changeTerms")}
                  glyph="calendar"
                  wordsOnly
                  onClick={() => {
                    setDialog("terms");
                  }}
                />
              )}
            </PageHeaderActions>
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
      </PageHeader>
      <PageBody>
        <Stack gap={6}>
          {terms !== undefined && (
            <TermsSuggestionBanner
              terms={terms}
              occurrences={occurrences.data ?? []}
              onUpdate={(amount, effectiveFrom) => {
                setSuggested({ amount, effectiveFrom });
                setDialog("terms");
              }}
            />
          )}

          <DescriptionList
            layout="stack"
            variant="framed"
            columns={3}
            aria-label={t("schedule.facts")}
          >
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
                <AppLink
                  to={{
                    to: "/settings",
                    search: { section: "calendars", calendar: s.calendar },
                  }}
                >
                  {calendarLabel(t, s.calendar)}
                </AppLink>
              </DescriptionListDescription>
            </DescriptionListItem>
            <DescriptionListItem>
              <DescriptionListTerm>
                {t("schedule.tolerance")}
              </DescriptionListTerm>
              <DescriptionListDescription>
                {numberFormatter(locale, {
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
          <Grid columns={2} gap={6} minItemWidth="lg">
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
                    <TableColumnHeader>
                      {t("schedule.pauseTo")}
                    </TableColumnHeader>
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
          </Grid>
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
        <TermsDialog
          schedule={s}
          initialAmount={suggested?.amount}
          initialEffectiveFrom={suggested?.effectiveFrom}
          onDone={close}
          onCancel={close}
        />
      )}
      {dialog === "rename" && (
        <RenameDialog schedule={s} onDone={close} onCancel={close} />
      )}
      {dialog === "matching" && (
        <MatchingDialog schedule={s} onDone={close} onCancel={close} />
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
