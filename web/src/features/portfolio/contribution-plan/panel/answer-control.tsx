import { Segment, SegmentedControl } from "@slotted/react/segmented-control";

import type { Answer } from "@/features/portfolio/contribution-plan/panel/model/criteria-edits";
import { answerKeys } from "@/features/portfolio/contribution-plan/panel/model/criterion-words";
import { usePicked } from "@/features/portfolio/contribution-plan/panel/use-picked";
import { useT } from "@/i18n/i18n-provider";

interface AnswerControlProps {
  label: string;
  // Undefined without an answer.
  value: Answer | undefined;
  // Offers to leave the answer to equori.
  automatic?: boolean;
  // Whether a change of the plan is being saved.
  pending: boolean;
  onAnswer: (answer: Answer) => void;
}

const own: readonly Answer[] = ["yes", "no", "na"];

// The answer of an asset to a criterion, all choices in view.
export function AnswerControl({
  label,
  value,
  automatic = false,
  pending,
  onAnswer,
}: AnswerControlProps) {
  const t = useT();
  const picked = usePicked(value, pending);

  const choices: readonly Answer[] = automatic ? ["auto", ...own] : own;

  return (
    <SegmentedControl
      aria-label={label}
      value={picked.value ?? ""}
      onValueChange={(next) => {
        const choice = choices.find((c) => c === next);
        if (choice === undefined) return;

        picked.pick(choice);
        onAnswer(choice);
      }}
    >
      {choices.map((choice) => (
        <Segment key={choice} value={choice}>
          {t(answerKeys[choice])}
        </Segment>
      ))}
    </SegmentedControl>
  );
}
