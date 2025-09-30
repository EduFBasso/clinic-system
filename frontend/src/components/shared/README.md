# Agenda UI Components

This folder contains the centralized building blocks for the agenda experience.
The goal is a single visual and interaction model that scales across Monthly,
Daily, and Desktop surfaces.

## AppointmentCard

Single source of truth for the mini card visuals and behavior.

-   Inputs (AppointmentCardProps):

    -   appt: { id, start_at, end_at, status, client_name?, notes?, title?,
        client? }
    -   size?: 'sm' | 'md' (default 'md') — Logical scale for typography via CSS
        variables. Layout remains container-driven.
    -   onClick?: (appt) => void — Legacy primary click. If onEdit/onUseTime
        exists, they take precedence.
    -   onUseTime?: (appt) => void — Primary action for QuickSchedule flows.
    -   onResolvePending?: (appt) => void — If status is past (pending), tapping
        triggers pending resolution.
    -   onEdit?, onCancel?, onDetails?: (appt) => void — Optional actions;
        Details shown for done/canceled.
    -   highlight?, editingActive?, pulse?, compact?, showNotes?, selected?
    -   showEditAction?: boolean — Controls edit icon visibility.
    -   showTime?: boolean; timeInline?: boolean — Time display options when
        used standalone.
    -   className?, style?, now?: Date — Optional styling and time reference for
        derived states.

-   Behavior:

    -   Click priority: pending+onResolvePending → onEdit → onUseTime → onClick.
    -   Ongoing appointments block clicks.
    -   Left colored stripe and background computed via centralized status
        tokens.
    -   Client name rendered top-left; visit type under the status badge on the
        right.
    -   Notes clamped to 2 lines by default.

-   Size and tokens:
    -   Global CSS tokens live in `src/styles/palette.css`
        (`--card-font-family`, `--card-name-size`, `--card-type-size`,
        `--card-text-size`, `--card-radius`, `--card-padding-*`).
    -   `size='sm'` applies local overrides to `--card-*-size` variables,
        reducing typography without affecting layout.

## ClientCardRow

High-level row wrapper combining the time block on the left and the
AppointmentCard on the right.

-   Props: extends AppointmentCardProps, plus

    -   timeSize?: 'sm' | 'md' (default 'md')
    -   timeOrder?: 'start-top' | 'end-top'
    -   containerStyle?, cardContainerStyle?

-   Behavior:
    -   Always renders `<TimeRangeLabel />` on the left.
    -   Forwards handlers to the inner AppointmentCard; time is hidden inside
        the card to avoid duplication.

## TimeRangeLabel

Utility to render start/end time as a compact block. Supports `order='end-top'`
to show the end time above the start when desired.

## Usage patterns

-   Monthly/Day/Desktop lists should render using `ClientCardRow` to keep a
    single row pattern.
-   Centralize pending resolution, edit, use-time, and details through the card
    props.
-   Let the container control width; cards flex to fit. Avoid extra nested grids
    that constrain the card.

## Accessibility

-   Status colors follow centralized tokens with high contrast.
-   Notes are truncated to 2 lines to reduce verbosity while keeping important
    context visible.

## Testing

-   Unit tests validate pending click behavior, status badges, and details icon
    rendering for done/canceled.
-   JSDOM warnings for `scrollTo` are expected and benign.

## Future extensions

-   `ClientDayList` component to render an entire day’s appointments for reuse
    (Daily, QuickSchedule).
-   Optional CSS class modifier for `size='sm'` instead of inline CSS var
    overrides.
-   Remove details icon in favor of card-level details click when appropriate.
