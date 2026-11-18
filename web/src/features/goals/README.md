# goals

Route: `/goals` renders `GoalsPage` (`web/src/app/router.tsx`).

Guide topic: `goals` (`web/src/navigation/navigation-map.json`).

Public exports (`index.ts`): `GoalsPage`, `GoalMeter`, `goalState`, `monthsLeft`, `GoalPaymentSection`.

Folders:

- `pages/`: the route component, its test and its styles.
- `goal-card/`: the card of one goal, its meter, segments and state.
- `goal-dialog/`: the dialogs that create, edit and delete a goal.
- `goal-expenses/`: the expenses a goal pays: the lines of the card, the panel that lists and links them, and the section of the transaction detail.
- `model/`: pure functions for accounts, contribution and plan.
