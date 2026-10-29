import { ButtonLink } from "@slotted/react/button";
import { Field, FieldError } from "@slotted/react/field";
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
import { SettingsGroup } from "@/features/setup/settings-group";
import { SettingsRow } from "@/features/setup/settings-row";
import { SettingsSection } from "@/features/setup/settings-section";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/choice-select";
import { routeTo } from "@/ui/route-to";
import { useServed } from "@/ui/use-served";

const instrumentsPage = { to: "/instruments" } as const;

export function SettingsLedger() {
  const t = useT();
  const served = useServed();
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
      <SettingsGroup>
        <SettingsRow
          label={t("settings.baseCurrency")}
          description={
            locked
              ? t("settings.baseCurrency.locked")
              : t("settings.baseCurrency.help")
          }
        >
          <Field necessity="none" invalid={currencyError !== undefined}>
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
            {currencyError !== undefined && (
              <FieldError>{currencyError}</FieldError>
            )}
          </Field>
        </SettingsRow>
        {/* The instruments are desktop-only (ADR 027, S6). */}
        {served(instrumentsPage) && (
          <SettingsRow
            label={t("settings.ledger.instrumentsTitle")}
            description={t("settings.ledger.instrumentsDescription")}
          >
            <ButtonLink
              variant="outline"
              tone="secondary"
              fullWidth
              render={routeTo(instrumentsPage)}
            >
              {t("settings.ledger.instruments")}
            </ButtonLink>
          </SettingsRow>
        )}
      </SettingsGroup>
    </SettingsSection>
  );
}
