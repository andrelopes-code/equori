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
}

// Each event placed on the window [from, to], in percent of its days.
export function timelinePoints(
  events: readonly TimelineEvent[],
  from: string,
  to: string,
): TimelinePoint[] {
  const start = Date.parse(from);
  const span = Date.parse(to) - start;

  return events.map((e) => ({
    left: Math.round(((Date.parse(e.date) - start) * 10000) / span) / 100,
    date: e.date,
    instrument: e.instrument,
    due: e.state === "due",
  }));
}
