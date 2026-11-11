# goals

Route: `/goals` renders `GoalsPage` (`web/src/app/router.tsx`).

Guide topic: `goals` (`web/src/navigation/navigation-map.json`).

Public exports (`index.ts`): `GoalsPage`, `GoalMeter`, `goalState`, `monthsLeft`.

Folders:

- `pages/`: the route component, its test and its styles.
- `goal-card/`: the card of one goal, its meter, segments and state.
- `goal-dialog/`: the dialogs that create, edit and delete a goal.
- `model/`: pure functions for accounts, contribution and plan.
