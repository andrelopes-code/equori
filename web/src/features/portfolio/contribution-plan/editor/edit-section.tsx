import { Button } from "@slotted/react/button";
import {
  Section,
  SectionBody,
  SectionHeader,
  SectionHeading,
  SectionTags,
  SectionTitle,
} from "@slotted/react/section";
import { Stack } from "@slotted/react/stack";

import type { components } from "@/api/schema.gen";
import { CompositionEditor } from "@/features/portfolio/contribution-plan/composer/composition-editor";
import { compositionGroups } from "@/features/portfolio/contribution-plan/editor/composition-groups";
import { EditHelp } from "@/features/portfolio/contribution-plan/editor/edit-help";
import { GroupList } from "@/features/portfolio/contribution-plan/editor/group-list";
import type { PlanEditor } from "@/features/portfolio/contribution-plan/editor/use-plan-editor";
import type { EditDraft } from "@/features/portfolio/contribution-plan/model/plan-edits";
import { useT } from "@/i18n/i18n-provider";

type Plan = components["schemas"]["ContributionPlan"];

interface EditSectionProps {
  // The saved view with the draft laid over it.
  view: Plan;
  draft: EditDraft;
  editor: PlanEditor;
  // The contribution amount in minor units; zero or less draws the bar without a split.
  amount: number;
  pending: boolean;
  // The group whose assets panel opens first.
  initialPanel: number | null;
  memberName: (ref: { account_id?: string; instrument?: string }) => string;
}

// The second section in edit mode: the composition editor, then the group list (spec, Screen,
// Edit mode). Nothing above the list changes height while the reader edits.
export function EditSection({
  view,
  draft,
  editor,
  amount,
  pending,
  initialPanel,
  memberName,
}: EditSectionProps) {
  const t = useT();

  const state = barState(draft, amount);

  return (
    <Section size="lg" ground="surface" heading="title" aria-busy={pending}>
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("contributionPlan.ideal")}</SectionHeading>

          <SectionTags>
            <EditHelp />
          </SectionTags>
        </SectionTitle>
      </SectionHeader>

      <SectionBody>
        <Stack gap={5}>
          <CompositionEditor
            groups={compositionGroups(view, draft)}
            pending={pending}
            state={state}
            onTargets={editor.setTargets}
          />

          <GroupList
            view={view}
            draft={draft}
            editor={editor}
            memberName={memberName}
            initialPanel={initialPanel}
          />

          <div>
            <Button
              size="sm"
              variant="ghost"
              tone="secondary"
              onClick={editor.addClass}
            >
              {t("contributionPlan.addClass")}
            </Button>
          </div>
        </Stack>
      </SectionBody>
    </Section>
  );
}

function barState(draft: EditDraft, amount: number) {
  if (draft.classes.some((c) => c.name.trim() === "")) return "nameMissing";
  if (amount <= 0) return "noAmount";

  return "ok";
}
