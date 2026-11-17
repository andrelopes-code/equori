import { shiftDate } from "@/i18n/format";

// Days drawn before today: today sits at 10% of the 90-day window, as in the mock.
const leadDays = 10;

const labelGap = 4;

export interface TimelineEvent {
  instrument: string;
  date: string;
  kind: string;
  state: string;
}

export interface TimelinePoint {
  // Percent of the window, two decimals.
  left: number;
  date: string;
  instrument: string;
  due: boolean;
  // False when the label would overlap the previous visible one (within labelGap points).
  labelled: boolean;
}

export function timelineFrom(today: string): string {
  return shiftDate(today, -leadDays);
}

// Each event placed on the window [from, to], in percent of its days.
export function timelinePoints(
  events: readonly TimelineEvent[],
  from: string,
  to: string,
): TimelinePoint[] {
  const start = Date.parse(from);
  const span = Date.parse(to) - start;

  let shown = -Infinity;

  return events.map((e) => {
    const left = Math.max(
      0,
      Math.round(((Date.parse(e.date) - start) * 10000) / span) / 100,
    );
    const labelled = left - shown >= labelGap;
    if (labelled) shown = left;

    return {
      left,
      date: e.date,
      instrument: e.instrument,
      due: e.state === "due",
      labelled,
    };
  });
}
