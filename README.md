See `info/local-vs-online-workflow.md` for how to switch between local-only development (LAN) and online (Render + Vercel) safely, including CORS/hosts and API base configuration.

## Scheduling Modals (Quick vs Full)

The system intentionally keeps two separate scheduling modals that serve different usage speeds and depth of control:

### 1. QuickScheduleModal

- Entry point: Opens inline from a `ClientCard` (embedded trigger button) and auto-suggests a slot +7 days ahead.
- Goal: Ultra-fast creation / light edit of a single appointment for an existing client.
- Prefills: Date (+7 days), 60 min duration end time, last chosen visit type (persisted in `localStorage` under `defaultVisitType`).
- Inline day view: Shows only the selected date (mini list) with live reload after create/update.
- Hard rules enforced locally:
  - Minimum duration 60 min.
  - Soft limit of future appointments per client (`maxFutureAppointments`, default 7) -> emits a `systemMessage` warning.
- Auto-close: Controlled by `AUTO_CLOSE_QUICK_SCHEDULE_ON_CREATE` (true = closes immediately after successful create).
- Resilience: Uses `AbortController` (15s) + safety fallback (20s) to avoid stuck saving state; always dispatches a scroll unlock event.
- Highlight UX: Newly created/updated appointment gets temporary highlight + scroll into view; also fires `scrollToClientCard` to reinforce context.

### 2. ScheduleModal (Full Scheduler)

- Entry point: Can open from broader navigation (e.g., a calendar view) or from a client but also works with no preselected client (client prop optional).
- Goal: Manage a day’s agenda with conflict detection, replace suggestions, longer durations (selectable: 60/90/120/150), and time navigation.
- Day navigation: Previous/Next arrows with per-client last-day persistence (`schedule:lastDay:<clientId>` in `localStorage`).
- Conflict handling: Calculates overlapping appointments and can offer replacement flow (`offerReplace`).
- Duration flexibility: Several predefined blocks instead of manual end time typing.
- More verbose layout: Designed for thorough adjustments rather than speed.

### Why keep both?

| Dimension          | QuickScheduleModal           | ScheduleModal                                  |
| ------------------ | ---------------------------- | ---------------------------------------------- |
| Speed              | Extremely fast               | Moderate                                       |
| Cognitive load     | Minimal                      | Higher (more options)                          |
| Editing depth      | Basic (time/date/notes/type) | Full (duration variants + conflict management) |
| Client required    | Yes (always tied to a card)  | No (client optional)                           |
| Overlap resolution | Manual (user adjusts times)  | Assisted (conflict detection)                  |
| Auto-close option  | Yes (config flag)            | No (stays open)                                |

### Event Emission (Global CustomEvents)

- `appointments:changed` (detail: `{ mode: 'created' | 'updated' | 'deleted', id, clientId }`) – triggers list refreshes.
- `systemMessage` (detail: `{ text, type }`) – surface toast/snackbar style messages.
- `scrollToClientCard` (detail: `{ clientId }`) – used after quick create/update to refocus related client.
- `ensureScrollUnlocked` – safety event to guarantee body scroll isn’t left disabled after modal edge cases.

### When to use which

- Use QuickScheduleModal for the common “book next session” pattern directly from a client context.
- Use ScheduleModal when:
  - You need to view the entire day for collisions.
  - You want non-60-min durations quickly.
  - You are scheduling before picking a client (client optional flow).
  - You are resolving a set of overlapping or chained appointments.

### Configuration Touchpoints

- `frontend/src/config/limits.ts` – houses `AUTO_CLOSE_QUICK_SCHEDULE_ON_CREATE` and can later hold future per-role limits.
- Both modals share visit type persistence via `localStorage.defaultVisitType`.

### Future Extension Ideas

- Merge into a single adaptive modal only if usage metrics justify (track open→save funnel first).
- Add keyboard shortcuts (e.g., Enter to save in QuickSchedule, arrow keys to jump days in ScheduleModal) – scaffolding ready via focus handling code blocks.
- Introduce role-based constraints (e.g., assistants limited to Quick mode).

This dual-path design avoids premature consolidation and keeps the high-frequency flow optimized while preserving a richer tool for less common but more complex scheduling tasks.

## Mobile-first schedule page vs desktop modal

Current state (September 2025):

- Mobile (iOS/Android): New/edit scheduling opens a full-page route at `/schedule` instead of using modals.
  - Reason: avoids Safari bottom toolbar and background scroll quirks; page uses the full viewport height and scrolls naturally.
  - Entry points adapted: ClientCard “+”, Agenda → Novo, and Daily Agenda “Editar” route to `/schedule` with relevant query params (e.g., `?client=ID&edit=APPT_ID`).
- Desktop: The existing modal flows remain (ScheduleModal/QuickScheduleModal).

What renders on the page:

- `ScheduleEditorCore` is the shared editor component used by `SchedulePage` (full page). The modal (desktop) still uses its own `ScheduleModal` while we keep visual parity and iterate.

When we are ready to unify:

- Refactor `ScheduleModal` to render `ScheduleEditorCore` inside `AppModal` to eliminate duplication (DRY), keeping props parity (`client`, `defaultDate`, `editAppointment`).

Testing tips:

- On a phone, use ClientCard “+” or Menu → Agenda → Novo to reach `/schedule`.
- For conflicts at the same time, the primary action becomes a red “Substituir e salvar” button; otherwise, it’s the green “Salvar”.
