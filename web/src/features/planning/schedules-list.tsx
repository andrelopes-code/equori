import { List } from "@slotted/react/list";
import {
  ListItem,
  ListItemBody,
  ListItemDescription,
  ListItemEnd,
  ListItemLabel,
  ListItemLink,
} from "@slotted/react/list-item";
import { Skeleton } from "@slotted/react/skeleton";
import { Stack } from "@slotted/react/stack";

import type { components } from "@/api/schema.gen";
import { PhoneGroup } from "@/ui/phone-group";
import {
  currentTerms,
  kindLabel,
  recurrenceWords,
} from "@/features/planning/schedule-words";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { routeTo } from "@/ui/route-to";

type Schedule = components["schemas"]["Schedule"];
type ScheduleKind = components["schemas"]["ScheduleKind"];

const kinds = Object.keys(kindLabel) as ScheduleKind[];

// Below 600 px the schedules are rows grouped by kind (mobile.md M1, record work): name and
// recurrence, the next occurrence under them, the amount at the end. A row opens the schedule.
export function SchedulesList({
  items,
  names,
  next,
  scale,
  loading,
}: {
  items: Schedule[];
  names: ReadonlyMap<string, string>;
  next: ReadonlyMap<string, string>;
  scale: ((code: string) => number) | null;
  loading: boolean;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const today = useToday();
  const fmt = useMoneyFormat();
  if (loading || scale === null)
    return (
      <Stack gap={2} aria-busy="true">
        <Skeleton shape="block" blockSize="4rem" />
        <Skeleton shape="block" blockSize="4rem" />
      </Stack>
    );
  return (
    <Stack gap={5}>
      {kinds.map((kind) => {
        const rows = items.filter((s) => s.kind === kind);
        if (rows.length === 0) return null;
        const label = t(kindLabel[kind]);
        return (
          <PhoneGroup key={kind} label={label}>
            <List aria-label={label} variant="framed">
              {rows.map((s) => {
                const terms = currentTerms(s.terms, today);
                const upcomingOn = next.get(s.id);
                const details = [
                  names.get(s.account_id) ?? "",
                  terms === undefined
                    ? ""
                    : recurrenceWords(terms.recurrence, t, locale),
                ].filter((part) => part !== "");
                return (
                  <ListItem key={s.id}>
                    <ListItemLink
                      render={routeTo({
                        to: "/planning/schedules/$id",
                        params: { id: s.id },
                      })}
                    >
                      <ListItemBody>
                        <ListItemLabel>
                          {s.description === ""
                            ? t("ledger.untitled")
                            : s.description}
                        </ListItemLabel>
                        <ListItemDescription>
                          {details.join(" · ")}
                        </ListItemDescription>
                        <ListItemDescription>
                          {[
                            t("schedules.next"),
                            upcomingOn === undefined
                              ? t("schedules.none")
                              : formatDate(upcomingOn, locale),
                          ].join(": ")}
                        </ListItemDescription>
                      </ListItemBody>
                      <ListItemEnd>
                        {terms !== undefined &&
                          fmt.money(terms.amount, scale(terms.amount.currency))}
                      </ListItemEnd>
                    </ListItemLink>
                  </ListItem>
                );
              })}
            </List>
          </PhoneGroup>
        );
      })}
    </Stack>
  );
}
