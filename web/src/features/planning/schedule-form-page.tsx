import {
  ActionBar,
  ActionBarAction,
  ActionBarActions,
} from "@slotted/react/action-bar";
import { Button } from "@slotted/react/button";
import { Page, PageBody, PageFooter } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderHeading,
  PageHeaderSubheading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { ProblemError, errorText, fieldErrors } from "@/api/problem";
import { calendarsQuery, useCreateSchedule } from "@/features/planning/api";
import { RecurrenceFields } from "@/features/planning/recurrence-fields";
import { ScheduleAccountsSection } from "@/features/planning/schedule-accounts-section";
import { ScheduleAdvancedSection } from "@/features/planning/schedule-advanced-section";
import { ScheduleBasicsSection } from "@/features/planning/schedule-basics-section";
import {
  draftProblems,
  emptyDraft,
  scheduleInput,
} from "@/features/planning/schedule-draft";
import { useScheduleDraft } from "@/features/planning/use-schedule-draft";
import { settingsQuery, useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { FormNotice } from "@/ui/form-notice";
import { FormLayout } from "@/ui/form-layout";
import { FormSection } from "@/ui/form-section";

export function ScheduleFormPage() {
  const t = useT();
  const api = useApi();
  const today = useToday();
  const navigate = useNavigate();
  const scale = useScale();
  const settings = useQuery(settingsQuery(api));
  const calendars = useQuery(calendarsQuery(api));
  const create = useCreateSchedule();
  const { draft, patch } = useScheduleDraft(emptyDraft(today));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string | null>(null);
  const currency = settings.data?.base_currency;

  const submit = () => {
    const problems = draftProblems(draft);
    setErrors(
      Object.fromEntries(
        Object.entries(problems).map(([field, key]) => [field, t(key)]),
      ),
    );
    setSummary(null);
    const input =
      currency === undefined
        ? null
        : scheduleInput(draft, {
            currency,
            defaultCalendar: calendars.data?.default,
          });
    if (Object.keys(problems).length > 0 || input === null) return;
    create
      .mutateAsync(input)
      .then((schedule) =>
        navigate({
          to: "/planning/schedules/$id",
          params: { id: schedule.id },
        }),
      )
      .catch((caught: unknown) => {
        if (caught instanceof ProblemError)
          setErrors(fieldErrors(caught.problem));
        setSummary(errorText(caught, t));
      });
  };

  return (
    <Page
      width="wide"
      footer={
        <PageFooter>
          <ActionBar aria-label={t("agenda.actions")}>
            <ActionBarActions>
              <ActionBarAction>
                <Button
                  variant="ghost"
                  tone="secondary"
                  onClick={() => {
                    void navigate({
                      to: "/planning",
                      search: { tab: "schedules" },
                    });
                  }}
                >
                  {t("detail.cancel")}
                </Button>
              </ActionBarAction>
              <ActionBarAction>
                <Button
                  loading={create.isPending}
                  disabled={currency === undefined || scale === null}
                  onClick={submit}
                >
                  {t("schedule.create")}
                </Button>
              </ActionBarAction>
            </ActionBarActions>
          </ActionBar>
        </PageFooter>
      }
    >
      <PageHeader size="lg">
        <PageHeaderTitleArea>
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>{t("planning.new")}</PageHeaderHeading>
              <PageHeaderSubheading>
                {t("schedule.newSubtitle")}
              </PageHeaderSubheading>
            </PageHeaderTitle>
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
      </PageHeader>
      <PageBody>
        <FormLayout>
          {summary !== null && <FormNotice>{summary}</FormNotice>}

          <ScheduleBasicsSection draft={draft} patch={patch} errors={errors} />

          <ScheduleAccountsSection
            draft={draft}
            patch={patch}
            errors={errors}
          />

          <FormSection legend={t("schedule.recurrence")}>
            <RecurrenceFields
              value={draft.recurrence}
              onChange={(recurrence) => {
                patch({ recurrence });
              }}
            />
          </FormSection>

          <ScheduleAdvancedSection draft={draft} patch={patch} />
        </FormLayout>
      </PageBody>
    </Page>
  );
}
