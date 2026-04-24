# Home Return Flows (Agenda and ClientCard)

This note documents the return-flow rule used in the frontend:

- Start in A, end in A.
- If A is Home, return with focus + selected ClientCard.

## Scope

Applies to flows started from:

- ClientCard in Home (including the plus icon flow and Solve button).
- Agenda modals (daily, weekly, monthly).

## Rules

1. Agenda origin (daily/weekly/monthly)

- After finalize/resolve or canceling the action, return to the same agenda context.
- Keep the user in the agenda surface where the action started.
- Do not add extra Home highlight behavior in this case.

1. Home origin (ClientCard)

- After successful completion and return to Home, run both.
- Scroll/focus the client card into view.
- Select the client card so existing selected styling is visible.

## Implemented details

1. Solve from ClientCard (Home)

- Pending flow now carries a Home return context with `clientId`.
- Consulta success persists a Home resume instruction.
- Home resume consumes that instruction and triggers `focusClientCard(clientId)`.

1. Create from plus icon in ClientCard (Home)

- QuickSchedule success callback in Home now sets `selectedClientId` to the route client id.
- QuickSchedule success callback in Home now triggers `focusClientCard(clientId)` with retry delays for render timing.

## Why retry focus

Home can still be reconciling list data after save. A second delayed focus event improves reliability when the first event runs before card refs are ready.

## Validation checklist

- Open QuickSchedule from ClientCard plus icon.
- Create an appointment and save.
- Confirm QuickSchedule closes.
- Confirm Home scrolls to the same client card.
- Confirm that card appears selected (existing Home selected theme).

- Open pending flow from Solve button in ClientCard.
- Complete flow through Consulta and return.
- Confirm Home scrolls to the same client card.
- Confirm selected styling is visible.

- Start from daily/weekly/monthly and run finalize/resolve.
- Confirm return remains in the same agenda origin.
