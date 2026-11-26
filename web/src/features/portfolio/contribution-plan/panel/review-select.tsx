import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@slotted/react/select";

import {
  type Review,
  reviews,
} from "@/features/portfolio/contribution-plan/criteria/model/criterion-effect";
import { reviewKeys } from "@/features/portfolio/contribution-plan/panel/model/criterion-words";
import { usePicked } from "@/features/portfolio/contribution-plan/panel/use-picked";
import { useT } from "@/i18n/i18n-provider";

interface ReviewSelectProps {
  // The months of the reminder stored; 0 for none.
  months: number;
  // Whether a change of the plan is being saved.
  pending: boolean;
  onReview: (months: Review) => void;
}

// The reminder of an answer: how often the panel asks to review it (CO7).
export function ReviewSelect({ months, pending, onReview }: ReviewSelectProps) {
  const t = useT();
  const review = usePicked(months, pending);

  return (
    <Select
      size="sm"
      value={String(review.value)}
      onValueChange={(next) => {
        const chosen = reviews.find((r) => String(r) === next);
        if (chosen === undefined) return;

        review.pick(chosen);
        onReview(chosen);
      }}
    >
      <SelectTrigger aria-label={t("contributionPlan.panel.review")}>
        <SelectValue />
      </SelectTrigger>

      <SelectContent>
        {reviews.map((each) => (
          <SelectItem key={each} value={String(each)}>
            {t(reviewKeys[each])}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
