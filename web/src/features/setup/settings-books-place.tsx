import { Field, FieldError } from "@slotted/react/field";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useApi } from "@/api/api-context";
import { ProblemError, problemMessage } from "@/api/problem";
import { booksQuery, useUpdateBooks } from "@/features/setup/api";
import { SettingsGroup } from "@/features/setup/settings-group";
import { SettingsRow } from "@/features/setup/settings-row";
import { timeZoneChoices } from "@/features/setup/time-zone-choices";
import { useAppLocaleState, useT } from "@/i18n/i18n-provider";
import { regionChoicesFor } from "@/i18n/regions";
import { ChoiceSelect } from "@/ui/choice-select";

export function SettingsBooksPlace() {
  const t = useT();
  const api = useApi();
  const { tag } = useAppLocaleState();
  const books = useQuery(booksQuery(api));
  const update = useUpdateBooks();

  const regionChoices = useMemo(() => regionChoicesFor(tag), [tag]);

  const defaultZone = books.data?.default_time_zone ?? "";
  const zoneChoices = useMemo(
    () =>
      timeZoneChoices(
        t("settings.timeZone.regionDefault", { zone: defaultZone }),
        books.data?.time_zone ?? null,
      ),
    [t, defaultZone, books.data?.time_zone],
  );

  if (books.data === undefined) return null;

  const timeZoneError =
    update.error instanceof ProblemError
      ? problemMessage(update.error.problem, t)
      : undefined;

  return (
    <SettingsGroup title={t("settings.books.place")}>
      <SettingsRow
        label={t("settings.region")}
        description={t("settings.region.help")}
      >
        <ChoiceSelect
          label={t("settings.region")}
          choices={regionChoices}
          value={books.data.region}
          multiple={false}
          readOnly={update.isPending}
          onChange={(next) => {
            if (typeof next === "string") {
              update.mutate({ region: next, time_zone: books.data.time_zone });
            }
          }}
        />
      </SettingsRow>
      <SettingsRow
        label={t("settings.timeZone")}
        description={t("settings.timeZone.help")}
      >
        <Field necessity="none" invalid={timeZoneError !== undefined}>
          <ChoiceSelect
            label={t("settings.timeZone")}
            choices={zoneChoices}
            value={books.data.time_zone ?? ""}
            multiple={false}
            readOnly={update.isPending}
            invalid={timeZoneError !== undefined}
            onChange={(next) => {
              if (typeof next === "string") {
                update.mutate({
                  region: books.data.region,
                  time_zone: next === "" ? null : next,
                });
              }
            }}
          />
          {timeZoneError !== undefined && (
            <FieldError>{timeZoneError}</FieldError>
          )}
        </Field>
      </SettingsRow>
    </SettingsGroup>
  );
}
