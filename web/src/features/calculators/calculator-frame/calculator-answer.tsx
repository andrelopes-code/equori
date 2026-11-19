import styles from "@/features/calculators/calculator-frame/calculator-design.module.css";
import { useT } from "@/i18n/i18n-provider";

interface CalculatorAnswerProps {
  lead: string;
  figure: string | null;
  sentence: string;
  // At most three.
  facts?: { term: string; value: string }[];
}

export function CalculatorAnswer({
  lead,
  figure,
  sentence,
  facts,
}: CalculatorAnswerProps) {
  const t = useT();

  return (
    <section
      className={styles.answer}
      aria-label={t("calc.results")}
      aria-live="polite"
      aria-atomic="true"
      data-part="answer"
    >
      <p className={styles.answerLead}>{lead}</p>
      <p className={styles.answerFigure}>{figure ?? "—"}</p>
      <p className={styles.answerSentence}>{sentence}</p>
      {facts !== undefined && facts.length > 0 && (
        <dl className={styles.answerFacts}>
          {facts.map((fact) => (
            <div key={fact.term} className={styles.answerFact}>
              <dt>{fact.term}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
