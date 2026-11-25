import styles from "@/features/assistant/proposal/ticket/ticket.module.css";
import type { TicketHeroData } from "@/features/assistant/proposal/ticket/ticket-hero-model";
import { TicketValue } from "@/features/assistant/proposal/ticket/ticket-value";
import { useFigureText } from "@/features/assistant/proposal/ticket/use-figure-text";
import { useTicketText } from "@/features/assistant/proposal/ticket/use-ticket-text";
import { useT } from "@/i18n/i18n-provider";

interface TicketHeroProps {
  hero: TicketHeroData;
}

// What the operation is: the figure, the security or the index, and the price of one unit.
export function TicketHero({ hero }: TicketHeroProps) {
  const t = useT();
  const text = useTicketText();
  const figure = useFigureText()(hero);
  const price = hero.price;
  const was = price?.was === undefined ? undefined : text.value(price.was);

  return (
    <div className={styles.hero} data-part="hero">
      <span className={styles.heroWhat}>
        <span className={styles.heroQty}>
          <TicketValue text={figure.figure} was={figure.was} />
        </span>
        {figure.code !== undefined && (
          <span className={styles.heroCode}>{figure.code}</span>
        )}
      </span>

      {price !== undefined && (
        <span className={styles.heroPrice}>
          <TicketValue
            text={t("assistant.ticket.at", {
              price: text.value(price.value) ?? "",
            })}
            was={was}
          />
        </span>
      )}

      {hero.name !== undefined && (
        <span className={styles.heroName} title={hero.name}>
          {hero.name}
        </span>
      )}
    </div>
  );
}
