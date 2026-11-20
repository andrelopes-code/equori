import type { ChartPoint, ChartZoom } from "@slotted/core/chart";
import { useState } from "react";

const whole: ChartZoom = { start: 0, end: 1 };

export interface LinkedCharts {
  zoom: ChartZoom;
  setZoom: (zoom: ChartZoom) => void;
  // The month read on either chart, as a point of a series that holds a value in it.
  pointOf: (seriesAt: (key: string) => string | undefined) => ChartPoint | null;
  setActive: (point: ChartPoint | null) => void;
}

// The two risk charts share one window of months and one month in focus: a zoom or a hover on
// either moves the other (RK7, RK8). Each chart names the series it reads the month on, since a
// line can lack the month the other chart is on.
export function useLinkedCharts(): LinkedCharts {
  const [zoom, setZoom] = useState(whole);
  const [key, setKey] = useState<string | null>(null);

  return {
    zoom,
    setZoom,
    pointOf: (seriesAt) => {
      const series = key === null ? undefined : seriesAt(key);

      return key === null || series === undefined ? null : { series, key };
    },
    setActive: (point) => {
      setKey(point?.key ?? null);
    },
  };
}
