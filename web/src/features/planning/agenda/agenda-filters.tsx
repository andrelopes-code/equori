import type { components } from "@/api/schema.gen";
import styles from "@/features/planning/agenda/agenda.module.css";
import type { AgendaFilter } from "@/features/planning/model/agenda";
import { kindLabel } from "@/features/planning/model/schedule-words";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/form-fields/choice-select";

type Account = components["schemas"]["Account"];
type OccurrenceState = components["schemas"]["OccurrenceState"];
type Schedule = components["schemas"]["Schedule"];
type ScheduleKind = components["schemas"]["ScheduleKind"];

interface AgendaFiltersProps {
  filter: AgendaFilter;
  schedules: readonly Schedule[];
  accounts: readonly Account[];
  onChange: (next: AgendaFilter) => void;
}

const states: readonly OccurrenceState[] = [
  "expected",
  "overdue",
  "realized",
  "skipped",
];
const kinds = Object.keys(kindLabel) as ScheduleKind[];
const any = "";

// The four filters of the agenda: state, schedule, account and kind.
export function AgendaFilters({
  filter,
  schedules,
  accounts,
  onChange,
}: AgendaFiltersProps) {
  const t = useT();

  const anyChoice = { value: any, label: t("agenda.any") };
  const scheduleAccounts = new Set(schedules.map((s) => s.account_id));
  const chosen = (value: string | string[] | null) =>
    typeof value === "string" && value !== any ? value : undefined;

  return (
    <div
      className={styles.filters}
      aria-label={t("agenda.filters")}
      role="group"
    >
      <ChoiceSelect
        label={t("agenda.state")}
        multiple={false}
        placeholder={t("agenda.state")}
        value={filter.state ?? null}
        choices={[
          anyChoice,
          ...states.map((s) => ({
            value: s,
            label: t(`occurrence.state.${s}`),
          })),
        ]}
        onChange={(value) => {
          onChange({
            ...filter,
            state: chosen(value) as OccurrenceState | undefined,
          });
        }}
      />
      <ChoiceSelect
        label={t("agenda.schedule")}
        multiple={false}
        placeholder={t("agenda.schedule")}
        value={filter.scheduleID ?? null}
        choices={[
          anyChoice,
          ...schedules.map((s) => ({
            value: s.id,
            label: s.description === "" ? t("ledger.untitled") : s.description,
          })),
        ]}
        onChange={(value) => {
          onChange({ ...filter, scheduleID: chosen(value) });
        }}
      />
      <ChoiceSelect
        label={t("agenda.account")}
        multiple={false}
        placeholder={t("agenda.account")}
        value={filter.accountID ?? null}
        choices={[
          anyChoice,
          ...accounts
            .filter((a) => scheduleAccounts.has(a.id))
            .map((a) => ({ value: a.id, label: a.name })),
        ]}
        onChange={(value) => {
          onChange({ ...filter, accountID: chosen(value) });
        }}
      />
      <ChoiceSelect
        label={t("agenda.kind")}
        multiple={false}
        placeholder={t("agenda.kind")}
        value={filter.kind ?? null}
        choices={[
          anyChoice,
          ...kinds.map((k) => ({ value: k, label: t(kindLabel[k]) })),
        ]}
        onChange={(value) => {
          onChange({
            ...filter,
            kind: chosen(value) as ScheduleKind | undefined,
          });
        }}
      />
    </div>
  );
}
