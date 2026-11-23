import { useState } from "react";

import { criterionText } from "@/features/portfolio/contribution-plan/criteria/model/criterion-text";
import type { PlanEditor } from "@/features/portfolio/contribution-plan/editor/use-plan-editor";
import type { EditClass } from "@/features/portfolio/contribution-plan/model/plan-edits";
import { useT } from "@/i18n/i18n-provider";

interface CriteriaEditsInput {
  index: number;
  edit: EditClass;
  // The derived ideals of the members in basis points; undefined without a yes.
  targets: number[] | undefined;
  editor: PlanEditor;
}

// The edits of the criteria of a group. The first criterion turns the group to criteria; the last
// one to leave turns it back to typed ideals, with the ideals of now.
export function useCriteriaEdits({
  index,
  edit,
  targets,
  editor,
}: CriteriaEditsInput) {
  const t = useT();
  const [fresh, setFresh] = useState(false);

  function start() {
    if (!edit.byQuestions) editor.setByQuestions(index, true);
  }

  return {
    fresh,
    addOwn: () => {
      start();
      editor.addQuestion(index);
      setFresh(true);
    },
    addFacts: (facts: string[]) => {
      start();
      editor.addFactQuestions(
        index,
        facts.map((fact) => ({ fact, text: criterionText(t, fact, fact) })),
      );
      setFresh(false);
    },
    remove: (q: number) => {
      setFresh(false);

      if (edit.questions.length === 1) {
        editor.setByQuestions(index, false, targets);
      } else {
        editor.removeQuestion(index, q);
      }
    },
    clear: () => {
      setFresh(false);
      editor.setByQuestions(index, false, targets);
    },
  };
}
