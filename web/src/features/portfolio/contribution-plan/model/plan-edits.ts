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
        cls.members.length > 0 &&
        cls.members.every((m) => m.targetBp !== undefined),
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
    members: [],
    locked: false,
    split: false,
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
      on ? { ...m, targetBp: shares[at] ?? 0 } : withoutTarget(m),
    );

    return { ...cls, split: on, members };
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

// A member of a split class joins with 0, or with 10000 when it is the only one.
export function addMember(
  draft: EditDraft,
  index: number,
  ref: MemberRef,
): EditDraft {
  return updateClass(draft, index, (cls) => {
    const targetBp = cls.members.length === 0 ? total : 0;
    const member: MemberDraft = cls.split ? { ...ref, targetBp } : { ...ref };

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
    const spread = cls.split
      ? redistributeTargets(
          cls.members.map((m) => m.targetBp ?? 0),
          cls.memberLocks,
          at,
          0,
        )
      : [];
    const members = cls.members
      .map((m, i) => (cls.split ? { ...m, targetBp: spread[i] ?? 0 } : m))
      .filter((_, i) => i !== at);

    return {
      ...cls,
      members,
      memberLocks: cls.memberLocks.filter((_, i) => i !== at),
    };
  });
}

// The saved view with the draft laid over it: names, targets and members come from the draft;
// the figures come from the view row at the same position, and a row the view lacks reads zero.
export function overlayDraft(view: Plan, draft: EditDraft): Plan {
  const zero: Money = { amount: 0, currency: view.total.currency };

  return {
    ...view,
    classes: draft.classes.map((cls, i) => {
      const row = view.classes[i];

      return {
        value: zero,
        ...row,
        name: cls.name,
        target_bp: cls.targetBp,
        members: cls.members.map((m) => {
          const found = row?.members.find(
            (v) =>
              (m.accountId !== undefined && v.account_id === m.accountId) ||
              (m.instrument !== undefined && v.instrument === m.instrument),
          );
          const figures = { ...(found ?? { value: zero }) };
          delete figures.target_bp;

          return {
            ...figures,
            ...(m.accountId === undefined ? {} : { account_id: m.accountId }),
            ...(m.instrument === undefined ? {} : { instrument: m.instrument }),
            ...(m.targetBp === undefined ? {} : { target_bp: m.targetBp }),
          };
        }),
      };
    }),
  };
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

function updateClass(
  draft: EditDraft,
  index: number,
  change: (cls: EditClass) => EditClass,
): EditDraft {
  return {
    ...draft,
    classes: draft.classes.map((cls, i) => (i === index ? change(cls) : cls)),
  };
}

function withoutTarget(member: MemberDraft): MemberDraft {
  const rest = { ...member };
  delete rest.targetBp;

  return rest;
}

// Equal parts of 10000; the first members take the remainder, one unit each.
function equalShares(count: number): number[] {
  const base = Math.floor(total / Math.max(count, 1));
  const extra = total - base * count;

  return Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0));
}
