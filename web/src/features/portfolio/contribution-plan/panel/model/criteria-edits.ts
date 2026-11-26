import type { components } from "@/api/schema.gen";
import {
  type Effect,
  type Review,
  derivesIdeals,
} from "@/features/portfolio/contribution-plan/criteria/model/criterion-effect";
import {
  toDraft,
  toInput,
} from "@/features/portfolio/contribution-plan/model/plan-draft";

type Plan = components["schemas"]["ContributionPlan"];
type Input = components["schemas"]["ContributionPlanInput"];
type ClassInput = Input["classes"][number];
type MemberInput = ClassInput["members"][number];

export interface MemberKey {
  account_id?: string;
  instrument?: string;
}

// A criterion by what another writer keeps: the name of its group and its text.
export interface CriterionKey {
  group: string;
  question: string;
}

// What the investor answers; "auto" leaves the answer to equori.
export type Answer = "auto" | "yes" | "no" | "na";

// A change of the plan read; undefined when the group, the criterion or the asset is gone.
export type PlanEdit = (plan: Plan) => Input | undefined;

// The plan read as the input of a save that a later revision refuses (CO15).
export function planInput(plan: Plan): Input {
  return { ...toInput(toDraft(plan)), revision: plan.revision };
}

export function setAnswer(
  key: CriterionKey,
  member: MemberKey,
  answer: Answer,
  today: string,
): PlanEdit {
  return editMember(key.group, member, (m, cls) => {
    const q = questionAt(cls, key.question);
    if (q < 0) return undefined;

    const fact = (cls.question_facts?.[q] ?? "") !== "";
    const size = cls.questions?.length ?? 0;

    return {
      ...m,
      answers: put(m.answers, size, q, stored(answer), null),
      answer_dates: put(
        m.answer_dates,
        size,
        q,
        answer === "auto" ? null : today,
        null,
      ),
      answer_overrides: put(
        m.answer_overrides,
        size,
        q,
        fact && answer !== "auto",
        false,
      ),
    };
  });
}

// The answer stays and its date is today's: the reminder starts again (CO7).
export function renewAnswer(
  key: CriterionKey,
  member: MemberKey,
  today: string,
): PlanEdit {
  return editMember(key.group, member, (m, cls) => {
    const q = questionAt(cls, key.question);
    if (q < 0) return undefined;

    return {
      ...m,
      answer_dates: put(
        m.answer_dates,
        cls.questions?.length ?? 0,
        q,
        today,
        null,
      ),
    };
  });
}

export function setReleased(
  group: string,
  member: MemberKey,
  released: boolean,
): PlanEdit {
  return editMember(group, member, (m) => ({ ...m, released }));
}

// Frees every asset of a group that is bought as a whole, or takes that back.
export function setGroupReleased(group: string, released: boolean): PlanEdit {
  return editClass(group, (cls) => ({
    ...cls,
    members: cls.members.map((m) => ({ ...m, released })),
  }));
}

export function setText(key: CriterionKey, text: string): PlanEdit {
  return editQuestion(key, (cls, q) => ({
    ...cls,
    questions: at(cls.questions ?? [], q, text),
  }));
}

export function setEffect(key: CriterionKey, effect: Effect): PlanEdit {
  return editQuestion(key, (cls, q) => ({
    ...cls,
    question_effects: put(
      cls.question_effects,
      cls.questions?.length ?? 0,
      q,
      effect,
      "weigh",
    ),
  }));
}

export function setReview(key: CriterionKey, months: Review): PlanEdit {
  return editQuestion(key, (cls, q) => ({
    ...cls,
    question_reviews: put<Review>(
      cls.question_reviews,
      cls.questions?.length ?? 0,
      q,
      months,
      0,
    ),
  }));
}

export function setLimit(key: CriterionKey, limit: string): PlanEdit {
  return editQuestion(key, (cls, q) => ({
    ...cls,
    question_limits: put(
      cls.question_limits,
      cls.questions?.length ?? 0,
      q,
      limit,
      "",
    ),
  }));
}

// Adds criteria that only warn (CO1); a fact or a text the group holds is left out.
export function addCriteria(
  group: string,
  added: readonly { text: string; fact: string }[],
): PlanEdit {
  return editClass(group, (cls) => {
    const fresh = added.filter(
      (a) =>
        questionAt(cls, a.text) < 0 &&
        (a.fact === "" || !(cls.question_facts ?? []).includes(a.fact)),
    );
    if (fresh.length === 0) return undefined;

    const size = cls.questions?.length ?? 0;
    const grown = <T>(list: readonly T[] | undefined, empty: T, next: T[]) => [
      ...filled(list, size, empty),
      ...next,
    ];

    return {
      ...cls,
      questions: [...(cls.questions ?? []), ...fresh.map((f) => f.text)],
      question_facts: grown(
        cls.question_facts,
        "",
        fresh.map((f) => f.fact),
      ),
      question_limits: grown(
        cls.question_limits,
        "",
        fresh.map(() => ""),
      ),
      question_effects: grown<Effect>(
        cls.question_effects,
        "weigh",
        fresh.map(() => "warn"),
      ),
      question_reviews: grown<Review>(
        cls.question_reviews,
        0,
        fresh.map(() => 0),
      ),
      members: cls.members.map((m) => ({
        ...m,
        answers: grown(
          m.answers,
          null,
          fresh.map(() => null),
        ),
        answer_dates: grown(
          m.answer_dates,
          null,
          fresh.map(() => null),
        ),
        answer_overrides: grown(
          m.answer_overrides,
          false,
          fresh.map(() => false),
        ),
      })),
    };
  });
}

