import type { components } from "@/api/schema.gen";
import type {
  ClassDraft,
  MemberDraft,
  PlanDraft,
} from "@/features/portfolio/contribution-plan/model/plan-draft";
import { redistributeTargets } from "@/features/portfolio/contribution-plan/model/redistribute-targets";

type Plan = components["schemas"]["ContributionPlan"];
type Money = components["schemas"]["Money"];

export interface EditClass extends ClassDraft {
  locked: boolean;
  // Whether the members of the class carry targets of their own.
  split: boolean;
  // The group gathers its assets by rule (GR1), even while it holds none yet.
  byRule: boolean;
  memberLocks: boolean[];
}

export interface EditDraft {
  amount?: Money;
  classes: EditClass[];
}

export type MemberRef = Pick<MemberDraft, "accountId" | "instrument">;

const total = 10000;

export function startEditing(draft: PlanDraft): EditDraft {
  return {
    ...(draft.amount === undefined ? {} : { amount: draft.amount }),
    classes: draft.classes.map((cls) => ({
      ...cls,
      locked: false,
      split:
        cls.byQuestions ||
        (cls.members.length > 0 &&
          cls.members.every((m) => m.targetBp !== undefined)),
      byRule: cls.rules.length > 0,
      memberLocks: cls.members.map(() => false),
    })),
  };
}

export function setClassTarget(
  draft: EditDraft,
  index: number,
  next: number,
): EditDraft {
  const spread = spreadClasses(draft, index, next);

  return {
    ...draft,
    classes: draft.classes.map((cls, i) => ({
      ...cls,
      targetBp: spread[i] ?? cls.targetBp,
    })),
  };
}

// The targets of a boundary move, one per class in class order.
export function setClassTargets(draft: EditDraft, next: number[]): EditDraft {
  return {
    ...draft,
    classes: draft.classes.map((cls, i) => ({
      ...cls,
      targetBp: next[i] ?? cls.targetBp,
    })),
  };
}

export function setClassLocked(
  draft: EditDraft,
  index: number,
  locked: boolean,
): EditDraft {
  return updateClass(draft, index, (cls) => ({ ...cls, locked }));
}

export function renameClass(
  draft: EditDraft,
  index: number,
  name: string,
): EditDraft {
  return updateClass(draft, index, (cls) => ({ ...cls, name }));
}

export function addClass(draft: EditDraft): EditDraft {
  const cls: EditClass = {
    name: "",
    targetBp: 0,
    byQuestions: false,
    questions: [],
    questionFacts: [],
    questionLimits: [],
    members: [],
    rules: [],
    locked: false,
    split: false,
    byRule: false,
    memberLocks: [],
  };

  return { ...draft, classes: [...draft.classes, cls] };
}

// The target of the removed class goes to the others the way a change to 0 does.
export function removeClass(draft: EditDraft, index: number): EditDraft {
  const spread = spreadClasses(draft, index, 0);

  return {
    ...draft,
    classes: draft.classes
      .map((cls, i) => ({ ...cls, targetBp: spread[i] ?? cls.targetBp }))
      .filter((_, i) => i !== index),
  };
}

export function setSplit(
  draft: EditDraft,
  index: number,
  on: boolean,
): EditDraft {
  return updateClass(draft, index, (cls) => {
    const shares = equalShares(cls.members.length);
    const members = cls.members.map((m, at) =>
      on ? { ...m, targetBp: shares[at] ?? 0 } : withoutTargetAndAnswers(m),
    );

    return on
      ? { ...cls, split: true, members }
      : {
          ...cls,
          split: false,
          byQuestions: false,
          questions: [],
          questionFacts: [],
          questionLimits: [],
          members,
        };
  });
}

export function setMemberTarget(
  draft: EditDraft,
  index: number,
  at: number,
  next: number,
): EditDraft {
  return updateClass(draft, index, (cls) => {
    const spread = redistributeTargets(
      cls.members.map((m) => m.targetBp ?? 0),
      cls.memberLocks,
      at,
      next,
    );

    return {
      ...cls,
      members: cls.members.map((m, i) => ({
        ...m,
        targetBp: spread[i] ?? 0,
      })),
    };
  });
}

