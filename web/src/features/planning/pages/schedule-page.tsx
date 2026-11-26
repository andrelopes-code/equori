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
import type { TableHandle } from "@slotted/react/table";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useRef, useState } from "react";

import { useApi } from "@/api/api-context";
import { accountsQuery } from "@/features/accounts";
import { occurrencesQuery, scheduleQuery } from "@/features/planning/api";
import { agenda } from "@/features/planning/model/agenda";
import {
  currentTerms,
  hasEnded,
  kindLabel,
  recurrenceWords,
} from "@/features/planning/model/schedule-words";
import { PausesTable } from "@/features/planning/schedule-detail/pauses-table";
import {
  ScheduleDialogs,
  type ScheduleDialog,
  type SuggestedTerms,
} from "@/features/planning/schedule-detail/schedule-dialogs";
import { ScheduleFacts } from "@/features/planning/schedule-detail/schedule-facts";
import {
  ScheduleMenu,
  type ScheduleMenuChoice,
} from "@/features/planning/schedule-detail/schedule-menu";
import { ScheduleOccurrences } from "@/features/planning/schedule-detail/schedule-occurrences";
import { TermsTable } from "@/features/planning/schedule-detail/terms-table";
import { TermsSuggestionBanner } from "@/features/planning/terms-suggestion/terms-suggestion-banner";
import { useScale } from "@/features/setup";
import { shiftDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { QueryError } from "@/ui/feedback/query-error";
import { HeaderAction } from "@/ui/navigation/header-action";
import { PageBack } from "@/ui/navigation/page-back";
import { PageStack } from "@/ui/page-layout/page-stack";

// One schedule: its facts, its terms versions, its pauses and its occurrences half a year either
// side of today (listOccurrences reads at most 366 days).
export function SchedulePage() {
  const t = useT();
  const [locale] = useAppLocale();
  const api = useApi();
  const today = useToday();
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
  const [dialog, setDialog] = useState<ScheduleDialog | null>(null);
  const [suggested, setSuggested] = useState<SuggestedTerms | null>(null);
  const table = useRef<TableHandle>(null);
  const close = () => {
    setDialog(null);
    setSuggested(null);
  };
  const handleMenu = (choice: ScheduleMenuChoice) => {
    if (choice === "move") {
      void navigate({ to: "/planning/schedules/new", search: { from: id } });
      return;
    }
    setDialog(choice);
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
              <ScheduleMenu ended={ended} onChoose={handleMenu} />
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
        <PageStack>
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

          <ScheduleFacts schedule={s} names={names} />
          <Grid columns={2} gap={6} minItemWidth="lg">
            <TermsTable
              schedule={s}
              scale={scale}
              editable={!ended}
              onRevise={() => {
                setDialog("reviseTerms");
              }}
              onRemove={() => {
                setDialog("removeTerms");
              }}
            />
            <PausesTable pauses={s.pauses} />
          </Grid>
          <ScheduleOccurrences
            caption={t("schedule.occurrences")}
            view={view}
            accountNames={names}
            scale={scale}
            loading={occurrences.isPending}
            refreshing={occurrences.isFetching && !occurrences.isPending}
            handleRef={table}
          />
        </PageStack>
      </PageBody>
      <ScheduleDialogs
        dialog={dialog}
        schedule={s}
        name={name}
        suggested={suggested}
        onClose={close}
      />
    </Page>
  );
}