export function removeCriterion(key: CriterionKey): PlanEdit {
  return editQuestion(key, (cls, q) => {
    const without = <T>(list: readonly T[] | undefined) =>
      (list ?? []).filter((_, i) => i !== q);
    const questions = without(cls.questions);
    const members = cls.members.map((m) => ({
      ...m,
      answers: without(m.answers),
      answer_dates: without(m.answer_dates),
      answer_overrides: without(m.answer_overrides),
    }));

    if (questions.length === 0) {
      return {
        name: cls.name,
        target_bp: cls.target_bp,
        members: cls.members.map(bare),
      };
    }

    return {
      ...cls,
      questions,
      question_facts: without(cls.question_facts),
      question_limits: without(cls.question_limits),
      question_effects: without(cls.question_effects),
      question_reviews: without(cls.question_reviews),
      members,
    };
  });
}

// Back to the plan before a save; refused when someone saved after it.
export function restore(before: Plan, saved: number): PlanEdit {
  return (plan) =>
    plan.revision === saved
      ? { ...planInput(before), revision: plan.revision }
      : undefined;
}

function editMember(
  group: string,
  member: MemberKey,
  change: (m: MemberInput, cls: ClassInput) => MemberInput | undefined,
): PlanEdit {
  return editClass(group, (cls) => {
    const index = cls.members.findIndex((m) => sameMember(m, member));
    const found = cls.members[index];
    const next = found === undefined ? undefined : change(found, cls);

    return next === undefined
      ? undefined
      : { ...cls, members: at(cls.members, index, next) };
  });
}

function editQuestion(
  key: CriterionKey,
  change: (cls: ClassInput, q: number) => ClassInput,
): PlanEdit {
  return editClass(key.group, (cls) => {
    const q = questionAt(cls, key.question);

    return q < 0 ? undefined : change(cls, q);
  });
}

// A group whose criteria start to set the ideals drops the typed ones, and one whose criteria stop
// keeps the derived ones as typed (CO5).
function editClass(
  group: string,
  change: (cls: ClassInput) => ClassInput | undefined,
): PlanEdit {
  return (plan) => {
    const input = planInput(plan);
    const index = input.classes.findIndex((c) => sameText(c.name, group));
    const before = input.classes[index];
    const next = before === undefined ? undefined : change(before);

    if (before === undefined || next === undefined) return undefined;

    return {
      ...input,
      classes: at(
        input.classes,
        index,
        withTargets(before, next, plan.classes[index]),
      ),
    };
  };
}

function withTargets(
  before: ClassInput,
  next: ClassInput,
  read: Plan["classes"][number] | undefined,
): ClassInput {
  if (derives(next)) {
    return { ...next, members: next.members.map(withoutTarget) };
  }

  if (!derives(before) || read?.question_ideals !== true) return next;

  return {
    ...next,
    members: next.members.map((m, i) => ({
      ...m,
      target_bp: read.members[i]?.target_bp ?? 0,
    })),
  };
}

function derives(cls: ClassInput): boolean {
  return derivesIdeals({ ...cls, questions: cls.questions ?? [] });
}

function withoutTarget(m: MemberInput): MemberInput {
  const rest = { ...m };
  delete rest.target_bp;

  return rest;
}

// A member of a group without criteria carries no answer.
function bare(m: MemberInput): MemberInput {
  const rest = { ...m };
  delete rest.answers;
  delete rest.answer_dates;
  delete rest.answer_overrides;

  return rest;
}

function questionAt(cls: ClassInput, question: string): number {
  return (cls.questions ?? []).findIndex((q) => sameText(q, question));
}

function sameText(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function sameMember(m: MemberInput, key: MemberKey): boolean {
  return m.account_id === key.account_id && m.instrument === key.instrument;
}

function stored(answer: Answer): boolean | null {
  if (answer === "yes") return true;

  return answer === "no" ? false : null;
}

function at<T>(list: readonly T[], index: number, value: T): T[] {
  return list.map((old, i) => (i === index ? value : old));
}

// The list with one entry per question, `empty` where it had none.
function filled<T>(
  list: readonly T[] | undefined,
  size: number,
  empty: T,
): T[] {
  return Array.from({ length: size }, (_, i) => list?.[i] ?? empty);
}

function put<T>(
  list: readonly T[] | undefined,
  size: number,
  index: number,
  value: T,
  empty: T,
): T[] {
  return at(filled(list, size, empty), index, value);
}
