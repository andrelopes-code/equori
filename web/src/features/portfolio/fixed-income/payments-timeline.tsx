import {
  DescriptionList,
  DescriptionListDescription,
  DescriptionListItem,
  DescriptionListTerm,
} from "@slotted/react/description-list";
import { Link } from "@slotted/react/link";
import {
  Section,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import { Tag } from "@slotted/react/tag";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { recordSearch } from "@/features/instruments";
import kinds from "@/features/portfolio/fixed-income/kind-fill.module.css";
import styles from "@/features/portfolio/fixed-income/payments-timeline.module.css";
import type { ReturnKind } from "@/features/portfolio/fixed-income/return-kind";
import { timelinePoints } from "@/features/portfolio/fixed-income/timeline-points";
import { formatDate, formatDayMonthNumeric } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { routeTo } from "@/ui/navigation/route-to";

type Event = components["schemas"]["FixedIncomeEvent"];

interface PaymentsTimelineProps {
  events: readonly Event[];
  names: ReadonlyMap<string, string>;
  kindOf: ReadonlyMap<string, ReturnKind>;
  today: string;
  until: string;
  scale: (code: string) => number;
}

// Own element: the timeline family orders events, it does not place them on a dated axis (families
// read: timeline, chart). A dot per event, a mark for today, the day and month under each dot.
export function PaymentsTimeline({
  events,
  names,
  kindOf,
  today,
  until,
  scale,
}: PaymentsTimelineProps) {
  const t = useT();
  const fmt = useMoneyFormat();
  const [locale] = useAppLocale();

  const from = events.reduce((min, e) => (e.date < min ? e.date : min), today);
  const points = timelinePoints(events, from, until);
  const todayAt = timelinePoints(
    [{ instrument: "", date: today, kind: "", state: "" }],
    from,
    until,
  )[0]?.left;

  return (
    <Section size="sm">
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("fixedIncome.next")}</SectionHeading>
          <SectionDescription>
            {t("fixedIncome.next.description", {
              date: formatDate(until, locale),
            })}
          </SectionDescription>
        </SectionTitle>
      </SectionHeader>
      <SectionBody>
        {events.length === 0 && (
          <Text tone="muted">{t("fixedIncome.next.none")}</Text>
        )}

        {events.length > 0 && (
          <div className={styles.timeline} aria-hidden="true">
            <div className={styles.axis} />
            <span
              className={styles.today}
              style={{ left: `${String(todayAt)}%` }}
            />
            {points.map((p, i) => (
              <span key={i}>
                <span
                  className={[
                    styles.dot,
                    p.due
                      ? styles.due
                      : kinds[kindOf.get(p.instrument) ?? "none"],
                  ].join(" ")}
                  style={{ left: `${String(p.left)}%` }}
                />
                <span
                  className={styles.date}
                  style={{ left: `${String(p.left)}%` }}
                >
                  {formatDayMonthNumeric(p.date, locale)}
                </span>
              </span>
            ))}
          </div>
        )}

        {events.length > 0 && (
          <DescriptionList variant="ruled">
            {events.map((e) => {
              const label = `${t(`terms.event.${e.kind}` as "terms.event.interest")} · ${names.get(e.instrument) ?? e.instrument} · ${formatDayMonthNumeric(e.date, locale)}`;

              return (
                <DescriptionListItem key={`${e.instrument}${e.date}${e.kind}`}>
                  <DescriptionListTerm>
                    {e.state === "due" ? (
                      <Link
                        render={routeTo({
                          to: "/transactions/new",
                          search: recordSearch(e, scale) as never,
                        })}
                      >
                        {label}
                      </Link>
                    ) : (
                      label
                    )}
                  </DescriptionListTerm>
                  <DescriptionListDescription>
                    <span className={styles.value}>
                      {e.state === "due" && (
                        <Tag tone="danger" size="sm">
                          {t("fixedIncome.next.due")}
                        </Tag>
                      )}
                      {e.gross === undefined ? (
                        <Text tone="muted">
                          {t("fixedIncome.next.rateMissing")}
                        </Text>
                      ) : (
                        fmt.money(e.gross, scale(e.gross.currency))
                      )}
                    </span>
                  </DescriptionListDescription>
                </DescriptionListItem>
              );
            })}
          </DescriptionList>
        )}
      </SectionBody>
    </Section>
  );
}
