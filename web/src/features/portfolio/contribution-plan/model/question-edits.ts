import {
  type EditDraft,
  setSplit,
  updateClass,
} from "@/features/portfolio/contribution-plan/model/plan-edits";

export const maxQuestions = 10;

// On: the class divides its ideal by questions, with none yet and no member target. Off: the
// members take the targets the last preview returned, or equal shares without them.
export function setByQuestions(
  draft: EditDraft,
  index: number,
  on: boolean,
  targets?: number[],
): EditDraft {
  const cleared = setSplit(draft, index, false);

  if (on) {
    return updateClass(cleared, index, (cls) => ({
      ...cls,
      byQuestions: true,
      split: true,
      members: cls.members.map((m) => ({ ...m, answers: [] })),
    }));
  }

  const typed = setSplit(cleared, index, true);

  if (targets === undefined) return typed;

  return updateClass(typed, index, (cls) => ({
    ...cls,
    members: cls.members.map((m, at) => {
      const targetBp = targets[at] ?? m.targetBp;

      return targetBp === undefined ? m : { ...m, targetBp };
    }),
  }));
}

export function addQuestion(draft: EditDraft, index: number): EditDraft {
  if ((draft.classes[index]?.questions.length ?? 0) >= maxQuestions)
    return draft;

  return updateClass(draft, index, (cls) => ({
    ...cls,
    questions: [...cls.questions, ""],
    questionFacts: [...cls.questionFacts, ""],
    members: cls.members.map((m) => ({
      ...m,
      answers: [...(m.answers ?? []), false],
    })),
  }));
}

// Appends one question per entry, each with its fact. Nothing changes once the class names a fact
// or the entries would pass maxQuestions.
export function addFactQuestions(
  draft: EditDraft,
  index: number,
  facts: { fact: string; text: string }[],
): EditDraft {
  const cls = draft.classes[index];

  if (cls === undefined) return draft;
  if (cls.questionFacts.some((fact) => fact !== "")) return draft;
  if (cls.questions.length + facts.length > maxQuestions) return draft;

  return updateClass(draft, index, (c) => ({
    ...c,
    questions: [...c.questions, ...facts.map((f) => f.text)],
    questionFacts: [...c.questionFacts, ...facts.map((f) => f.fact)],
    members: c.members.map((m) => ({
      ...m,
      answers: [...(m.answers ?? []), ...facts.map(() => false)],
    })),
  }));
}

export function setQuestionText(
  draft: EditDraft,
  index: number,
  q: number,
  text: string,
): EditDraft {
  return updateClass(draft, index, (cls) => ({
    ...cls,
    questions: cls.questions.map((question, i) => (i === q ? text : question)),
  }));
}

export function removeQuestion(
  draft: EditDraft,
  index: number,
  q: number,
): EditDraft {
  return updateClass(draft, index, (cls) => ({
    ...cls,
    questions: cls.questions.filter((_, i) => i !== q),
    questionFacts: cls.questionFacts.filter((_, i) => i !== q),
    members: cls.members.map((m) => ({
      ...m,
      answers: (m.answers ?? []).filter((_, i) => i !== q),
    })),
  }));
}

export function setAnswer(
  draft: EditDraft,
  index: number,
  at: number,
  q: number,
  yes: boolean,
): EditDraft {
  return updateClass(draft, index, (cls) => ({
    ...cls,
    members: cls.members.map((m, i) =>
      i === at
        ? {
            ...m,
            answers: (m.answers ?? []).map((a, j) => (j === q ? yes : a)),
          }
        : m,
    ),
  }));
}
