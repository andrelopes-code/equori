import { useMemo } from "react";

import { valueText } from "@/features/assistant/view/value-text";
import {
  CLOSE,
  OPEN,
  verdictParts,
} from "@/features/assistant/view/verdict-parts";
import type { VerdictPart } from "@/features/assistant/view/verdict-parts";
import { useValueFormat } from "@/features/assistant/view/use-value-format";
import { catalogKey } from "@/features/assistant/model/catalog-key";
import type {
  ViewPayload,
  ViewText,
} from "@/features/assistant/view/view-types";
import { windowText } from "@/features/assistant/view/window-text";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

export interface ViewTexts {
  title: string;
  window: string;
  verdict: VerdictPart[];
  prov: string;
  head: string[];
  rows: string[][];
}

// Every text of a view, translated and formatted once for the drawing and the copy.
export function useViewText(p: ViewPayload): ViewTexts {
  const t = useT();
  const [locale] = useAppLocale();
  const format = useValueFormat();

  return useMemo(() => {
    const plain = (text: ViewText | undefined) =>
      verdictParts(render(text), values(text))
        .map((part) => part.text)
        .join("");
    const render = (text: ViewText | undefined) => {
      const key = text === undefined ? undefined : catalogKey(text.key);
      if (key === undefined || text === undefined) return "";
      const marks = Object.fromEntries(
        Object.keys(text.params ?? {}).map((name) => [
          name,
          `${OPEN}${name}${CLOSE}`,
        ]),
      );
      return t(key, marks);
    };
    const values = (text: ViewText | undefined) =>
      Object.fromEntries(
        Object.entries(text?.params ?? {}).map(([name, v]) => [
          name,
          valueText(v, format),
        ]),
      );
    const label =
      p.window.label_key === undefined
        ? undefined
        : catalogKey(p.window.label_key);

    return {
      title: plain(p.title),
      window: label === undefined ? windowText(p.window, locale) : t(label),
      verdict: verdictParts(render(p.verdict), values(p.verdict)),
      prov: plain(p.prov),
      head: p.rows.head.map((h) => {
        const k = catalogKey(h);
        return k === undefined ? h : t(k);
      }),
      rows: p.rows.rows.map((r) => r.map((v) => valueText(v, format))),
    };
  }, [p, t, locale, format]);
}
