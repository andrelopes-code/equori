import { Field, FieldError } from "@slotted/react/field";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useApi } from "@/api/api-context";
import { ProblemError, problemMessage } from "@/api/problem";
import { meQuery } from "@/features/session";
import { syncScheduleQuery, useSetSyncSchedule } from "@/features/setup/api";
import { SettingsGroup } from "@/features/setup/settings-group";
import { SettingsRow } from "@/features/setup/settings-row";
import { syncIntervalChoices } from "@/features/setup/sync-interval-choices";
import { useAppLocaleState, useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/choice-select";

export function SettingsSyncSchedule() {
  const t = useT();
  const api = useApi();
  const { tag } = useAppLocaleState();
  const schedule = useQuery(syncScheduleQuery(api));
  // ADR 025 F8: a member reads the setting; only an admin changes it.
  const admin = useQuery(meQuery(api)).data?.role === "admin";
  const set = useSetSyncSchedule();

  const minutes = schedule.data?.minutes ?? null;
  const choices = useMemo(
    () => syncIntervalChoices(tag, minutes),
    [tag, minutes],
  );

  const error =
    set.error instanceof ProblemError
      ? problemMessage(set.error.problem, t)
      : undefined;

  return (
    <SettingsGroup>
      <SettingsRow
        label={t("settings.syncInterval")}
        description={t("settings.syncInterval.help")}
      >
        <Field necessity="none" invalid={error !== undefined}>
          <ChoiceSelect
            label={t("settings.syncInterval")}
            choices={choices}
            value={minutes === null ? null : String(minutes)}
            multiple={false}
            readOnly={!admin || set.isPending}
            invalid={error !== undefined}
            onChange={(next) => {
              if (typeof next === "string") {
                set.mutate({ minutes: Number(next) });
              }
            }}
          />
          {error !== undefined && <FieldError>{error}</FieldError>}
        </Field>
      </SettingsRow>
    </SettingsGroup>
  );
}
