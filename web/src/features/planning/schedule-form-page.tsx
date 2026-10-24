import {
  ActionBar,
  ActionBarAction,
  ActionBarActions,
} from "@slotted/react/action-bar";
import { Button } from "@slotted/react/button";
import {
  Collapsible,
  CollapsibleHeader,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@slotted/react/collapsible";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@slotted/react/field";
import { Grid } from "@slotted/react/grid";
import { InlineMessage } from "@slotted/react/inline-message";
import { NumberField } from "@slotted/react/number-field";
import { Page, PageBody, PageFooter } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderHeading,
  PageHeaderSubheading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import { Stack } from "@slotted/react/stack";
import { TextField } from "@slotted/react/text-field";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import { ProblemError, errorText, fieldErrors } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { accountsQuery } from "@/features/accounts";
import { CategoryPicker } from "@/features/categories";
import { calendarsQuery, useCreateSchedule } from "@/features/planning/api";
import { RecurrenceFields } from "@/features/planning/recurrence-fields";
import { kindLabel } from "@/features/planning/schedule-words";
import { payeesQuery, settingsQuery, useScale } from "@/features/setup";
import { AccountField, PayeeField } from "@/features/transactions";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { ChoiceSelect } from "@/ui/choice-select";
import { MoneyInput } from "@/ui/money-input";

type ScheduleKind = components["schemas"]["ScheduleKind"];
type Recurrence = components["schemas"]["Recurrence"];

const kinds = Object.keys(kindLabel) as ScheduleKind[];
// The server's defaults (ScheduleInput), shown so the reader sees what is sent.
const defaultToleranceBP = 1000;
const defaultGraceDays = 3;
const regionCalendar = "";

// A schedule's counterpart: a category for a bill, a subscription or an income, another balance
// account for a transfer or a saving.
function takesCategory(kind: ScheduleKind): boolean {
  return kind === "bill" || kind === "subscription" || kind === "income";
}

export function ScheduleFormPage() {
  const t = useT();
  const api = useApi();
  const today = useToday();
  const navigate = useNavigate();
  const scale = useScale();
  const accounts = useQuery(accountsQuery(api));
  const payees = useQuery(payeesQuery(api));
  const settings = useQuery(settingsQuery(api));
  const calendars = useQuery(calendarsQuery(api));
  const create = useCreateSchedule();
  const [kind, setKind] = useState<ScheduleKind>("bill");
  const [accountID, setAccountID] = useState<string | null>(null);
  const [counterpartID, setCounterpartID] = useState<string | null>(null);
  const [payeeID, setPayeeID] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(0);
  const [recurrence, setRecurrence] = useState<Recurrence>(() => ({
    frequency: "monthly",
    interval: 1,
    day_of_month: Number(today.slice(8, 10)),
    adjustment: "none",
    start: today,
  }));
  const [calendar, setCalendar] = useState(regionCalendar);
  const [toleranceBP, setToleranceBP] = useState(defaultToleranceBP);
  const [graceDays, setGraceDays] = useState(defaultGraceDays);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string | null>(null);
  const currency = settings.data?.base_currency;
  const income = kind === "income";
  const category = takesCategory(kind);

  const submit = () => {
    const next: Record<string, string> = {};
    if (description.trim() === "")
      next.description = t("schedule.required.description");
    if (amount <= 0) next.amount = t("schedule.required.amount");
    if (accountID === null) next.account_id = t("schedule.required.account");
    if (counterpartID === null)
      next.counterpart_id = t("schedule.required.counterpart");
    setErrors(next);
    setSummary(null);
    if (
      Object.keys(next).length > 0 ||
      accountID === null ||
      counterpartID === null ||
      currency === undefined
    )
      return;
    create
      .mutateAsync({
        kind,
        account_id: accountID,
        counterpart_id: counterpartID,
        ...(payeeID === null || !category ? {} : { payee_id: payeeID }),
        description: description.trim(),
        amount: { amount, currency },
        recurrence,
        ...(calendar === regionCalendar ? {} : { calendar }),
        match_tolerance_bp: toleranceBP,
        grace_days: graceDays,
      })
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
        <Stack gap={6}>
          {summary !== null && (
            <InlineMessage tone="danger">{summary}</InlineMessage>
          )}
          <Grid columns={2} gap={4}>
            <Field required>
              <FieldLabel>{t("schedule.kind")}</FieldLabel>
              <ChoiceSelect
                label={t("schedule.kind")}
                multiple={false}
                value={kind}
                choices={kinds.map((k) => ({
                  value: k,
                  label: t(kindLabel[k]),
                }))}
                onChange={(next) => {
                  const chosen = kinds.find((k) => k === next);
                  if (chosen === undefined) return;
                  if (takesCategory(chosen) !== category)
                    setCounterpartID(null);
                  setKind(chosen);
                }}
              />
            </Field>
            <Field invalid={errors.description !== undefined} required>
              <FieldLabel>{t("schedule.description")}</FieldLabel>
              <TextField
                name="description"
                maxLength={200}
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value);
                }}
              />
              {errors.description !== undefined && (
                <FieldError>{errors.description}</FieldError>
              )}
            </Field>
            <Field invalid={errors.amount !== undefined} required>
              <FieldLabel>{t("schedule.amount")}</FieldLabel>
              {currency !== undefined && scale !== null && (
                <MoneyInput
                  value={amount}
                  onChange={setAmount}
                  currency={currency}
                  scale={scale(currency)}
                  sign={income ? "income" : "expense"}
                />
              )}
              {errors.amount !== undefined && (
                <FieldError>{errors.amount}</FieldError>
              )}
            </Field>
            {category && (
              <Field>
                <FieldLabel>{t("schedule.payee")}</FieldLabel>
                <PayeeField
                  payees={payees.data ?? []}
                  value={payeeID}
                  onChange={setPayeeID}
                />
              </Field>
            )}
          </Grid>
          {currency !== undefined && scale !== null && (
            <Field invalid={errors.account_id !== undefined} required>
              <FieldLabel>{t("schedule.account")}</FieldLabel>
              <AccountField
                name="account"
                title={t("schedule.account")}
                accounts={accounts.data ?? []}
                value={accountID}
                exclude={category ? null : counterpartID}
                amount={amount}
                direction={income ? "in" : "out"}
                date={recurrence.start}
                categoryId={category ? counterpartID : null}
                payeeId={category ? payeeID : null}
                kind={income ? "income" : category ? "expense" : "transfer"}
                currency={currency}
                scale={scale}
                onChange={setAccountID}
              />
              {errors.account_id !== undefined && (
                <FieldError>{errors.account_id}</FieldError>
              )}
            </Field>
          )}
          <Field invalid={errors.counterpart_id !== undefined} required>
            <FieldLabel>
              {t(category ? "schedule.category" : "schedule.to")}
            </FieldLabel>
            {category ? (
              <CategoryPicker
                aria-label={t("schedule.category")}
                value={counterpartID}
                amount={income ? 1 : -1}
                invalid={errors.counterpart_id !== undefined}
                onChange={setCounterpartID}
              />
            ) : (
              currency !== undefined &&
              scale !== null && (
                <AccountField
                  name="to"
                  title={t("schedule.to")}
                  accounts={accounts.data ?? []}
                  value={counterpartID}
                  exclude={accountID}
                  amount={amount}
                  direction="in"
                  date={recurrence.start}
                  categoryId={null}
                  payeeId={null}
                  kind="transfer"
                  currency={currency}
                  scale={scale}
                  onChange={setCounterpartID}
                />
              )
            )}
            {errors.counterpart_id !== undefined && (
              <FieldError>{errors.counterpart_id}</FieldError>
            )}
          </Field>
          <Field>
            <FieldLabel>{t("schedule.recurrence")}</FieldLabel>
            <RecurrenceFields value={recurrence} onChange={setRecurrence} />
          </Field>
          <Collapsible>
            <CollapsibleHeader>
              <CollapsibleTrigger>{t("schedule.advanced")}</CollapsibleTrigger>
            </CollapsibleHeader>
            <CollapsiblePanel>
              <Grid columns={3} gap={4}>
                <Field>
                  <FieldLabel>{t("schedule.calendar")}</FieldLabel>
                  <ChoiceSelect
                    label={t("schedule.calendar")}
                    multiple={false}
                    value={calendar}
                    choices={[
                      {
                        value: regionCalendar,
                        label: t("schedule.calendarDefault"),
                      },
                      ...(calendars.data ?? []).map((c) => ({
                        value: c.id,
                        label: c.id,
                      })),
                    ]}
                    onChange={(next) => {
                      if (typeof next === "string") setCalendar(next);
                    }}
                  />
                </Field>
                <Field>
                  <FieldLabel>{t("schedule.tolerance")}</FieldLabel>
                  <NumberField
                    name="match_tolerance"
                    value={toleranceBP / 100}
                    min={0}
                    max={100}
                    step={0.01}
                    onValueChange={(next) => {
                      if (next !== null) setToleranceBP(Math.round(next * 100));
                    }}
                  />
                  <FieldDescription>
                    {t("schedule.toleranceHint")}
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel>{t("schedule.grace")}</FieldLabel>
                  <NumberField
                    name="grace_days"
                    value={graceDays}
                    min={0}
                    max={31}
                    onValueChange={(next) => {
                      if (next !== null) setGraceDays(next);
                    }}
                  />
                  <FieldDescription>{t("schedule.graceHint")}</FieldDescription>
                </Field>
              </Grid>
            </CollapsiblePanel>
          </Collapsible>
        </Stack>
      </PageBody>
    </Page>
  );
}
