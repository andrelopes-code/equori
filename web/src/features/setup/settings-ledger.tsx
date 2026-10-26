import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@slotted/react/field";
import { Link } from "@slotted/react/link";
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useApi } from "@/api/api-context";
import { ProblemError, problemMessage } from "@/api/problem";
import {
  hasTransactionsQuery,
  instrumentsQuery,
  settingsQuery,
  useUpdateSettings,
} from "@/features/setup/api";
import { SettingsSection } from "@/features/setup/settings-section";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/choice-select";
import { useAppLink } from "@/ui/use-app-link";

export function SettingsLedger() {
  const t = useT();
  const follow = useAppLink();
  const api = useApi();
  const settings = useQuery(settingsQuery(api));
  const instruments = useQuery(instrumentsQuery(api));
  const hasTransactions = useQuery(hasTransactionsQuery(api));
  const update = useUpdateSettings();

  const currencyChoices = useMemo(
    () =>
      (instruments.data?.items ?? [])
        .filter((i) => i.type === "currency")
        .map((i) => ({ value: i.code, label: `${i.code} ${i.name}` })),
    [instruments.data],
  );

  // The server refuses the change once a transaction exists (409); the field says so before the
  // attempt. Until the answer arrives the field stays editable and the server remains the judge.
  const locked = hasTransactions.data === true;

  const currencyError =
    update.error instanceof ProblemError
      ? problemMessage(update.error.problem, t)
      : undefined;

  return (
    <SettingsSection
      topic="finances"
      title={t("settings.ledger.title")}
      description={t("settings.ledger.description")}
    >
      <Field invalid={currencyError !== undefined}>
        <FieldLabel>{t("settings.baseCurrency")}</FieldLabel>
        <ChoiceSelect
          label={t("settings.baseCurrency")}
          choices={currencyChoices}
          value={settings.data?.base_currency ?? null}
          multiple={false}
          readOnly={locked || update.isPending}
          invalid={currencyError !== undefined}
          onChange={(next) => {
            if (typeof next === "string") {
              update.mutate({ base_currency: next });
            }
          }}
        />
        <FieldDescription>
          {locked
            ? t("settings.baseCurrency.locked")
            : t("settings.baseCurrency.help")}
        </FieldDescription>
        {currencyError !== undefined && (
          <FieldError>{currencyError}</FieldError>
        )}
      </Field>
      <Text size="sm">
        <Link href="/instruments" onClick={follow({ to: "/instruments" })}>
          {t("settings.ledger.instruments")}
        </Link>
      </Text>
    </SettingsSection>
  );
}
