// Completeness rules of mock.json, shared by the mock page (shown in words in its header)
// and by scripts/check-mock.mjs.
const REQUIRED_STATES = ["data", "loading", "empty", "error"];

export function validate(mock, root) {
  const problems = [];
  const notes = mock.notes ?? {};
  const states = (mock.states ?? []).map((s) => s.id);
  const concepts = mock.concepts ?? [];

  if (!root) problems.push("theme/root.json is missing: run scripts/probe.mjs on the real screen");

  for (const id of REQUIRED_STATES) {
    if (!states.includes(id)) problems.push(`state "${id}" is missing`);
  }

  if (!(mock.states ?? []).some((s) => s.hard)) {
    problems.push('no hard-data state (a state with "hard": true)');
  }

  if (mock.chosen) {
    if (!concepts.some((c) => c.id === mock.chosen))
      problems.push("the chosen concept is not listed");
  } else {
    if (concepts.length < 2 || concepts.length > 3) problems.push("2 to 3 concepts are required");

    if (concepts.filter((c) => c.recommended).length !== 1) {
      problems.push("exactly one concept is recommended");
    }
  }

  if (mock.status === "approved" && !mock.chosen)
    problems.push("an approved mock names its concept");
  if (!notes.priority?.confirmed) problems.push("block priority is not confirmed by the owner");

  const questions = notes.questions ?? [];
  if (questions.length < 1 || questions.length > 3)
    problems.push("1 to 3 user questions are required");

  if (!notes.inventory?.length) problems.push("the data inventory is empty");

  for (const row of notes.inventory ?? []) {
    if (!row.destination) problems.push(`inventory: "${row.datum}" has no destination`);

    if (/^(removed|none)$/i.test(row.destination ?? "") && !row.reason) {
      problems.push(`inventory: "${row.datum}" leaves without a reason`);
    }
  }

  if (!notes.responsive?.length) problems.push("no phone decision is recorded per block");
  if (JSON.stringify(mock).includes("TODO")) problems.push("mock.json still holds TODO text");

  return problems;
}
