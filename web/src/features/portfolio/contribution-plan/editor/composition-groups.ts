import type { components } from "@/api/schema.gen";
import type { CompositionGroup } from "@/features/portfolio/contribution-plan/composer/composition-group";
import type { EditDraft } from "@/features/portfolio/contribution-plan/model/plan-edits";
import { positive } from "@/features/portfolio/contribution-plan/model/shopping-list";

type Plan = components["schemas"]["ContributionPlan"];

// The groups the composition editor draws: names, ideals and locks from the draft, the share
// today and the amount received from the view row at the same position.
export function compositionGroups(
  view: Plan,
  draft: EditDraft,
): CompositionGroup[] {
  return draft.classes.map((cls, index) => {
    const row = view.classes[index];
    const group: CompositionGroup = {
      key: `group-${String(index)}`,
      name: cls.name,
      colour: index,
      targetBp: cls.targetBp,
      locked: cls.locked,
    };

    if (row?.share_bp !== undefined) group.todayBp = row.share_bp;

    if (positive(row?.amount)) group.amount = row.amount;

    return group;
  });
}
