import { useState } from "react";

import type { components } from "@/api/schema.gen";
import { useSaveContributionPlan } from "@/features/portfolio/api";
import {
  toDraft,
  toInput,
} from "@/features/portfolio/contribution-plan/model/plan-draft";
import type {
  PlanDraft,
  Rule,
} from "@/features/portfolio/contribution-plan/model/plan-draft";
import * as edits from "@/features/portfolio/contribution-plan/model/plan-edits";
import type {
  EditDraft,
  MemberRef,
} from "@/features/portfolio/contribution-plan/model/plan-edits";
import * as rules from "@/features/portfolio/contribution-plan/model/rule-edits";
import * as questions from "@/features/portfolio/contribution-plan/model/question-edits";

type Plan = components["schemas"]["ContributionPlan"];
type Money = components["schemas"]["Money"];

export type PlanEditor = ReturnType<typeof usePlanEditor>;

// The draft of the targets while the reader edits them: undefined outside edit mode. Every change
// starts from the saved plan when no draft exists, so a first change opens edit mode.
export function usePlanEditor(plan: Plan | undefined) {
  const [draft, setDraft] = useState<EditDraft | undefined>(undefined);
  const save = useSaveContributionPlan();

  const dirty =
    draft !== undefined &&
    plan !== undefined &&
    JSON.stringify(toInput(draft).classes) !==
      JSON.stringify(toInput(toDraft(plan)).classes);

  function change(next: (current: EditDraft) => EditDraft) {
    if (plan === undefined) return;
    setDraft((current) => next(current ?? edits.startEditing(toDraft(plan))));
  }

  return {
    draft,
    dirty,
    saving: save.isPending,
    error: save.error,
    start: () => {
      change((d) => d);
    },
    startFrom: (from: PlanDraft) => {
      setDraft(edits.startEditing(from));
    },
    discard: () => {
      setDraft(undefined);
      save.reset();
    },
    save: (amount: Money | undefined) => {
      if (draft === undefined) return;
      const body = {
        ...toInput(draft),
        ...(amount === undefined ? {} : { amount }),
      };
      save.mutate(body, {
        onSuccess: () => {
          setDraft(undefined);
        },
      });
    },
    setTarget: (index: number, bp: number) => {
      change((d) => edits.setClassTarget(d, index, bp));
    },
    setTargets: (next: number[]) => {
      change((d) => edits.setClassTargets(d, next));
    },
    setLocked: (index: number, locked: boolean) => {
      change((d) => edits.setClassLocked(d, index, locked));
    },
    rename: (index: number, name: string) => {
      change((d) => edits.renameClass(d, index, name));
    },
    addClass: () => {
      change(edits.addClass);
    },
    removeClass: (index: number) => {
      change((d) => edits.removeClass(d, index));
    },
    setSplit: (index: number, on: boolean) => {
      change((d) => edits.setSplit(d, index, on));
    },
    setByQuestions: (index: number, on: boolean, targets?: number[]) => {
      change((d) => questions.setByQuestions(d, index, on, targets));
    },
    addQuestion: (index: number) => {
      change((d) => questions.addQuestion(d, index));
    },
    addFactQuestions: (
      index: number,
      facts: { fact: string; text: string }[],
    ) => {
      change((d) => questions.addFactQuestions(d, index, facts));
    },
    setQuestionText: (index: number, q: number, text: string) => {
      change((d) => questions.setQuestionText(d, index, q, text));
    },
    setQuestionLimit: (index: number, q: number, limit: string) => {
      change((d) => questions.setQuestionLimit(d, index, q, limit));
    },
    removeQuestion: (index: number, q: number) => {
      change((d) => questions.removeQuestion(d, index, q));
    },
    setAnswer: (index: number, at: number, q: number, yes: boolean | null) => {
      change((d) => questions.setAnswer(d, index, at, q, yes));
    },
    setMemberTarget: (index: number, at: number, bp: number) => {
      change((d) => edits.setMemberTarget(d, index, at, bp));
    },
    setMemberLocked: (index: number, at: number, locked: boolean) => {
      change((d) => edits.setMemberLocked(d, index, at, locked));
    },
    addMember: (index: number, ref: MemberRef) => {
      change((d) => edits.addMember(d, index, ref));
    },
    removeMember: (index: number, at: number) => {
      change((d) => edits.removeMember(d, index, at));
    },
    setByRule: (index: number, on: boolean) => {
      change((d) => rules.setByRule(d, index, on));
    },
    addRule: (index: number, rule: Rule) => {
      change((d) => rules.addRule(d, index, rule));
    },
    replaceRule: (index: number, at: number, rule: Rule) => {
      change((d) => rules.replaceRule(d, index, at, rule));
    },
    removeRule: (index: number, at: number) => {
      change((d) => rules.removeRule(d, index, at));
    },
  };
}
