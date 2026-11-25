import { indexName } from "@/features/calculators";
import type { TicketHeroData } from "@/features/assistant/proposal/ticket/ticket-hero-model";
import { useTicketText } from "@/features/assistant/proposal/ticket/use-ticket-text";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import type { TFunction } from "@/i18n/i18n-provider";

export interface FigureText {
  figure: string;
  was?: string;
  code?: string;
}

// The words of a ticket's first line: "2" and "MUND11", "1 → 2" and "WEGE3", "110%" and "do CDI".
export function useFigureText() {
  const t = useT();
  const [locale] = useAppLocale();
  const text = useTicketText();

  return (hero: TicketHeroData): FigureText => {
    const { figure } = hero;
    const code = [hero.codeBefore, hero.code]
      .filter((name) => name !== undefined)
      .join(" → ");
    const named = code === "" ? {} : { code };

    switch (figure.kind) {
      case "quantity":
        return {
          figure: text.quantity(figure.value),
          ...(figure.was !== undefined && { was: text.quantity(figure.was) }),
          ...named,
        };
      case "ratio":
        return { figure: `${figure.from} → ${figure.to}`, ...named };
      case "code":
        return { figure: figure.value };
      case "rate":
        return rateText(figure, locale, t);
    }
  };
}

// "110%" "do CDI", "IPCA" "+ 6,5%", "12%" "ao ano".
function rateText(
  rate: { rate?: string; index?: string; spread?: string },
  locale: string,
  t: TFunction,
): FigureText {
  const spread =
    rate.spread === undefined ? undefined : percent(rate.spread, locale);

  if (rate.index === undefined) {
    return { figure: spread ?? "", code: t("assistant.ticket.per_year") };
  }

  const index = indexName(rate.index);
  const added = spread === undefined ? [] : [`+ ${spread}`];

  if (rate.rate === undefined) {
    return {
      figure: index,
      ...(spread !== undefined && { code: `+ ${spread}` }),
    };
  }

  return {
    figure: percent(rate.rate, locale),
    code: [t("assistant.ticket.of_index", { index }), ...added].join(" "),
  };
}

function percent(decimal: string, locale: string): string {
  return numberFormatter(locale, {
    style: "percent",
    maximumFractionDigits: 2,
  }).format(Number(decimal) / 100);
}
