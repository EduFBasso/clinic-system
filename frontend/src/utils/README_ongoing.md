# Ongoing (Em andamento) API

A small, centralized utility for dealing with the "em andamento" state across
the app.

Exports from `utils/ongoing.ts`:

- useOngoingMap(windowMs?: number): Map<clientId, Appointment> A hook view
    into the singleton sweeper. No extra network requests regardless of number
    of consumers.

- getOngoingForClient(clientId: number, opts?: { now?: Date }) Returns
    `{ info, snapInWindow }` where `info` includes current snapshot and latch,
    and `snapInWindow` suggests whether the snapshot window covers `now`.

- setLatchedOngoing(clientId: number, { id, startAt, endAt }) Persist a
    client-scoped latch to keep visuals during finalize/cancellation workflows.

- clearOngoing(clientId: number) Clears latch + snapshot for the client and
    emits `client:clearOngoing` event (same-tab immediate UX).

- sweepNow() Soft signal to nudge the singleton sweeper to refresh soon
    (reuses appointments:changed).

Notes:

- Prefer useOngoingMap for live sweeper results, and combine with
    `getOngoingForClient` for local snapshot/latch awareness.
- ClientCard continues to derive its own visual state using hooks; this API is
    for cross-surface coordination and headless flows.
