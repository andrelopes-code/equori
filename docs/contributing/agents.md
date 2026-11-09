# Working with agents

How a planning model and an implementing model deliver one issue of type `type: phase` or `type: feature`. The issue holds the scope, the exit criterion and the state of the work.

The planning model writes the spec and the plan of each issue: Opus, effort high. The implementing model executes the plan: Sonnet, effort medium or high, as a subagent that the planning session dispatches and answers directly; the owner does not carry messages between them. The implementing model makes no design decision. Every choice that changes behavior, schema, contract or user-facing text is written in the plan. A case the plan does not cover stops execution.

Order of work for an issue, every step in one session of the planning model, without a question to the owner:

1. Spec in `docs/specs/`, when the design is open. It records each decision and its reason, and answers every question of `docs/contributing/feature-design.md`. The plan cites the spec section and does not repeat the reason.
2. Plan in `docs/superpowers/plans/`, written after the planning model reads the code each task touches.
3. Plan check by the planning model: every question of `docs/contributing/feature-design.md` has its answer in the spec or the plan; every path, symbol and command named in the plan exists; every expected test value is derived; every Contract artifact passes the tool that reads it (a migration passes `make gen` and goose up and down); no question is open. Before execution, the check resolves every precondition a stop condition below would hit (files of another session in the working tree, an environment value, a pending decision) and records the resolution in the plan.
4. Execution: the planning session dispatches one implementing subagent per task, in plan order, one at a time, with the task's effort. Each slice ends with its commits and its checkpoint, and the session continues with the next slice without waiting for the owner.
5. Review by the planning model at the end of the plan, in the same session: the diff against the plan's edge cases, the test of each answer of the feature design checklist, and the issue's exit criterion.

The issue records the step its work is in. The model that starts a step writes a comment on the issue naming the step (`spec`, `plan`, `check`, `execution` or `review`) and the file or commit of that step. The issue closes once the exit criterion passes.

A plan holds at most four slices of at most three tasks. A larger issue is split into plans in dependency order.

| Plan section | Content |
|---|---|
| Goal | The exit criterion of the issue that the plan serves, quoted, with the issue number. |
| Decisions | One row per decision: question, choice, source (spec section, ADR or owner). No open question remains. |
| Contract | The exact text of every artifact the implementing model would otherwise invent: migration SQL, sqlc queries, `api/openapi.yaml` fragments, signatures of exported Go functions and ports, `Problem.code` values, catalog keys with pt-BR and en text, each region-dependent value with its extension point. |
| Tasks | Grouped in slices. Each task names its effort, medium or high. High applies to migrations, money, authorization, session and bank-sync identity. |
| Edge cases | Each case with the task and the test that cover it. |
| Owner tasks | Steps the implementing model never executes: real bank accounts, a clean machine, a provider key, a release tag. |
| Out of scope | Adjacent changes that the implementing model leaves untouched. |

Each task holds:

- Files to create, modify and test, anchored by function or type name, never by line number.
- The failing test, written first, with its table of exact inputs and expected values, and the failure expected before the implementation.
- The implementation steps.
- The verification commands with their expected result. Commands are limited to the changed packages and never use the tags `eval` or `live`.
- The commit message.

A mechanical change across many files, such as the rename of `user_id` in P10, is a command or a script in the plan. The plan states the expected number of changed sites and the command that proves completion, with its expected output.

The implementing model stops, writes the checkpoint and reports when any condition holds:

- A file, symbol or command named in the plan is absent or has a different signature.
- The new test passes before the implementation.
- A test outside the task fails.
- The task needs a file, dependency, migration, operation, `Problem.code` or text that the plan does not list.
- The plan contradicts itself, an ADR, a spec or `CONTRIBUTING.md`.
- A verification command fails after two fix attempts.

After a stop, the planning model amends the plan and resumes the same subagent with the amendment. The owner is asked only for a decision that the spec, an ADR or the owner's earlier answers do not settle.

A new session starts only after a spec or a plan is written, after a plan is reviewed, or when the context reaches the limits of the execution slice protocol.

A model that ends its turn by recommending a new session, for the next step of this section or for any other task, gives the owner the message to send in that session:

- The message stands alone: it names the step, the plan or spec file, the checkpoint `.claude/progress/current.md`, the model and effort of the step, and the expected result and stop.
- It sits at the end of the reply, in one fenced code block, preceded by a line that starts with the marker 🔴 and names the target session, for example `🔴 Prompt for the new session (plan check, Opus, effort high):`.
- The marker is the only emoji allowed in a reply or document of this project; it exists so the owner finds the message among the rest of the reply.
- A reply gives exactly one marked block. The owner runs one session at a time and clears it before sending the next message, so issues that could run side by side run one after the other, in the order of their dependencies.
- A step that waits on the owner, such as the owner tasks of a reviewed plan, goes into the next message as its first item: the new session asks the owner for the result in its single question and records it before the step it names.

