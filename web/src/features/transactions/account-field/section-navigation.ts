export interface GroupShape {
  // Options in the group.
  size: number;
  // Options across: 1 for a list of rows, 2 for a grid of cards.
  columns: number;
}

export interface Position {
  group: number;
  index: number;
}

export type NavigationKey =
  "ArrowDown" | "ArrowUp" | "ArrowRight" | "ArrowLeft" | "Home" | "End";

// Where an arrow key moves the focus among the options of the groups, which the arrows cross:
// Up and Down step by the columns of the group and pass to the neighbouring group past its
// edge; Left and Right move one option inside a grid and nowhere in a list; Home and End go to
// the first and the last option. A key that goes nowhere returns null. Groups are not empty.
export function nextPosition(
  key: NavigationKey,
  at: Position,
  groups: readonly GroupShape[],
): Position | null {
  const group = groups[at.group];
  if (group === undefined) return null;

  switch (key) {
    case "ArrowDown":
      return at.index + group.columns < group.size
        ? { group: at.group, index: at.index + group.columns }
        : firstOf(at.group + 1, groups);
    case "ArrowUp":
      return at.index - group.columns >= 0
        ? { group: at.group, index: at.index - group.columns }
        : lastOf(at.group - 1, groups);
    case "ArrowRight":
      return group.columns > 1 && at.index + 1 < group.size
        ? { group: at.group, index: at.index + 1 }
        : null;
    case "ArrowLeft":
      return group.columns > 1 && at.index > 0
        ? { group: at.group, index: at.index - 1 }
        : null;
    case "Home":
      return firstOf(0, groups);
    case "End":
      return lastOf(groups.length - 1, groups);
  }
}

function firstOf(group: number, groups: readonly GroupShape[]) {
  return groups[group] === undefined ? null : { group, index: 0 };
}

function lastOf(group: number, groups: readonly GroupShape[]) {
  const shape = groups[group];
  return shape === undefined ? null : { group, index: shape.size - 1 };
}
