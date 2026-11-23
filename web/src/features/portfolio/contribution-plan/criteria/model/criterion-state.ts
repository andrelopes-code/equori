import {
  isSignal,
  limitCriterion,
} from "@/features/portfolio/contribution-plan/criteria/model/criteria-catalog";
import { limitHolds } from "@/features/portfolio/contribution-plan/criteria/model/limit-value";
import type { ClassDraft } from "@/features/portfolio/contribution-plan/model/plan-draft";

type Criteria = Pick<
  ClassDraft,
  "byQuestions" | "questions" | "questionFacts" | "questionLimits"
>;

// Why the server would refuse a criterion; "ok" when it would not (CQ1, AC11).
export type CriterionState = "ok" | "blank" | "repeated" | "noLimit";

// The state of each criterion of a class. A text repeats when an earlier criterion has it, case
// ignored.
export function criterionStates(cls: Criteria): CriterionState[] {
  const seen = new Set<string>();

  return cls.questions.map((text, q) => {
    const key = text.trim().toLowerCase();
    const repeated = seen.has(key);
    seen.add(key);

    const criterion = limitCriterion(cls.questionFacts[q] ?? "");

    if (criterion !== undefined) {
      return limitHolds(criterion, cls.questionLimits[q] ?? "")
        ? "ok"
        : "noLimit";
    }

    if (isSignal(cls.questionFacts[q] ?? "")) return "ok";
    if (key === "") return "blank";

    return repeated ? "repeated" : "ok";
  });
}

// How many criteria of the classes the reader still has to complete.
export function incompleteCriteria(classes: Criteria[]): number {
  return classes
    .filter((cls) => cls.byQuestions)
    .flatMap((cls) => criterionStates(cls))
    .filter((state) => state !== "ok").length;
}

// The class without the criteria the server would refuse, for the preview.
export function withoutIncomplete(cls: ClassDraft): ClassDraft {
  const keep = criterionStates(cls).map((state) => state === "ok");

  if (keep.every(Boolean)) return cls;

  const kept = <T>(values: T[]) => values.filter((_, q) => keep[q] === true);

  return {
    ...cls,
    questions: kept(cls.questions),
    questionFacts: kept(cls.questionFacts),
    questionLimits: kept(cls.questionLimits),
    members: cls.members.map((m) =>
      m.answers === undefined ? m : { ...m, answers: kept(m.answers) },
    ),
  };
}
