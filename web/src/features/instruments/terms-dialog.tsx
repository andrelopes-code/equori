import { Alert, AlertContent, AlertDescription } from "@slotted/react/alert";
import { Button } from "@slotted/react/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@slotted/react/field";
import { InlineMessage } from "@slotted/react/inline-message";
import { Stack } from "@slotted/react/stack";
import { TextField } from "@slotted/react/text-field";
import { useId, useMemo, useState } from "react";

import { ProblemError, errorText, fieldErrors } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { usePutTerms } from "@/features/instruments/api";
import { bpText, parsePercentBp } from "@/features/instruments/basis-points";
import {
  dayCountLabel,
  dayCounts,
} from "@/features/instruments/instrument-labels";
import { formatRate } from "@/features/instruments/rate";
import { shiftDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { ChoiceSelect } from "@/ui/choice-select";
import { DateInput } from "@/ui/date-input";
import { MoneyInput } from "@/ui/money-input";
import { useOverlayOpen } from "@/ui/use-overlay-open";
import { useStableCallback } from "@/ui/use-stable-callback";

type Terms = components["schemas"]["FixedIncomeTerms"];
type DayCount = components["schemas"]["TermsDayCount"];

// Sets the terms of a fixed income instrument. The server replaces the earlier terms and the
// prices accrued from them, and the form says so before the write. The dates start at today and a
// year ahead; the index, the day count and the face value start empty, as no value of them is
// neutral for every region.
export function TermsDialog({
  code,
  quote,
  scale,
  terms,
  onDone,
  onCancel,
}: {
  code: string;
  quote: string;
  scale: number;
  terms: Terms | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const today = useToday();
  const formId = useId();
  const overlayOpen = useOverlayOpen();
  const put = usePutTerms();
  const [issued, setIssued] = useState(terms?.issued_on ?? today);
  const [matures, setMatures] = useState(
    terms?.matures_on ?? shiftDate(today, 365),
  );
  const [index, setIndex] = useState(terms?.index_id ?? "");
  const [percent, setPercent] = useState(
    formatRate(bpText(terms?.percent_of_index_bp ?? 10000), locale),
  );
  const [spread, setSpread] = useState(
    formatRate(bpText(terms?.spread_bp ?? 0), locale),
  );
  const [dayCount, setDayCount] = useState<DayCount | null>(
    terms?.day_count ?? null,
  );
  const [face, setFace] = useState(terms?.face_value ?? 0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string | null>(null);
  const dayCountChoices = useMemo(
    () => dayCounts.map((d) => ({ value: d, label: dayCountLabel(t, d) })),
    [t],
  );
  const openChange = useStableCallback((open: boolean) => {
    if (!open) onCancel();
  });
  const submit = () => {
    const next: Record<string, string> = {};
    const required = t("instruments.required");
    const percentBp = parsePercentBp(percent);
    const spreadBp = parsePercentBp(spread);
    if (percentBp === null || percentBp < 1)
      next.percent_of_index_bp = t("terms.invalid.percent");
    if (spreadBp === null) next.spread_bp = t("terms.invalid.percent");
    if (dayCount === null) next.day_count = required;
    if (face < 1) next.face_value = required;
    setErrors(next);
    setSummary(null);
    if (
      Object.keys(next).length > 0 ||
      percentBp === null ||
      spreadBp === null ||
      dayCount === null
    )
      return;
    put
      .mutateAsync({
        code,
        terms: {
          issued_on: issued,
          matures_on: matures,
          ...(index.trim() === "" ? {} : { index_id: index.trim() }),
          percent_of_index_bp: percentBp,
          spread_bp: spreadBp,
          day_count: dayCount,
          face_value: face,
        },
      })
      .then(onDone)
      .catch((caught: unknown) => {
        const fields =
          caught instanceof ProblemError ? fieldErrors(caught.problem) : {};
        setErrors(fields);
        setSummary(
          Object.keys(fields).length > 0 ? null : errorText(caught, t),
        );
      });
  };
  return (
    <Dialog open={overlayOpen} size="lg" onOpenChange={openChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("terms.title")}</DialogTitle>
          <DialogDescription>{t("terms.dialog.description")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          {/* Workaround for Slotted finding "dialog has no place for a form around its parts". */}
          <form
            id={formId}
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <Stack gap={4}>
              {summary !== null && (
                <InlineMessage tone="danger">{summary}</InlineMessage>
              )}
              <Alert tone="warning">
                <AlertContent>
                  <AlertDescription>{t("terms.replaceNote")}</AlertDescription>
                </AlertContent>
              </Alert>
              <Field invalid={errors.issued_on !== undefined} required>
                <FieldLabel>{t("terms.issuedOn")}</FieldLabel>
                <DateInput
                  name="issued_on"
                  value={issued}
                  shortcuts={false}
                  onChange={setIssued}
                />
                {errors.issued_on !== undefined && (
                  <FieldError>{errors.issued_on}</FieldError>
                )}
              </Field>
              <Field invalid={errors.matures_on !== undefined} required>
                <FieldLabel>{t("terms.maturesOn")}</FieldLabel>
                <DateInput
                  name="matures_on"
                  value={matures}
                  shortcuts={false}
                  onChange={setMatures}
                />
                {errors.matures_on !== undefined && (
                  <FieldError>{errors.matures_on}</FieldError>
                )}
              </Field>
              <Field invalid={errors.index_id !== undefined}>
                <FieldLabel>{t("terms.index")}</FieldLabel>
                <TextField
                  name="index_id"
                  value={index}
                  maxLength={40}
                  onChange={(event) => {
                    setIndex(event.target.value.toLowerCase());
                  }}
                />
                {errors.index_id === undefined ? (
                  <FieldDescription>{t("terms.indexHint")}</FieldDescription>
                ) : (
                  <FieldError>{errors.index_id}</FieldError>
                )}
              </Field>
              <Field
                invalid={errors.percent_of_index_bp !== undefined}
                required
              >
                <FieldLabel>{t("terms.percentOfIndex")}</FieldLabel>
                <TextField
                  name="percent_of_index"
                  inputMode="decimal"
                  value={percent}
                  onChange={(event) => {
                    setPercent(event.target.value);
                  }}
                />
                {errors.percent_of_index_bp !== undefined && (
                  <FieldError>{errors.percent_of_index_bp}</FieldError>
                )}
              </Field>
              <Field invalid={errors.spread_bp !== undefined} required>
                <FieldLabel>{t("terms.spread")}</FieldLabel>
                <TextField
                  name="spread"
                  inputMode="decimal"
                  value={spread}
                  onChange={(event) => {
                    setSpread(event.target.value);
                  }}
                />
                {errors.spread_bp !== undefined && (
                  <FieldError>{errors.spread_bp}</FieldError>
                )}
              </Field>
              <Field invalid={errors.day_count !== undefined} required>
                <FieldLabel>{t("terms.dayCount")}</FieldLabel>
                <ChoiceSelect
                  label={t("terms.dayCount")}
                  choices={dayCountChoices}
                  value={dayCount}
                  multiple={false}
                  invalid={errors.day_count !== undefined}
                  onChange={(next) => {
                    if (typeof next === "string") setDayCount(next as DayCount);
                  }}
                />
                {errors.day_count !== undefined && (
                  <FieldError>{errors.day_count}</FieldError>
                )}
              </Field>
              <Field invalid={errors.face_value !== undefined} required>
                <FieldLabel>{t("terms.faceValue")}</FieldLabel>
                <MoneyInput
                  value={face}
                  onChange={setFace}
                  currency={quote}
                  scale={scale}
                  sign="neutral"
                />
                {errors.face_value !== undefined && (
                  <FieldError>{errors.face_value}</FieldError>
                )}
              </Field>
            </Stack>
          </form>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onCancel}>
            {t("detail.cancel")}
          </Button>
          <Button type="submit" form={formId} loading={put.isPending}>
            {t("terms.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