export function setMemberLocked(
  draft: EditDraft,
  index: number,
  at: number,
  locked: boolean,
): EditDraft {
  return updateClass(draft, index, (cls) => ({
    ...cls,
    memberLocks: cls.memberLocks.map((l, i) => (i === at ? locked : l)),
  }));
}

// A member of a split class joins with 0, or with 10000 when it is the only one; in question mode
// it joins with every answer no and no target.
export function addMember(
  draft: EditDraft,
  index: number,
  ref: MemberRef,
): EditDraft {
  return updateClass(draft, index, (cls) => {
    const targetBp = cls.members.length === 0 ? total : 0;
    const member = newMember(cls, ref, targetBp);

    return {
      ...cls,
      members: [...cls.members, member],
      memberLocks: [...cls.memberLocks, false],
    };
  });
}

export function removeMember(
  draft: EditDraft,
  index: number,
  at: number,
): EditDraft {
  return updateClass(draft, index, (cls) => {
    const spread =
      cls.split && !cls.byQuestions
        ? redistributeTargets(
            cls.members.map((m) => m.targetBp ?? 0),
            cls.memberLocks,
            at,
            0,
          )
        : [];
    const members = cls.members
      .map((m, i) =>
        cls.split && !cls.byQuestions ? { ...m, targetBp: spread[i] ?? 0 } : m,
      )
      .filter((_, i) => i !== at);

    return {
      ...cls,
      members,
      memberLocks: cls.memberLocks.filter((_, i) => i !== at),
    };
  });
}

export function updateClass(
  draft: EditDraft,
  index: number,
  change: (cls: EditClass) => EditClass,
): EditDraft {
  return {
    ...draft,
    classes: draft.classes.map((cls, i) => (i === index ? change(cls) : cls)),
  };
}

// The saved view with the draft laid over it: names, targets, members and rules come from the
// draft; the figures and the matched securities come from the view row at the same position, and
// a row the view lacks reads zero.
export function overlayDraft(view: Plan, draft: EditDraft): Plan {
  const zero: Money = { amount: 0, currency: view.total.currency };

  return {
    ...view,
    classes: draft.classes.map((cls, i) => {
      const row = view.classes[i];

      return {
        value: zero,
        question_ideals: false,
        question_effects: [],
        question_reviews: [],
        held: false,
        ...row,
        name: cls.name,
        target_bp: cls.targetBp,
        questions: cls.questions,
        question_facts: cls.questionFacts,
        question_limits: cls.questionLimits,
        rules: cls.rules,
        matched: row?.matched ?? [],
        members: cls.members.map((m) => {
          const found = row?.members.find(
            (v) =>
              (m.accountId !== undefined && v.account_id === m.accountId) ||
              (m.instrument !== undefined && v.instrument === m.instrument),
          );
          const figures = { ...(found ?? { value: zero }) };
          // A class divided by questions has no typed target: the preview derived it.
          if (!cls.byQuestions) delete figures.target_bp;
          delete figures.answers;

          return {
            ...figures,
            ...(m.accountId === undefined ? {} : { account_id: m.accountId }),
            ...(m.instrument === undefined ? {} : { instrument: m.instrument }),
            ...(m.targetBp === undefined ? {} : { target_bp: m.targetBp }),
            ...(m.answers === undefined ? {} : { answers: m.answers }),
          };
        }),
      };
    }),
  };
}

function newMember(
  cls: EditClass,
  ref: MemberRef,
  targetBp: number,
): MemberDraft {
  if (cls.byQuestions)
    return {
      ...ref,
      answers: cls.questionFacts.map((fact) => (fact === "" ? false : null)),
    };

  return cls.split ? { ...ref, targetBp } : { ...ref };
}

function spreadClasses(
  draft: EditDraft,
  index: number,
  next: number,
): number[] {
  return redistributeTargets(
    draft.classes.map((c) => c.targetBp),
    draft.classes.map((c) => c.locked),
    index,
    next,
  );
}

function withoutTargetAndAnswers(member: MemberDraft): MemberDraft {
  const rest = { ...member };
  delete rest.targetBp;
  delete rest.answers;

  return rest;
}

// Equal parts of 10000; the first members take the remainder, one unit each.
function equalShares(count: number): number[] {
  const base = Math.floor(total / Math.max(count, 1));
  const extra = total - base * count;

  return Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0));
}
